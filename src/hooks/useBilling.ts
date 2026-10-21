import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPaymentsEnvironment } from "@/lib/checkout";
import { isActiveSub, tierFromPrice, type Tier } from "@/lib/plans";

/** The plan in force: when it renews, or when it ends if it was cancelled. */
export type PlanStatus = { periodEnd: string | null; cancelling: boolean } | null;
export type Purchase = { id: string; kind: string; price_ids: string[]; details: Record<string, string>; created_at: string };

/** Current plan + one-time purchases for the signed-in user, refreshed after checkout. */
export function useBilling(userId: string | undefined) {
  const [tier, setTier] = useState<Tier>("free");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [plan, setPlan] = useState<PlanStatus>(null);
  const env = getPaymentsEnvironment();

  const load = useCallback(async () => {
    if (!userId) return;
    const [subs, buys] = await Promise.all([
      supabase.from("subscriptions" as never).select("price_id, status, current_period_end, cancel_at_period_end").eq("user_id", userId).eq("environment", env).order("created_at", { ascending: false }),
      supabase.from("purchases" as never).select("id, kind, price_ids, details, created_at").eq("user_id", userId).eq("environment", env).order("created_at", { ascending: false }),
    ]);
    const rows = (subs.data ?? []) as { price_id: string; status: string; current_period_end: string | null; cancel_at_period_end: boolean | null }[];
    const live = rows.filter((r) => isActiveSub(r));
    const active = live.map((r) => tierFromPrice(r.price_id));
    const order: Tier[] = ["management", "collaborate", "plus"];
    const best = order.find((t) => active.includes(t)) ?? "free";
    setTier(best);
    const row = live.find((r) => tierFromPrice(r.price_id) === best);
    setPlan(row ? { periodEnd: row.current_period_end, cancelling: !!row.cancel_at_period_end || row.status === "canceled" } : null);
    // A fully refunded purchase no longer unlocks anything (the webhook marks it).
    setPurchases(((buys.data ?? []) as Purchase[]).filter((p) => !p.details["refunded_at"]));
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

  return { tier, plan, purchases, loaded, reload: load };
}
