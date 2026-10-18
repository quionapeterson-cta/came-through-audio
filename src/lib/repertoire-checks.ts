import { supabase } from "@/integrations/supabase/client";
import type { RepertoireCheck } from "@/lib/health";

const fromRow = (r: { track_id: string; society: string; status: string; source: string; work_id: string | null; details: unknown; checked_at: string }): RepertoireCheck => ({
  trackId: r.track_id, society: r.society, status: r.status as RepertoireCheck["status"], source: r.source as RepertoireCheck["source"],
  workId: r.work_id, details: r.details, checkedAt: r.checked_at,
});

export async function listChecks(): Promise<RepertoireCheck[]> {
  const { data, error } = await supabase.from("repertoire_checks").select("track_id, society, status, source, work_id, details, checked_at");
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

/** The user's own "Found it" / "Not listed" mark for one song in one society. */
export async function markCheck(userId: string, trackId: string, society: string, status: RepertoireCheck["status"], workId?: string): Promise<RepertoireCheck> {
  const { data, error } = await supabase.from("repertoire_checks")
    .upsert({ user_id: userId, track_id: trackId, society, status, source: "self", work_id: workId?.trim() || null, checked_at: new Date().toISOString() }, { onConflict: "track_id,society" })
    .select("track_id, society, status, source, work_id, details, checked_at").single();
  if (error) throw error;
  return fromRow(data);
}

/** Undo a mark, back to "not checked yet". */
export async function clearCheck(trackId: string, society: string) {
  const { error } = await supabase.from("repertoire_checks").delete().eq("track_id", trackId).eq("society", society);
  if (error) throw error;
}
