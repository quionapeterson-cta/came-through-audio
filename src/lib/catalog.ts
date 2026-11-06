import { supabase } from "@/integrations/supabase/client";
import { requestBadgeCheck } from "@/lib/badge-events";
import { creditName, emptyContributor, emptyMetadata, splitTrack, withLegalName, type Metadata } from "@/lib/metadata";

export type CatalogTrack = { id: string; title: string; artist: string; updatedAt: string; metadata: Metadata };

const names = (rows: Metadata["writers"]) => rows.filter((r) => r.name);

export function toCatalogRow(m: Metadata, userId: string) {
  const writers = m.writers.filter(creditName).map((r) => ({ ...r, name: creditName(r) }));
  const publishers = names(m.publishers);
  return {
    user_id: userId,
    track_title: m.title.trim(),
    artist_name: m.artist.trim(),
    featured_artists: m.featured.filter(Boolean),
    album_title: m.album || null,
    duration: m.duration || null,
    isrc: m.isrc || null,
    upc: m.upc || null,
    iswc: m.iswc || null,
    release_date: m.releaseDate || null,
    writer_names: writers.map((r) => r.name),
    writer_pro_affiliations: writers.map((r) => r.pro),
    writer_percentages: writers.map((r) => Number(r.percentage || 0)),
    publisher_identities: publishers.map((r) => r.name),
    publisher_pro_affiliations: publishers.map((r) => r.pro),
    publisher_percentages: publishers.map((r) => Number(r.percentage || 0)),
    details: m,
    updated_at: new Date().toISOString(),
  };
}

export function fromCatalogRow(row: Record<string, unknown>): CatalogTrack {
  const saved = (row["details"] ?? {}) as Partial<Metadata>;
  const base = emptyMetadata();
  const metadata: Metadata = {
    ...base,
    ...saved,
    title: (row["track_title"] as string) ?? "",
    artist: (row["artist_name"] as string) ?? "",
    featured: saved.featured?.length ? saved.featured : [""],
    ...(saved.trackNumber?.includes("/") && splitTrack(saved.trackNumber)),
    writers: saved.writers?.length ? withLegalName(saved.writers) : [emptyContributor()],
    composers: saved.composers?.length ? withLegalName(saved.composers) : [emptyContributor()],
    producers: saved.producers?.length ? saved.producers : [emptyContributor()],
    publishers: saved.publishers?.length ? saved.publishers : [emptyContributor()],
    // Songs saved before 2026-10-27 read "3:45"; agencies want "03:45". Shown and exported padded; saved as-is.
    ...(/^\d:[0-5]\d$/.test(saved.duration ?? "") && { duration: `0${saved.duration}` }),
  };
  return { id: row["id"] as string, title: metadata.title, artist: metadata.artist, updatedAt: (row["updated_at"] ?? row["created_at"]) as string, metadata };
}

export async function listTracks(): Promise<CatalogTrack[]> {
  const { data, error } = await supabase.from("catalogs").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => fromCatalogRow(r as Record<string, unknown>));
}

export async function saveTrack(m: Metadata, userId: string, id?: string): Promise<string> {
  const row = toCatalogRow(m, userId) as never;
  const query = id
    ? supabase.from("catalogs").update(row).eq("id", id).select("id").single()
    : supabase.from("catalogs").insert(row).select("id").single();
  const { data, error } = await query;
  if (error) throw error;
  requestBadgeCheck();
  return (data as { id: string }).id;
}

/** Deletes a song and its stored master and artwork (everything in its private folder). */
export async function deleteTrack(id: string) {
  const { error } = await supabase.from("catalogs").delete().eq("id", id);
  if (error) throw error;
  // Files go after the row, so a failed delete never leaves a song without its master.
  const { data: auth } = await supabase.auth.getUser();
  const folder = auth.user ? `${auth.user.id}/${id}` : "";
  if (!folder) return;
  const { data: files } = await supabase.storage.from(BUCKET).list(folder);
  if (files?.length) {
    const { error: fileError } = await supabase.storage.from(BUCKET).remove(files.map((f) => `${folder}/${f.name}`));
    if (fileError) console.error("Song deleted, but its files weren't removed", fileError.message);
  }
}

const BUCKET = "catalog-files";

/** Store a master or artwork file privately under the owner's folder; returns its storage path. */
export async function uploadCatalogFile(userId: string, trackId: string, kind: "master" | "artwork", file: Blob, ext: string) {
  const path = `${userId}/${trackId}/${kind}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type || (kind === "master" ? "audio/mpeg" : "image/jpeg") });
  if (error) throw error;
  return path;
}

export async function downloadCatalogFile(path: string, filename: string) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  saveBlob(data, filename);
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  // The link has to be in the document before it is clicked: Safari ignores a click on a detached anchor, which made
  // every download button look dead with no error at all (founder, 2026-11-06).
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export const safeName = (s: string) => s.replace(/[<>:"/\\|?*]+/g, "_").trim() || "track";

/** A release in the catalog: an album or an EP, its songs in track order. */
export type Release = { key: string; album: string; type: "Album" | "EP"; tracks: CatalogTrack[] };

/**
 * The catalog grouped into releases (one per album title, A–Z). Songs with no album are singles, which are downloaded
 * one at a time from their own row, so they are not a release here.
 */
export function groupReleases(tracks: CatalogTrack[]): Release[] {
  const groups = new Map<string, CatalogTrack[]>();
  for (const t of tracks) {
    const album = (t.metadata.album ?? "").trim();
    if (!album) continue;
    const key = album.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const trackNo = (t: CatalogTrack) => Number(t.metadata.trackNumber) || 999;
  return [...groups.entries()]
    .map(([key, list]) => {
      const ordered = [...list].sort((a, b) => trackNo(a) - trackNo(b) || a.title.localeCompare(b.title));
      return { key, album: (ordered[0]!.metadata.album ?? "").trim(), type: /^ep$/i.test(ordered[0]!.metadata.releaseType ?? "") ? "EP" as const : "Album" as const, tracks: ordered };
    })
    .sort((a, b) => a.album.localeCompare(b.album));
}

/**
 * One ZIP for a set of songs: every master (named exactly as the title, `Song Title.mp3`), its artwork, its lyrics PDF
 * and the catalog PDF. Files that can't be fetched are skipped and counted, so one bad file never blocks the rest.
 */
async function downloadSongsZip(tracks: CatalogTrack[], zipName: string, onProgress?: (done: number, total: number) => void): Promise<{ songs: number; skipped: number }> {
  const [{ makeZip, uniqueName }, { buildCatalogPdf }, { buildLyricsPdf }, { myBrand }] = await Promise.all([import("@/lib/zip"), import("@/lib/catalog-pdf"), import("@/lib/lyrics-pdf"), import("@/lib/brand-load")]);
  // Their Personal Branding header on the lyric and catalog PDFs inside the ZIP, when they have a kit.
  const brand = await myBrand("catalog");
  const taken = new Set<string>();
  const entries: { name: string; data: Uint8Array }[] = [];
  const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
  let skipped = 0;
  for (const [i, t] of tracks.entries()) {
    onProgress?.(i, tracks.length);
    const name = safeName(t.title);
    for (const [path, file] of [[t.metadata.audioPath, `${name}.${/\.wav$/i.test(t.metadata.audioPath ?? "") ? "wav" : "mp3"}`], [t.metadata.artPath, `Artwork/${name}.${t.metadata.artPath?.split(".").pop() ?? "jpg"}`]] as const) {
      if (!path) continue;
      const { data, error } = await supabase.storage.from(BUCKET).download(path);
      if (error || !data) { skipped += 1; continue; }
      entries.push({ name: uniqueName(file, taken), data: await bytes(data) });
    }
    if (t.metadata.lyrics?.trim()) entries.push({ name: uniqueName(`Lyrics/${name} - lyrics.pdf`, taken), data: await bytes((await buildLyricsPdf(t, brand)).output("blob")) });
  }
  if (tracks.length) entries.push({ name: uniqueName("Catalog.pdf", taken), data: await bytes((await buildCatalogPdf(tracks, brand)).output("blob")) });
  onProgress?.(tracks.length, tracks.length);
  saveBlob(makeZip(entries), zipName);
  return { songs: tracks.length, skipped };
}

/** Every song in the catalog as one ZIP. */
export async function downloadWholeCatalog(onProgress?: (done: number, total: number) => void) {
  const tracks = await listTracks();
  if (!tracks.length) throw new Error("Your catalog is empty, so there is nothing to zip yet.");
  return downloadSongsZip(tracks, "My Catalog.zip", onProgress);
}

/** One album or EP as its own ZIP, so a release can be handed over in one click without the whole catalog. */
export async function downloadRelease(release: Release, onProgress?: (done: number, total: number) => void) {
  if (!release.tracks.length) throw new Error("That release has no songs in it yet.");
  return downloadSongsZip(release.tracks, `${safeName(release.album)} (${release.type}).zip`, onProgress);
}
