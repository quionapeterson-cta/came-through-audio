import { supabase } from "@/integrations/supabase/client";
import type { CatalogTrack } from "@/lib/catalog";
import { emptyMetadata, type Metadata } from "@/lib/metadata";
import type { RepertoireCheck } from "@/lib/health";

/**
 * Songs saved from the Royalty Inspector (public.health_songs) and every song's checklist state
 * (public.health_song_status). Inspector songs get ids prefixed "h:" so they never collide with catalog ids,
 * and are shaped as CatalogTracks so the same health report and checklist code handles both.
 */
export const INSPECTOR_PREFIX = "h:";
export const isInspectorSong = (id: string) => id.startsWith(INSPECTOR_PREFIX);

export type InspectorFields = Pick<Metadata, "title" | "artist" | "duration" | "isrc" | "iswc" | "writers" | "publishers">;

type SongRow = { id: string; title: string; artist: string; metadata: Partial<Metadata>; updated_at: string };
const toTrack = (r: SongRow): CatalogTrack => ({
  id: INSPECTOR_PREFIX + r.id, title: r.title, artist: r.artist, updatedAt: r.updated_at,
  metadata: { ...emptyMetadata(), ...r.metadata, title: r.title, artist: r.artist, composers: [] },
});

export async function listInspectorSongs(): Promise<CatalogTrack[]> {
  const { data, error } = await supabase.from("health_songs" as never).select("id, title, artist, metadata, updated_at").order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as SongRow[]).map(toTrack);
}

export async function saveInspectorSong(fields: InspectorFields, id?: string): Promise<CatalogTrack> {
  const row = { title: fields.title.trim(), artist: fields.artist.trim(), metadata: fields };
  const q = id
    ? supabase.from("health_songs" as never).update(row as never).eq("id", id.slice(INSPECTOR_PREFIX.length))
    : supabase.from("health_songs" as never).insert(row as never);
  const { data, error } = await q.select("id, title, artist, metadata, updated_at").single();
  if (error) throw error;
  return toTrack(data as SongRow);
}

export async function deleteInspectorSong(id: string) {
  const { error } = await supabase.from("health_songs" as never).delete().eq("id", id.slice(INSPECTOR_PREFIX.length));
  if (error) throw error;
}

export type SongStatus = { songRef: string; list: "active" | "later"; note: string; remindOn: string | null; steps: Record<string, string> };
type StatusRow = { song_ref: string; list: SongStatus["list"]; note: string; remind_on: string | null; steps: Record<string, string> };
const toStatus = (r: StatusRow): SongStatus => ({ songRef: r.song_ref, list: r.list, note: r.note, remindOn: r.remind_on, steps: r.steps ?? {} });
export const emptyStatus = (songRef: string): SongStatus => ({ songRef, list: "active", note: "", remindOn: null, steps: {} });

export async function listStatuses(): Promise<SongStatus[]> {
  const { data, error } = await supabase.from("health_song_status" as never).select("song_ref, list, note, remind_on, steps");
  if (error) throw error;
  return ((data ?? []) as StatusRow[]).map(toStatus);
}

export async function saveStatus(s: SongStatus): Promise<SongStatus> {
  const { data, error } = await supabase.from("health_song_status" as never)
    .upsert({ song_ref: s.songRef, list: s.list, note: s.note.slice(0, 300), remind_on: s.remindOn, steps: s.steps, updated_at: new Date().toISOString() } as never, { onConflict: "user_id,song_ref" })
    .select("song_ref, list, note, remind_on, steps").single();
  if (error) throw error;
  return toStatus(data as StatusRow);
}

/**
 * Inspector songs can't use repertoire_checks (it points at catalog songs), so their "Found it" / "Not listed"
 * marks live in the status steps as "found:<society>" / "not_listed:<society>" and are read back as checks here.
 */
export function inspectorChecks(statuses: SongStatus[]): RepertoireCheck[] {
  return statuses.filter((s) => isInspectorSong(s.songRef)).flatMap((s) => Object.entries(s.steps).flatMap(([k, at]) => {
    const [status, society] = k.split(":");
    return (status === "found" || status === "not_listed") && society ? [{ trackId: s.songRef, society, status, source: "self" as const, checkedAt: at }] : [];
  }));
}
