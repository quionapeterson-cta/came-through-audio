import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPaymentsEnvironment } from "@/lib/checkout";
import { isActiveSub, tierFromPrice, type Tier } from "@/lib/plans";
import { isPaused, type Lapse, type Pause, type PlanSub } from "@/lib/retention";

/** The plan in force: when it renews, or when it ends if it was cancelled. */
export type PlanStatus = { periodEnd: string | null; cancelling: boolean } | null;
/** A Founding 100 seat: paying for `paid_tier` unlocks `granted_tier` (PLAN-founding-upgrades). */
export type FoundingSeat = { paid_tier: Tier; granted_tier: Tier; seat: number };
export type Purchase = { id: string; kind: string; price_ids: string[]; details: Record<string, string>; created_at: string };

type SubRow = PlanSub & { price_id: string };

/**
 * Current plan + one-time purchases for the signed-in user, refreshed after checkout. Also the plan's Stripe
 * subscription, Need more time / Pause history and the grace period, for Profile and the workspace banner.
 * A paused account counts as Free (the server's user_tier says the same).
 */
export function useBilling(userId: string | undefined) {
  const [tier, setTier] = useState<Tier>("free");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [plan, setPlan] = useState<PlanStatus>(null);
  const [sub, setSub] = useState<PlanSub | null>(null);
  const [pauses, setPauses] = useState<Pause[]>([]);
  const [lapse, setLapse] = useState<Lapse | null>(null);
  const [founding, setFounding] = useState<FoundingSeat | null>(null);
  const [paidTier, setPaidTier] = useState<Tier>("free");
  const env = getPaymentsEnvironment();

  const load = useCallback(async () => {
    if (!userId) return;
    const [subs, buys, paused, lapsed, seats] = await Promise.all([
      supabase.from("subscriptions" as never).select("price_id, status, current_period_start, current_period_end, cancel_at_period_end, stripe_subscription_id").eq("user_id", userId).eq("environment", env).order("created_at", { ascending: false }),
      supabase.from("purchases" as never).select("id, kind, price_ids, details, created_at").eq("user_id", userId).eq("environment", env).order("created_at", { ascending: false }),
      // Missing until the retention migrations run; then these simply come back empty.
      supabase.from("account_pauses" as never).select("id, kind, months, starts_at, ends_at, ended_at, created_at").eq("user_id", userId).eq("environment", env).order("created_at", { ascending: false }),
      supabase.from("catalog_lapses" as never).select("plan_ended_at, empty_after, emptied_at").eq("user_id", userId).maybeSingle(),
      // Missing until the founding migration runs; then empty for everyone outside the first 100.
      supabase.from("founding_upgrades" as never).select("paid_tier, granted_tier, seat").eq("user_id", userId).eq("environment", env).is("ended_at", null),
    ]);
    const rows = (subs.data ?? []) as SubRow[];
    const pauseRows = (paused.data ?? []) as Pause[];
    const live = rows.filter((r) => isActiveSub(r));
    const active = live.map((r) => tierFromPrice(r.price_id));
    const order: Tier[] = ["management", "collaborate", "plus"];
    const best = order.find((t) => active.includes(t)) ?? "free";
    // A founding seat for the tier they pay for lifts them one tier (the server's user_tier says the same).
    const seat = ((seats.data ?? []) as FoundingSeat[]).find((f) => f.paid_tier === best) ?? null;
    setFounding(seat);
    setPaidTier(isPaused(pauseRows) ? "free" : best);
    setTier(isPaused(pauseRows) ? "free" : seat ? seat.granted_tier : best);
    const row = live.find((r) => tierFromPrice(r.price_id) === best);
    // (plan and sub below follow the tier they pay for, so billing shows the real price)
    setPlan(row ? { periodEnd: row.current_period_end, cancelling: !!row.cancel_at_period_end || row.status === "canceled" } : null);
    setSub(live.find((r) => r.stripe_subscription_id && tierFromPrice(r.price_id) === best) ?? null);
    setPauses(pauseRows);
    setLapse((lapsed.data as Lapse | null) ?? null);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "account_pauses", filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    // Webhooks land a few seconds after checkout; poll briefly too.
    const t = setInterval(load, 8000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [load, userId]);

  return { tier, plan, purchases, loaded, reload: load, sub, pauses, lapse, founding, paidTier };
}
