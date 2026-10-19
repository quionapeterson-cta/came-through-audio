import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { isActiveSub, tierFromPrice, type Tier } from "@/lib/plans";

export type Purchase = { id: string; kind: string; price_ids: string[]; details: Record<string, string>; created_at: string };

/** Current plan + one-time purchases for the signed-in user, refreshed after checkout. */
export function useBilling(userId: string | undefined) {
  const [tier, setTier] = useState<Tier>("free");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loaded, setLoaded] = useState(false);
  const env = getPaddleEnvironment();

  const load = useCallback(async () => {
    if (!userId) return;
    const [subs, buys] = await Promise.all([
      supabase.from("subscriptions" as never).select("price_id, status, current_period_end").eq("user_id", userId).eq("environment", env).order("created_at", { ascending: false }),
      supabase.from("purchases" as never).select("id, kind, price_ids, details, created_at").eq("user_id", userId).eq("environment", env).order("created_at", { ascending: false }),
    ]);
    const rows = (subs.data ?? []) as { price_id: string; status: string; current_period_end: string | null }[];
    const active = rows.filter((r) => isActiveSub(r)).map((r) => tierFromPrice(r.price_id));
    const order: Tier[] = ["management", "collaborate", "plus"];
    setTier(order.find((t) => active.includes(t)) ?? "free");
    setPurchases((buys.data ?? []) as Purchase[]);
    if (!subs.error) setLoaded(true);
  }, [userId, env]);

  useEffect(() => {
    load();
    if (!userId) return;
    const ch = supabase.channel(`billing-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases", filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    // Webhooks land a few seconds after checkout; poll briefly too.
    const t = setInterval(load, 8000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [load, userId]);

  return { tier, purchases, loaded, reload: load };
}
