import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { checkBadges } from "@/lib/badges.functions";
import { BADGE_CHECK_EVENT } from "@/lib/badge-events";

const timeZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };

/** The user's badges and progress, re-checked whenever a save fires requestBadgeCheck(). */
export function useBadges(userId: string | undefined) {
  const client = useQueryClient();
  const key = ["badges", userId];
  useEffect(() => {
    if (!userId) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    // Saves often come in bursts (a batch embed), so wait for them to settle before asking the server.
    const onCheck = () => { clearTimeout(t); t = setTimeout(() => void client.invalidateQueries({ queryKey: key }), 1500); };
    window.addEventListener(BADGE_CHECK_EVENT, onCheck);
    return () => { clearTimeout(t); window.removeEventListener(BADGE_CHECK_EVENT, onCheck); };
  }, [userId, client]); // eslint-disable-line react-hooks/exhaustive-deps
  return useQuery({ queryKey: key, queryFn: () => checkBadges({ data: { timeZone: timeZone() } }), enabled: !!userId, staleTime: 60_000, retry: 1 });
}
