import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * The account's artist name, read the same way on every page: the saved artist name on the account (the database
 * enforces name-change limits, so it has the final say), then the name from setup, then legal name, then signup
 * details, then email.
 */
export function useArtistName(user: User | null | undefined, setupName?: string | undefined) {
  const [row, setRow] = useState<{ stage_name: string | null; legal_name: string | null } | null>(null);
  useEffect(() => {
    if (!user) return;
    let live = true;
    supabase.from("profiles").select("stage_name, legal_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (live) setRow(data); });
    return () => { live = false; };
  }, [user, setupName]);
  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const pick = (...v: (string | null | undefined)[]) => v.find((x) => x?.trim())?.trim() ?? "";
  return {
    /** Artist name only (empty when none is set yet), for share cards and badges. */
    artist: pick(row?.stage_name, setupName, meta["stage_name"]),
    /** What to show as the account's name: the artist name, or legal name / email when there isn't one. */
    display: pick(row?.stage_name, setupName, row?.legal_name, meta["stage_name"], meta["legal_name"], user?.email),
  };
}
