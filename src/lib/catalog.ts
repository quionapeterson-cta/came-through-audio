import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requestBadgeCheck } from "@/lib/badge-events";
import { creditName, emptyContributor, emptyMetadata, isoDate, splitTrack, withLegalName, type Metadata } from "@/lib/metadata";
import { albumKey, routedKinds } from "@/lib/release-routing";

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
    // The column is a date, so a year-only or year-month release date from Spotify has to be completed first.
    release_date: isoDate(m.releaseDate) || null,
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

/**
 * Songs in one account's catalog. Always scoped: the seat policies let an owner read their artists' songs too, so an
 * unfiltered read would mix every seat into their own My Catalog (founder, 2026-11-08). Pass the working profile's id,
 * or leave it out for the signed-in account itself.
 */
export async function listTracks(ownerId?: string): Promise<CatalogTrack[]> {
  const userId = ownerId ?? (await supabase.auth.getUser()).data.user?.id;
  let query = supabase.from("catalogs").select("*").order("created_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  // Supabase hands back a plain object, not an Error, so throwing it raw left every caller's `e instanceof Error` check
  // false and the real reason (a bad date, a refused insert) was replaced by "try again".
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => fromCatalogRow(r as Record<string, unknown>));
}

export async function saveTrack(m: Metadata, userId: string, id?: string): Promise<string> {
  const row = toCatalogRow(m, userId) as never;
  const query = id
    ? supabase.from("catalogs").update(row).eq("id", id).select("id").single()
    : supabase.from("catalogs").insert(row).select("id").single();
  const { data, error } = await query;
  // A real Error, so the caller can show what the database actually refused instead of a generic "try again".
  if (error) throw new Error(error.message);
  requestBadgeCheck();
  return (data as { id: string }).id;
}

/** Deletes a song and its stored master and artwork (everything in its private folder). */
export async function deleteTrack(id: string, ownerId?: string) {
  const { error } = await supabase.from("catalogs").delete().eq("id", id);
  if (error) throw error;
  // Files go after the row, so a failed delete never leaves a song without its master. The folder belongs to the song's
  // own account, which is the artist's when an owner is working in a seat.
  const { data: auth } = await supabase.auth.getUser();
  const owner = ownerId ?? auth.user?.id;
  const folder = owner ? `${owner}/${id}` : "";
  if (!folder) return;
  const { data: files } = await supabase.storage.from(BUCKET).list(folder);
  if (files?.length) {
    const { error: fileError } = await supabase.storage.from(BUCKET).remove(files.map((f) => `${folder}/${f.name}`));
    if (fileError) console.error("Song deleted, but its files weren't removed", fileError.message);
  }
}

const BUCKET = "catalog-files";

/** "Therapy" + "Clean" → "Therapy (Clean)"; an untitled song still gets a name. */
export const versionTitle = (title: string, version: string) => `${title.trim() || "Untitled"} (${version})`;

export type DuplicateResult = { id: string; files: boolean };

/**
 * A second catalog entry made from a song, for another version of the same recording — radio edit, clean, instrumental,
 * sped up (founder, 2026-11-10). The details, cover tile and release fields come across, so the copy sits in the same
 * album; the ISRC is cleared, because each version is its own recording and needs its own code. The master and artwork
 * are copied into the new entry's own folder, so deleting or replacing either song never touches the other's files.
 * Returns the new id, and whether the files came across (they can fail on their own without losing the entry).
 */
export async function duplicateTrack(track: CatalogTrack, userId: string, version = "Copy"): Promise<DuplicateResult> {
  const base: Metadata = { ...track.metadata, title: versionTitle(track.title, version), isrc: "", audioPath: "", artPath: "" };
  const id = await saveTrack(base, userId);
  const copied: { audioPath?: string; artPath?: string } = {};
  for (const [kind, path] of [["master", track.metadata.audioPath], ["artwork", track.metadata.artPath]] as const) {
    if (!path) continue;
    const ext = path.split(".").pop() || (kind === "master" ? "mp3" : "jpg");
    const to = `${userId}/${id}/${kind}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).copy(path, to);
    if (error) { console.error("Song duplicated, but its file wasn't copied", error.message); continue; }
    if (kind === "master") copied.audioPath = to;
    else copied.artPath = to;
  }
  if (Object.keys(copied).length) await saveTrack({ ...base, ...copied }, userId, id);
  return { id, files: Object.keys(copied).length > 0 };
}

/** Store a master or artwork file privately under the owner's folder; returns its storage path. */
export async function uploadCatalogFile(userId: string, trackId: string, kind: "master" | "artwork", file: Blob, ext: string) {
  const path = `${userId}/${trackId}/${kind}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type || (kind === "master" ? "audio/mpeg" : "image/jpeg") });
  if (error) throw error;
  return path;
}

/** The image types a catalog cover accepts. The song form and a release's own cover read the same list. */
export const COVER_IMAGE_TYPES = ["image/jpeg", "image/png"] as const;

/**
 * One cover for a whole release (founder, 2026-11-11): an EP or an album takes a single upload and the same picture is
 * written to every song on it, because a release has one cover and filling the same upload into ten songs is the part
 * nobody gets round to. The first song's folder takes the file and every other folder is copied from it inside the
 * bucket, so the member uploads once and the bytes travel server-side.
 *
 * Every row is saved before this resolves. A song that already had a cover is replaced, because the member is choosing
 * the release's cover rather than filling a gap. Each song is written as its own file lands (founder, 2026-11-11), so a
 * song that fails leaves the ones around it saved instead of throwing the whole release away after it has already
 * overwritten half the folders with a cover no row mentions; the songs that didn't take it come back by name.
 *
 * `thumb` is the small tile the catalog shows beside a song and on the release's own header. It comes from the caller
 * because it is made in the browser, and it is written alongside the cover so the group shows its artwork at once.
 */
export async function setReleaseArtwork(
  tracks: CatalogTrack[],
  userId: string,
  file: File,
  thumb = "",
): Promise<{ songs: number; covers: { id: string; artPath: string }[]; failed: string[] }> {
  if (!(COVER_IMAGE_TYPES as readonly string[]).includes(file.type))
    throw new Error("Choose JPEG or PNG artwork.");
  const [first, ...rest] = tracks;
  if (!first) throw new Error("This release has no songs to put a cover on.");
  const ext = file.type === "image/png" ? "png" : "jpg";

  let source: string;
  try {
    source = await uploadCatalogFile(userId, first.id, "artwork", file, ext);
  } catch (e) {
    throw new Error(
      `Your cover couldn't be stored: ${e instanceof Error ? e.message : "try again in a moment."}`,
    );
  }

  const covers: { id: string; artPath: string }[] = [];
  const failed: string[] = [];
  // A row is saved right after its own file, so what the catalog reads always matches the folder it lives in.
  const write = async (track: CatalogTrack, path: string) => {
    try {
      await saveTrack(
        { ...track.metadata, artPath: path, ...(thumb ? { coverThumb: thumb } : {}) },
        userId,
        track.id,
      );
      covers.push({ id: track.id, artPath: path });
      // Only one artwork file per song is ever read, and a cover in the other format would otherwise sit in the folder
      // for good after a JPEG replaces a PNG (or the other way round). Failing to clear it is harmless, so it is quiet.
      try {
        await supabase.storage.from(BUCKET).remove([`${userId}/${track.id}/artwork.${path.endsWith(".png") ? "jpg" : "png"}`]);
      } catch { /* a stray copy nobody points at */ }
    } catch (e) {
      failed.push(`${track.title || "the untitled song"} (${e instanceof Error ? e.message : "the save was refused"})`);
    }
  };

  await write(first, source);
  for (const t of rest) {
    const to = `${userId}/${t.id}/artwork.${ext}`;
    let { error } = await supabase.storage.from(BUCKET).copy(source, to);
    // `copy` has no upsert and refuses a destination that already exists, which is every song that had this cover
    // before or caught a leftover from an interrupted run — the exact case a member hits when a release's art looks
    // "already set" but the songs show none. The stale object goes and the copy is made once more (founder, 2026-11-12).
    if (error) {
      await supabase.storage.from(BUCKET).remove([to]);
      ({ error } = await supabase.storage.from(BUCKET).copy(source, to));
    }
    if (error) {
      failed.push(`${t.title || "the untitled song"} (${error.message})`);
      continue;
    }
    await write(t, to);
  }

  // Nothing saved at all is the one case that is still a plain failure, so an untouched release never reads as done.
  if (!covers.length) throw new Error(`The cover didn't reach any song: ${failed.join("; ")}`);
  return { songs: covers.length, covers, failed };
}

export async function downloadCatalogFile(path: string, filename: string) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  saveBlob(data, filename);
}

/** The last file we handed over, kept so a blocked download can be saved again with one tap. */
let pending: { url: string; name: string } | null = null;
/** The "Your file is ready" message: one at a time, and gone on a fixed clock. */
const READY_TOAST = "file-ready";
let readyTimer: ReturnType<typeof setTimeout> | undefined;

/** Preview panes are iframes, and a sandboxed iframe swallows downloads its host didn't allow. */
const inFrame = () => { try { return window.self !== window.top; } catch { return true; } };

/** Clicks a link that is in the document: a detached anchor is ignored, which is what made buttons look dead. */
function clickSave(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.append(a);
  a.click();
  a.remove();
}

/**
 * Hands a finished file to the browser, then says so honestly: the browser can still refuse it (a preview pane blocks
 * downloads, Safari drops the odd click), so the member gets a real Save button to press instead of a message claiming
 * a download that never arrived (founder, 2026-11-06).
 */
export function saveBlob(blob: Blob, filename: string) {
  if (pending) URL.revokeObjectURL(pending.url);
  const url = URL.createObjectURL(blob);
  pending = { url, name: filename };
  clickSave(url, filename);
  // The message leaves on its own (founder, 2026-11-06: it lingered after the file arrived). Sonner pauses its timer while
  // the pointer is over it or the browser's download sheet has focus, so a plain timer closes it, and a new file replaces
  // the old message rather than stacking under it. The preview pane keeps it longer, since there Save is the only way.
  const frame = inFrame();
  const ms = frame ? 20000 : 7000;
  toast("Your file is ready", {
    id: READY_TOAST,
    description: frame
      ? `${filename} — this preview window blocks downloads. Open Came Through Audio in its own tab, or tap Save.`
      : `${filename} — if it didn't arrive, tap Save.`,
    duration: ms,
    action: { label: "Save", onClick: () => { if (pending) clickSave(pending.url, pending.name); } },
  });
  clearTimeout(readyTimer);
  readyTimer = setTimeout(() => toast.dismiss(READY_TOAST), ms);
}

export const safeName = (s: string) => s.replace(/[<>:"/\\|?*]+/g, "_").trim() || "track";

/** A release in the catalog: an album or an EP, its songs in track order. */
export type Release = { key: string; album: string; type: "Album" | "EP"; tracks: CatalogTrack[] };

/**
 * The catalog grouped into releases (one per album title, A–Z). Songs with no album are singles, which are downloaded
 * one at a time from their own row, so they are not a release here.
 */
export function groupReleases(tracks: CatalogTrack[]): Release[] {
  const kinds = routedKinds(tracks, (t) => t.metadata, (t) => t.id);
  const groups = new Map<string, CatalogTrack[]>();
  for (const t of tracks) {
    const kind = kinds.get(t.id);
    if (kind !== "Album" && kind !== "EP") continue;
    const key = albumKey(t.metadata.album);
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const trackNo = (t: CatalogTrack) => Number(t.metadata.trackNumber) || 999;
  return [...groups.entries()]
    .map(([key, list]) => {
      const ordered = [...list].sort((a, b) => trackNo(a) - trackNo(b) || a.title.localeCompare(b.title));
      return { key, album: (ordered[0]!.metadata.album ?? "").trim(), type: kinds.get(ordered[0]!.id) === "EP" ? "EP" as const : "Album" as const, tracks: ordered };
    })
    .sort((a, b) => a.album.localeCompare(b.album));
}

/** What one song was missing from a ZIP, each with the form field that fixes it (`audio`, `artwork`, `lyrics`). */
export type DownloadGap = { track: CatalogTrack; items: { field: string; message: string }[] };
export type ZipResult = { songs: number; skipped: number; gaps: DownloadGap[] };

/**
 * One ZIP for a set of songs: every master (named exactly as the title, `Song Title.mp3`), its artwork, its lyrics PDF
 * and the catalog PDF, in folders by file type and then by Singles, EPs and Albums. Files that can't be fetched are skipped, so one bad file never blocks the rest, and every song
 * that came out incomplete is named with what to add, so the member can fill it in and download again (founder,
 * 2026-11-06: "2 files couldn't be fetched" told them nothing they could act on).
 */
async function downloadSongsZip(tracks: CatalogTrack[], zipName: string, onProgress?: (done: number, total: number) => void, kitId?: string): Promise<ZipResult> {
  const [{ makeZip, uniqueName }, { buildCatalogPdf }, { buildLyricsPdf }, { myBrand }, { releaseKind }] = await Promise.all([import("@/lib/zip"), import("@/lib/catalog-pdf"), import("@/lib/lyrics-pdf"), import("@/lib/brand-load"), import("@/lib/health-checklist")]);
  // The ZIP is laid out like the catalog (founder, 2026-11-06): "MP3 & WAV", "Artwork" and "Lyrics" at the top, each split
  // into Singles, EPs and Albums, with every EP and album in its own folder. Catalog.pdf sits at the root.
  const shelf = (t: CatalogTrack) => {
    const kind = releaseKind(t.metadata);
    if (kind === "Single") return "Singles";
    return `${kind === "EP" ? "EPs" : "Albums"}/${safeName(t.metadata.album?.trim() || `Untitled ${kind === "EP" ? "EP" : "album"}`)}`;
  };
  // Their Personal Branding header on the lyric and catalog PDFs inside the ZIP, when they have a kit.
  const brand = await myBrand("catalog", kitId ?? null);
  const taken = new Set<string>();
  const entries: { name: string; data: Uint8Array }[] = [];
  const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
  let skipped = 0;
  const gaps: DownloadGap[] = [];
  for (const [i, t] of tracks.entries()) {
    onProgress?.(i, tracks.length);
    const name = safeName(t.title);
    const where = shelf(t);
    const items: DownloadGap["items"] = [];
    const files = [
      { field: "audio", path: t.metadata.audioPath, file: `MP3 & WAV/${where}/${name}.${/\.wav$/i.test(t.metadata.audioPath ?? "") ? "wav" : "mp3"}`, none: "No master saved yet: open the song and choose its MP3 or WAV.", lost: "Its saved master couldn't be found: open the song and choose its MP3 or WAV again." },
      { field: "artwork", path: t.metadata.artPath, file: `Artwork/${where}/${name}.${t.metadata.artPath?.split(".").pop() ?? "jpg"}`, none: "", lost: "Its saved cover art couldn't be found: open the song and add the cover again." },
    ];
    for (const f of files) {
      // A song without cover art is normal (singles often share one), so only a cover that went missing is reported.
      if (!f.path) { if (f.none) items.push({ field: f.field, message: f.none }); continue; }
      const { data, error } = await supabase.storage.from(BUCKET).download(f.path);
      if (error || !data) { skipped += 1; items.push({ field: f.field, message: f.lost }); continue; }
      entries.push({ name: uniqueName(f.file, taken), data: await bytes(data) });
    }
    if (t.metadata.lyrics?.trim()) entries.push({ name: uniqueName(`Lyrics/${where}/${name} - lyrics.pdf`, taken), data: await bytes((await buildLyricsPdf(t, brand)).output("blob")) });
    else if (!t.metadata.instrumental) items.push({ field: "lyrics", message: "No lyrics yet: paste them in the song's Lyrics section (or mark it Instrumental)." });
    if (items.length) gaps.push({ track: t, items });
  }
  if (tracks.length) entries.push({ name: uniqueName("Catalog.pdf", taken), data: await bytes((await buildCatalogPdf(tracks, brand)).output("blob")) });
  onProgress?.(tracks.length, tracks.length);
  saveBlob(makeZip(entries), zipName);
  return { songs: tracks.length, skipped, gaps };
}

/** Every song in the catalog as one ZIP. */
export async function downloadWholeCatalog(onProgress?: (done: number, total: number) => void, kitId?: string, ownerId?: string) {
  const tracks = await listTracks(ownerId);
  if (!tracks.length) throw new Error("Your catalog is empty, so there is nothing to zip yet.");
  return downloadSongsZip(tracks, "My Catalog.zip", onProgress, kitId);
}

/** One album or EP as its own ZIP, so a release can be handed over in one click without the whole catalog. */
export async function downloadRelease(release: Release, onProgress?: (done: number, total: number) => void, kitId?: string) {
  if (!release.tracks.length) throw new Error("That release has no songs in it yet.");
  return downloadSongsZip(release.tracks, `${safeName(release.album)} (${release.type}).zip`, onProgress, kitId);
}
