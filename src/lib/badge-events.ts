import { supabase } from "@/integrations/supabase/client";

/** Fired after any save that might earn a badge; the badge watcher re-checks with the server (debounced). */
export const BADGE_CHECK_EVENT = "cta:badge-check";
export function requestBadgeCheck() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(BADGE_CHECK_EVENT));
}

/** Actions that leave no other record. Logging never blocks the action itself. */
export type BadgeEventKind = "agency_export" | "master_download" | "blueprint_read";
export function logBadgeEvent(kind: BadgeEventKind) {
  void supabase.from("badge_events" as never).insert({ kind } as never).then(({ error }) => {
    if (error) console.error("Badge event not logged", error.message);
    else requestBadgeCheck();
  });
}

/** Marks earned badges as celebrated, so the pop-up doesn't show again. */
export async function markBadgesSeen(userId: string, ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase.from("user_badges" as never).update({ seen_at: new Date().toISOString() } as never).eq("user_id", userId).in("badge_id", ids);
  if (error) console.error("Couldn't mark badges seen", error.message);
}
