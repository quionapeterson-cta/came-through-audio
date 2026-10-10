import { supabase } from "@/integrations/supabase/client";
import { emptyContributor, emptyMetadata, type Metadata } from "@/lib/metadata";

export type CatalogTrack = { id: string; title: string; artist: string; updatedAt: string; metadata: Metadata };

const names = (rows: Metadata["writers"]) => rows.filter((r) => r.name);

export function toCatalogRow(m: Metadata, userId: string) {
  const writers = names(m.writers);
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
  const saved = (row.details ?? {}) as Partial<Metadata>;
  const base = emptyMetadata();
  const metadata: Metadata = {
    ...base,
    ...saved,
    title: (row.track_title as string) ?? "",
    artist: (row.artist_name as string) ?? "",
    featured: saved.featured?.length ? saved.featured : [""],
    writers: saved.writers?.length ? saved.writers : [emptyContributor()],
    composers: saved.composers?.length ? saved.composers : [emptyContributor()],
    publishers: saved.publishers?.length ? saved.publishers : [emptyContributor()],
  };
  return { id: row.id as string, title: metadata.title, artist: metadata.artist, updatedAt: (row.updated_at ?? row.created_at) as string, metadata };
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
  return (data as { id: string }).id;
}

export async function deleteTrack(id: string) {
  const { error } = await supabase.from("catalogs").delete().eq("id", id);
  if (error) throw error;
}
