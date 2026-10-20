import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALL_BADGES, badgeById } from "@/lib/badges";
import { badgeMetrics, evaluateBadges, type BadgeData } from "@/lib/badge-rules";
import { fromCatalogRow } from "@/lib/catalog";

export type EarnedBadge = { id: string; times: number; earnedAt: string; seenAt: string | null };
export type BadgeCheck = { earned: EarnedBadge[]; metrics: Record<string, number>; disabled: string[] };

const validZone = (tz: string) => { try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; } };

/**
 * Re-counts the caller's own saved work and records any badge they've reached. Reads go through the caller's
 * session (RLS), and only this function writes user_badges (service role), so badges can't be self-granted.
 * Earned badges are never removed. Returns every badge the user holds, the counts behind them, and staff switch-offs.
 */
export const checkBadges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ timeZone: z.string().max(64).refine(validZone).catch("UTC") }).parse(d))
  .handler(async ({ data, context }): Promise<BadgeCheck> => {
    const db = context.supabase, uid = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const fail = (what: string) => { throw new Error(`Couldn't check badges (${what}).`); };

    const [catalogs, splits, contracts, checks, certs, events, profile, settings, held, account] = await Promise.all([
      db.from("catalogs").select("*").eq("user_id", uid),
      db.from("split_sheets").select("catalog_id, is_owner, role, signed_at"),
      db.from("contracts" as never).select("status, contract_parties(is_owner, signed_at)").eq("user_id", uid),
      db.from("repertoire_checks").select("track_id, society, status, source, work_id, details, checked_at").eq("user_id", uid),
      db.from("ai_protection_certificates").select("catalog_id, track_title, ots_receipt").eq("user_id", uid),
      db.from("badge_events" as never).select("kind").eq("user_id", uid),
      db.from("profiles").select("onboarding, stage_name, legal_name").eq("id", uid).maybeSingle(),
      db.from("badge_settings" as never).select("badge_id").eq("enabled", false),
      supabaseAdmin.from("user_badges" as never).select("badge_id, times, earned_at, seen_at").eq("user_id", uid),
      supabaseAdmin.auth.admin.getUserById(uid),
    ]);
    if (catalogs.error) fail("catalog");
    if (held.error) fail("badges");

    const ob = (profile.data?.onboarding ?? {}) as { welcomed?: boolean; stageName?: string; legalName?: string; healthCountry?: string };
    const count = (kind: string) => ((events.data ?? []) as { kind: string }[]).filter((e) => e.kind === kind).length;
    const input: BadgeData = {
      tracks: (catalogs.data ?? []).map((r) => ({ ...fromCatalogRow(r as Record<string, unknown>), createdAt: (r.created_at ?? r.updated_at) as string })),
      splits: (splits.data ?? []).filter((r) => r.catalog_id).map((r) => ({ catalogId: r.catalog_id!, isOwner: r.is_owner, role: r.role, signedAt: r.signed_at })),
      contracts: ((contracts.data ?? []) as { status: string; contract_parties: { is_owner: boolean; signed_at: string | null }[] }[])
        .map((c) => ({ status: c.status, parties: (c.contract_parties ?? []).map((p) => ({ isOwner: p.is_owner, signedAt: p.signed_at })) })),
      checks: (checks.data ?? []).map((r) => ({ trackId: r.track_id, society: r.society, status: r.status as "found" | "not_listed", source: r.source as "self" | "auto", workId: r.work_id, details: r.details, checkedAt: r.checked_at })),
      certificates: (certs.data ?? []).map((c) => ({ catalogId: c.catalog_id, trackTitle: c.track_title ?? "", timestamped: !!c.ots_receipt })),
      events: { agency_export: count("agency_export"), master_download: count("master_download"), blueprint_read: count("blueprint_read") },
      welcomed: !!ob.welcomed,
      names: [ob.stageName, ob.legalName, profile.data?.stage_name, profile.data?.legal_name].filter((n): n is string => !!n?.trim()),
      healthCountry: ob.healthCountry,
      accountCreatedAt: account.data.user?.created_at ?? new Date().toISOString(),
      timeZone: data.timeZone,
      now: new Date(),
    };

    const disabled = ((settings.data ?? []) as { badge_id: string }[]).map((s) => s.badge_id);
    const metrics = badgeMetrics(input);
    const mine = new Map(((held.data ?? []) as { badge_id: string; times: number; earned_at: string; seen_at: string | null }[]).map((r) => [r.badge_id, r]));
    const now = new Date().toISOString();
    const changes = evaluateBadges(metrics, new Set(disabled))
      .filter((s) => s.earned && s.times > (mine.get(s.badge.id)?.times ?? 0))
      // A badge earned again (repeatable) comes back unseen so it celebrates again.
      .map((s) => ({ user_id: uid, badge_id: s.badge.id, times: s.times, earned_at: mine.get(s.badge.id)?.earned_at ?? now, seen_at: s.badge.preSeen ? now : null }));
    if (changes.length) {
      const { error } = await supabaseAdmin.from("user_badges" as never).upsert(changes as never, { onConflict: "user_id,badge_id" });
      if (error) fail("saving");
      for (const c of changes) mine.set(c.badge_id, { badge_id: c.badge_id, times: c.times, earned_at: c.earned_at, seen_at: c.seen_at });
    }

    const earned = [...mine.values()].filter((r) => badgeById(r.badge_id))
      .map((r) => ({ id: r.badge_id, times: r.times, earnedAt: r.earned_at, seenAt: r.seen_at }));
    return { earned, metrics, disabled };
  });

/** Super admins and the Branding, Marketing & Sales and Support departments (public.can_manage_badges). */
async function assertBadgeStaff(context: { supabase: { rpc: (fn: never, args: never) => PromiseLike<{ data: unknown }> }; userId: string }) {
  const { data } = await context.supabase.rpc("can_manage_badges" as never, { _user_id: context.userId } as never);
  if (!data) throw new Error("Forbidden");
}

/** Admin → Badges: staff switch-offs, and how many users hold each badge (counts only, never who). */
export const listBadgeSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBadgeStaff(context as never);
    const [settings, counts] = await Promise.all([
      context.supabase.from("badge_settings" as never).select("badge_id, enabled, updated_at"),
      context.supabase.rpc("badge_earned_counts" as never),
    ]);
    if (settings.error || counts.error) throw new Error("Couldn't load badge settings.");
    return {
      settings: (settings.data ?? []) as unknown as { badge_id: string; enabled: boolean; updated_at: string }[],
      earned: Object.fromEntries(((counts.data ?? []) as { badge_id: string; users: number }[]).map((r) => [r.badge_id, Number(r.users)])) as Record<string, number>,
    };
  });

/** Turns badges on or off for new unlocks site-wide. Anyone who already earned one keeps it. */
export const setBadgesEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().refine((id) => ALL_BADGES.some((b) => b.id === id))).min(1).max(ALL_BADGES.length), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertBadgeStaff(context as never);
    const rows = data.ids.map((badge_id) => ({ badge_id, enabled: data.enabled, updated_by: context.userId, updated_at: new Date().toISOString() }));
    const { error } = await context.supabase.from("badge_settings" as never).upsert(rows as never, { onConflict: "badge_id" });
    if (error) throw new Error("Couldn't save the badge setting.");
    return { ok: true };
  });
