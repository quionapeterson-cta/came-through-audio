import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { kitFromRow, type BrandKit } from "@/lib/brand-kit";

export type KitChoice = { id: string; name: string };

/**
 * The member's saved kits, oldest first, for choosing which one brands a document (founder, 2026-11-06). This is only a
 * menu: the server still decides whether a kit may be used, and falls back to their first kit when the one asked for
 * isn't within their allowance.
 */
export function useBrandKits(userId: string | undefined) {
  const [kits, setKits] = useState<KitChoice[]>([]);
  const [kitId, setKitId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    void (async () => {
      const { data } = await supabase.from("brand_kits" as never).select("*").eq("user_id", userId).order("created_at" as never, { ascending: true });
      if (!live) return;
      const list = ((data ?? []) as Record<string, unknown>[]).map((r) => kitFromRow(r as never)).filter((k): k is BrandKit => !!k?.id);
      setKits(list.map((k) => ({ id: k.id!, name: k.name || "Untitled kit" })));
    })();
    return () => { live = false; };
  }, [userId]);
  return { kits, kitId, setKitId };
}
