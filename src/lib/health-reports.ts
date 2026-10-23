import { supabase } from "@/integrations/supabase/client";
import type { CheckupSummary } from "@/lib/royalty-checkup";

/** Saved Royalty Health Reports (public.royalty_health_reports): summaries only, newest first. */
export type SavedReport = { id: string; score: number; summary: CheckupSummary; createdAt: string };
type Row = { id: string; score: number; summary: CheckupSummary; created_at: string };
const toReport = (r: Row): SavedReport => ({ id: r.id, score: r.score, summary: r.summary, createdAt: r.created_at });

export async function listReports(): Promise<SavedReport[]> {
  const { data, error } = await supabase.from("royalty_health_reports" as never).select("id, score, summary, created_at").order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return ((data ?? []) as Row[]).map(toReport);
}

export async function saveReport(summary: CheckupSummary): Promise<SavedReport> {
  const { data, error } = await supabase.from("royalty_health_reports" as never).insert({ score: summary.score, summary } as never).select("id, score, summary, created_at").single();
  if (error) throw error;
  return toReport(data as Row);
}

/** Same organs, states and findings: nothing worth a new entry in Past reports. */
export const sameSummary = (a: CheckupSummary, b: CheckupSummary) => a.score === b.score && JSON.stringify(a.organs) === JSON.stringify(b.organs);
