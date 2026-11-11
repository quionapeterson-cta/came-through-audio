import { supabase } from "@/integrations/supabase/client";
import type { CatalogTrack } from "@/lib/catalog";
import { albumKey, routedKinds } from "@/lib/release-routing";
import { isInspectorSong } from "@/lib/health-songs";
import type { Checkup, CheckupSummary } from "@/lib/royalty-checkup";

/**
 * What a Royalty Health Check covers: one song, a release, the whole catalog, or a song outside it (Royalty Inspector).
 * `refs` are catalog ids (or "h:" Inspector ids), so "Run it again" checks the same songs.
 */
export type ReportScope = { kind: "catalog" | "release" | "song" | "outside"; refs: string[]; label: string };
export const SCOPE_WORD: Record<ReportScope["kind"], string> = { catalog: "Catalog Examination", release: "Release", song: "Single Track Checkup", outside: "Single Track Checkup" };
export const scopeName = (s: ReportScope) => (s.kind === "catalog" ? "Catalog Examination" : s.kind === "outside" ? `Single Track Checkup: ${s.label}` : s.label);
export const songScope = (t: Pick<CatalogTrack, "id" | "title">): ReportScope => ({ kind: isInspectorSong(t.id) ? "outside" : "song", refs: [t.id], label: t.title || "Untitled" });
export const catalogScope = (tracks: CatalogTrack[]): ReportScope => ({ kind: "catalog", refs: tracks.filter((t) => !isInspectorSong(t.id)).map((t) => t.id), label: "" });
/** The album or EP a song is on (the same grouping as the song list); singles have none. */
export function releaseScope(t: CatalogTrack, all: CatalogTrack[]): ReportScope | undefined {
  const kind = routedKinds(all, (x) => ({ ...x.metadata, title: x.title }), (x) => x.id).get(t.id) ?? "Single", album = albumKey(t.metadata.album);
  if (isInspectorSong(t.id) || kind === "Single") return undefined;
  const songs = all.filter((x) => !isInspectorSong(x.id) && albumKey(x.metadata.album) === album);
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

/**
 * The whole report behind a saved summary (public.royalty_health_report_snapshots, founder 2026-11-11), so Past Royalty
 * Health Reports at the Front Desk can open and download it again. Saved best-effort beside the summary: until the
 * 20261111120000 migration is applied, or for reports saved before it, there is simply no snapshot.
 */
export type ReportSnapshot = { checkup: Checkup; artist: string; country: string };

export async function saveSnapshot(reportId: string, snap: ReportSnapshot): Promise<boolean> {
  const { error } = await supabase.from("royalty_health_report_snapshots" as never)
    .insert({ report_id: reportId, checkup: snap.checkup, artist: snap.artist.slice(0, 300), country: snap.country.slice(0, 120) } as never);
  return !error;
}

/** Which of these reports have a snapshot, so the desk only offers View and Download where there is one to give. */
export async function listSnapshotIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from("royalty_health_report_snapshots" as never).select("report_id");
  if (error) return new Set();
  return new Set(((data ?? []) as unknown as { report_id: string }[]).map((r) => r.report_id));
}

export async function loadSnapshot(reportId: string): Promise<ReportSnapshot | null> {
  const { data, error } = await supabase.from("royalty_health_report_snapshots" as never).select("checkup, artist, country").eq("report_id", reportId).maybeSingle();
  if (error || !data) return null;
  return data as unknown as ReportSnapshot;
}
