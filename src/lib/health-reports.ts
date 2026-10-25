import { supabase } from "@/integrations/supabase/client";
import type { CatalogTrack } from "@/lib/catalog";
import { releaseKind } from "@/lib/health-checklist";
import { isInspectorSong } from "@/lib/health-songs";
import type { CheckupSummary } from "@/lib/royalty-checkup";

/**
 * What a Royalty Health Check covers: one song, a release, the whole catalog, or a song outside it (Royalty Inspector).
 * `refs` are catalog ids (or "h:" Inspector ids), so "Run it again" checks the same songs.
 */
export type ReportScope = { kind: "catalog" | "release" | "song" | "outside"; refs: string[]; label: string };
export const SCOPE_WORD: Record<ReportScope["kind"], string> = { catalog: "Whole catalog", release: "Release", song: "Song", outside: "Outside song" };
export const scopeName = (s: ReportScope) => (s.kind === "catalog" ? "Whole catalog" : s.kind === "outside" ? `Outside song: ${s.label}` : s.label);
export const songScope = (t: Pick<CatalogTrack, "id" | "title">): ReportScope => ({ kind: isInspectorSong(t.id) ? "outside" : "song", refs: [t.id], label: t.title || "Untitled" });
export const catalogScope = (tracks: CatalogTrack[]): ReportScope => ({ kind: "catalog", refs: tracks.filter((t) => !isInspectorSong(t.id)).map((t) => t.id), label: "" });
/** The album or EP a song is on (the same grouping as the song list); singles have none. */
export function releaseScope(t: CatalogTrack, all: CatalogTrack[]): ReportScope | undefined {
  const kind = releaseKind(t.metadata), album = t.metadata.album.trim().toLowerCase();
  if (isInspectorSong(t.id) || kind === "Single") return undefined;
  const songs = all.filter((x) => !isInspectorSong(x.id) && releaseKind(x.metadata) === kind && x.metadata.album.trim().toLowerCase() === album);
  return { kind: "release", refs: songs.map((x) => x.id), label: `${t.metadata.album.trim() || `Untitled ${kind}`} (${kind})` };
}

/** Same songs checked: the one to compare a new report with. */
export const sameScope = (a: ReportScope, b: ReportScope) => a.kind === b.kind && (a.kind === "catalog" || [...a.refs].sort().join() === [...b.refs].sort().join());

/** Saved Royalty Health Reports (public.royalty_health_reports): summaries only, newest first. */
export type SavedReport = { id: string; score: number; summary: CheckupSummary; createdAt: string; scope: ReportScope };
type Row = { id: string; score: number; summary: CheckupSummary; created_at: string; scope?: ReportScope["kind"]; label?: string; song_refs?: string[] };
const COLUMNS = "id, score, summary, created_at, scope, label, song_refs";
// Until the 20261024160000 migration is applied, reports save and list without their scope.
const OLD = "id, score, summary, created_at";
const toReport = (r: Row): SavedReport => ({ id: r.id, score: r.score, summary: r.summary, createdAt: r.created_at, scope: { kind: r.scope ?? "catalog", label: r.label ?? "", refs: r.song_refs ?? [] } });

export async function listReports(): Promise<SavedReport[]> {
  const list = (cols: string) => supabase.from("royalty_health_reports" as never).select(cols).order("created_at", { ascending: false }).limit(50);
  let { data, error } = await list(COLUMNS);
  if (error) ({ data, error } = await list(OLD));
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(toReport);
}

export async function saveReport(summary: CheckupSummary, scope: ReportScope): Promise<SavedReport> {
  const row = { score: summary.score, summary, scope: scope.kind, label: scope.label.slice(0, 200), song_refs: scope.kind === "catalog" ? [] : scope.refs };
  let { data, error } = await supabase.from("royalty_health_reports" as never).insert(row as never).select(COLUMNS).single();
  if (error) ({ data, error } = await supabase.from("royalty_health_reports" as never).insert({ score: row.score, summary } as never).select(OLD).single());
  if (error) throw error;
  return { ...toReport(data as unknown as Row), scope };
}

/** Removes one of the user's own reports from My reports (row-level security keeps it to their own). */
export async function deleteReport(id: string) {
  const { error } = await supabase.from("royalty_health_reports" as never).delete().eq("id", id);
  if (error) throw error;
}

/** Same organs, states and findings: nothing worth a new entry in My reports. */
export const sameSummary = (a: CheckupSummary, b: CheckupSummary) => a.score === b.score && JSON.stringify(a.organs) === JSON.stringify(b.organs);
