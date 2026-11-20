import { createStripeClient, type StripeEnv } from "@/lib/stripe.server";
import { isActiveSub, PLAN_TIERS, TIER_LABEL, TIER_RANK, tierFromPrice } from "@/lib/plans";
import { getPaymentsEnvironment } from "@/lib/payments-env";
import {
  addDays, dueRenewalReminder, earlyRenewalTarget, extendedRenewal, keptOnFree, RENEWAL_REMINDER_DAYS, GRACE_DAYS, offers, pauseSpan, shiftedEmptyAfter,
  type Lapse, type Pause, type PlanSub,
} from "@/lib/retention";
import { sendRetentionEmail } from "@/lib/retention-email.server";

/**
 * Server side of Need more time, Pause and catalog emptying (PLAN-catalog-emptying.md). Uses the server's admin
 * access, so every entry point checks who it's acting for first: server functions pass the signed-in user, the
 * webhook passes the user on the verified payment, the cron job is behind CRON_SECRET.
 */
type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
export const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

const BUCKET = "catalog-files";
const unix = (d: Date) => Math.floor(d.getTime() / 1000);

type SubRow = PlanSub & { price_id: string };
export type AccountState = { sub: SubRow | null; lapse: (Lapse & { reminders: string[] }) | null; pauses: Pause[] };

/** The account's best paid Stripe plan that still grants access (free trials have no Stripe subscription). */
export async function loadState(db: Admin, userId: string, env: StripeEnv): Promise<AccountState> {
  const [subs, lapse, pauses] = await Promise.all([
    db.from("subscriptions").select("stripe_subscription_id, status, price_id, current_period_start, current_period_end, cancel_at_period_end")
      .eq("user_id", userId).eq("environment", env).not("stripe_subscription_id", "is", null),
    db.from("catalog_lapses" as never).select("plan_ended_at, empty_after, emptied_at, kept_free_at, reminders").eq("user_id", userId).maybeSingle(),
    db.from("account_pauses" as never).select("id, kind, months, starts_at, ends_at, ended_at, created_at, vault_subscription_id").eq("user_id", userId).eq("environment", env).order("created_at", { ascending: false }),
  ]);
  const live = ((subs.data ?? []) as SubRow[]).filter((s) => isActiveSub(s));
  const sub = live.sort((a, b) => TIER_RANK[tierFromPrice(b.price_id)] - TIER_RANK[tierFromPrice(a.price_id)])[0] ?? null;
  return { sub, lapse: (lapse.data as AccountState["lapse"]) ?? null, pauses: (pauses.data ?? []) as Pause[] };
}

async function emailOf(db: Admin, userId: string) {
  const { data } = await db.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

/**
 * The pause that is running or still to come, read straight from the table: what checkout refuses a second one against
 * (founder, 2026-11-20).
 */
export async function liveVaultPause(db: Admin, userId: string, env: StripeEnv) {
  const { data, error } = await db.from("account_pauses" as never)
    .select("id, starts_at, ends_at, vault_subscription_id")
    .eq("user_id", userId).eq("environment", env).eq("kind", "pause")
    .is("ended_at", null).gt("ends_at", new Date().toISOString())
    .order("ends_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return (data ?? null) as { id: string; starts_at: string; ends_at: string; vault_subscription_id: string | null } | null;
}

/**
 * A pause's Vault subscription that Stripe still bills, even when its pause row has not been written yet: the gap a
 * double click or a second tab would otherwise slip through. Search is by our own metadata, never by the browser.
 */
export async function liveVaultSubscription(env: StripeEnv, userId: string): Promise<string | null> {
  try {
    const found = await createStripeClient(env).subscriptions.search({
      query: `metadata['userId']:'${userId}' AND metadata['kind']:'vault'`,
      limit: 10,
    });
    const live = found.data.find((s) => ["active", "trialing", "past_due", "unpaid", "incomplete"].includes(s.status));
    return live?.id ?? null;
  } catch (e) {
    // The pause row still guards the normal case; never block a real purchase because a search is unavailable.
    console.error(`Vault subscription lookup for ${userId} failed; the pause row alone guarded this checkout`, e);
    return null;
  }
}

/** Cancels a duplicate Vault subscription, loudly enough that staff can refund the month if one was taken. */
async function cancelDuplicateVault(env: StripeEnv, subscriptionId: string, reason: string) {
  console.error(`Vault subscription ${subscriptionId}: ${reason} Cancelling it so only one pause is live; refund its month from Admin → Billing if it charged.`);
  try { await createStripeClient(env).subscriptions.cancel(subscriptionId); }
  catch (e) { console.error(`Vault subscription ${subscriptionId}: it could not be cancelled, so staff must cancel it by hand`, e); }
}

async function recordPause(db: Admin, row: Record<string, unknown>): Promise<string> {
  const { data, error } = await db.from("account_pauses" as never).insert(row as never).select("id").single();
  if (error) throw error;
  return (data as unknown as { id: string }).id;
}

/** After a failed renewal, the unpaid renewal invoice is voided so Stripe stops retrying it during the new free time. */
async function voidOpenInvoices(env: StripeEnv, subscriptionId: string) {
  const stripe = createStripeClient(env);
  const open = await stripe.invoices.list({ subscription: subscriptionId, status: "open", limit: 10 });
  for (const inv of open.data) if (inv.id) await stripe.invoices.voidInvoice(inv.id);
}

/** Need more time: the renewal moves back 30 days, free (or the emptying date, when the plan has already ended). */
export async function extend(db: Admin, userId: string, env: StripeEnv) {
  const s = await loadState(db, userId, env);
  const o = offers(s.sub, s.lapse, s.pauses);
  if (!o.canExtend) throw new Error(o.extendAgain ? "Need more time can be used once every 12 months." : "Need more time isn't available on this account right now.");
  const until = s.sub?.stripe_subscription_id ? extendedRenewal(s.sub) : addDays(s.lapse!.empty_after, 30);
  // Recorded first (so it can't be used twice), and taken back if the change itself doesn't go through.
  const record = await recordPause(db, { user_id: userId, kind: "extend", starts_at: new Date().toISOString(), ends_at: until.toISOString(),
    stripe_subscription_id: s.sub?.stripe_subscription_id ?? null, environment: env });
  try {
    if (s.sub?.stripe_subscription_id) {
      await createStripeClient(env).subscriptions.update(s.sub.stripe_subscription_id, { trial_end: unix(until), proration_behavior: "none" });
      if (s.sub.status === "past_due") await voidOpenInvoices(env, s.sub.stripe_subscription_id);
    } else {
      const { error } = await db.from("catalog_lapses" as never).update({ empty_after: until.toISOString(), updated_at: new Date().toISOString() } as never).eq("user_id", userId);
      if (error) throw error;
    }
  } catch (e) { await db.from("account_pauses" as never).delete().eq("id", record); throw e; }
  const email = await emailOf(db, userId);
  if (email) await sendRetentionEmail(email, { kind: "extended", renewsOn: until.toISOString(), plan: !!s.sub }, `extend-${userId}-${until.toISOString().slice(0, 10)}`);
  return { until: until.toISOString() };
}

/**
 * Starts the pause a Vault payment bought (called by the payment webhook). Re-checked here, but never refused:
 * the fee is already paid, so a pause that can't fit the rules is logged for staff to sort out by hand.
 */
export async function startPause(db: Admin, purchase: { id: string; user_id: string; details: Record<string, string> }, env: StripeEnv) {
  const months = Math.min(3, Math.max(1, Number(purchase.details["months"]) || 1));
  const { data: existing } = await db.from("account_pauses" as never).select("id").eq("purchase_id", purchase.id).maybeSingle();
  if (existing) return;
  const s = await loadState(db, purchase.user_id, env);
  if (!offers(s.sub, s.lapse, s.pauses).canPause) console.error(`Vault payment ${purchase.id}: pause outside the rules, starting it anyway (paid).`);
  const { starts, ends } = pauseSpan(s.sub, months);
  // One row per Vault payment (unique), written before Stripe changes so a webhook retry can't pause twice.
  const record = await recordPause(db, { user_id: purchase.user_id, kind: "pause", months, starts_at: starts.toISOString(), ends_at: ends.toISOString(),
    stripe_subscription_id: s.sub?.stripe_subscription_id ?? null, purchase_id: purchase.id, environment: env });
  try {
    if (s.sub?.stripe_subscription_id) {
      await createStripeClient(env).subscriptions.update(s.sub.stripe_subscription_id, { trial_end: unix(ends), proration_behavior: "none" });
      if (s.sub.status === "past_due") await voidOpenInvoices(env, s.sub.stripe_subscription_id);
    } else if (s.lapse && !s.lapse.emptied_at) {
      const { error } = await db.from("catalog_lapses" as never).update({ empty_after: shiftedEmptyAfter(s.lapse, ends).toISOString(), updated_at: new Date().toISOString() } as never).eq("user_id", purchase.user_id);
      if (error) throw error;
    }
  } catch (e) { await db.from("account_pauses" as never).delete().eq("id", record); throw e; }
  const email = await emailOf(db, purchase.user_id);
  if (email) await sendRetentionEmail(email, { kind: "paused", startsOn: starts.toISOString(), endsOn: ends.toISOString(), plan: !!s.sub }, `pause-${purchase.id}`);
}

/**
 * Starts the pause a Vault subscription bought (founder, 2026-11-20). The subscription is its own monthly $1.99 one,
 * already cancelled by Stripe at the pause end; this writes the pause the app reads and stops the plan's own charge for
 * the same span. Re-checked here, but never refused: it is already being billed, so a pause outside the rules is logged
 * for staff. Idempotent on the subscription id, so a retried webhook can't start a second pause or bill twice.
 */
export type VaultPauseInput = { user_id: string; subscriptionId: string; months: number; starts: string; ends: string };

export async function startVaultPause(db: Admin, p: VaultPauseInput, env: StripeEnv) {
  const { data: existing } = await db.from("account_pauses" as never).select("id").eq("vault_subscription_id", p.subscriptionId).maybeSingle();
  if (existing) return;
  const months = Math.min(3, Math.max(1, Number(p.months) || 1));
  const starts = new Date(p.starts);
  const ends = new Date(p.ends);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
    console.error(`Vault subscription ${p.subscriptionId}: its pause dates are unusable, so no pause was started.`);
    return;
  }
  const s = await loadState(db, p.user_id, env);
  if (!offers(s.sub, s.lapse, s.pauses).canPause) console.error(`Vault subscription ${p.subscriptionId}: pause outside the rules, starting it anyway (paid).`);
  // One live pause per account: a second subscription (two tabs, or a retried checkout) is cancelled here rather than
  // billed beside the first. The database's own unique index is the final arbiter if both arrive at once.
  const live = await liveVaultPause(db, p.user_id, env);
  if (live && live.vault_subscription_id !== p.subscriptionId) {
    await cancelDuplicateVault(env, p.subscriptionId, `this account already has a live pause (${live.id}).`);
    return;
  }
  // One row per Vault subscription (unique), written before Stripe changes so a retry can't pause twice.
  let record: string;
  try {
    record = await recordPause(db, { user_id: p.user_id, kind: "pause", months, starts_at: starts.toISOString(), ends_at: ends.toISOString(),
      stripe_subscription_id: s.sub?.stripe_subscription_id ?? null, vault_subscription_id: p.subscriptionId, environment: env });
  } catch (e) {
    // 23505: the other checkout won the race and its pause is the live one.
    if ((e as { code?: string } | null)?.code === "23505") {
      await cancelDuplicateVault(env, p.subscriptionId, "another pause was started for this account at the same moment.");
      return;
    }
    throw e;
  }
  try {
    if (s.sub?.stripe_subscription_id) {
      await createStripeClient(env).subscriptions.update(s.sub.stripe_subscription_id, { trial_end: unix(ends), proration_behavior: "none" });
      if (s.sub.status === "past_due") await voidOpenInvoices(env, s.sub.stripe_subscription_id);
    } else if (s.lapse && !s.lapse.emptied_at) {
      const { error } = await db.from("catalog_lapses" as never).update({ empty_after: shiftedEmptyAfter(s.lapse, ends).toISOString(), updated_at: new Date().toISOString() } as never).eq("user_id", p.user_id);
      if (error) throw error;
    }
  } catch (e) { await db.from("account_pauses" as never).delete().eq("id", record); throw e; }
  const email = await emailOf(db, p.user_id);
  if (email) await sendRetentionEmail(email, { kind: "paused", startsOn: starts.toISOString(), endsOn: ends.toISOString(), plan: !!s.sub }, `pause-${p.subscriptionId}`);
}

/** Closes the pause behind a Vault subscription that reached its end (Stripe cancelled it, or the cron did). */
export async function closeVaultPause(db: Admin, subscriptionId: string, at: string) {
  const { error } = await db.from("account_pauses" as never)
    .update({ ended_at: at } as never).eq("vault_subscription_id", subscriptionId).is("ended_at", null);
  if (error) throw error;
}

/**
 * A month Stripe could not collect, after every retry (founder, 2026-11-20): the pause ends and the account moves to the
 * Free plan, never a free pause. The plan's own subscription is cancelled so nothing renews behind the member's back.
 */
export async function failVaultPause(db: Admin, subscriptionId: string, env: StripeEnv) {
  const { data } = await db.from("account_pauses" as never)
    .select("id, user_id, stripe_subscription_id, ended_at").eq("vault_subscription_id", subscriptionId).maybeSingle();
  const pause = data as { id: string; user_id: string; stripe_subscription_id: string | null; ended_at: string | null } | null;
  if (!pause || pause.ended_at) return;
  const now = new Date().toISOString();
  const { error } = await db.from("account_pauses" as never).update({ ended_at: now } as never).eq("id", pause.id);
  if (error) throw error;
  const stripe = createStripeClient(env);
  for (const id of [subscriptionId, pause.stripe_subscription_id]) {
    if (!id) continue;
    try { await stripe.subscriptions.cancel(id); }
    catch (e) { console.error(`Pause ${pause.id}: subscription ${id} could not be cancelled after the Vault fee failed`, e); }
  }
  const email = await emailOf(db, pause.user_id);
  if (email) await sendRetentionEmail(email, { kind: "vault-failed" }, `vault-failed-${subscriptionId}`);
}

/**
 * Resume now: ends the pause. A pause that has started charges the renewal today; one still waiting for the renewal
 * date is called off and the plan renews on its original date. The Vault subscription is cancelled either way, so no
 * later month is charged, and the month in progress isn't refunded.
 */
export async function resume(db: Admin, userId: string, env: StripeEnv) {
  const s = await loadState(db, userId, env);
  const now = new Date();
  const pause = s.pauses.find((p) => p.kind === "pause" && !p.ended_at && new Date(p.ends_at) > now);
  if (!pause) throw new Error("There's no pause to resume.");
  const started = new Date(pause.starts_at) <= now;
  // Its own subscription, so cancelling it is what stops the next month's Vault charge.
  if (pause.vault_subscription_id) {
    try { await createStripeClient(env).subscriptions.cancel(pause.vault_subscription_id); }
    catch (e) { console.error(`Pause ${pause.id}: its Vault subscription could not be cancelled on resume`, e); }
  }
  if (s.sub?.stripe_subscription_id) {
    await createStripeClient(env).subscriptions.update(s.sub.stripe_subscription_id,
      started ? { trial_end: "now", proration_behavior: "none" } : { trial_end: unix(new Date(pause.starts_at)), proration_behavior: "none" });
  } else if (s.lapse && !s.lapse.emptied_at) {
    // No plan to resume: the grace period picks up where it stopped.
    const left = Math.max(0, new Date(s.lapse.empty_after).getTime() - new Date(pause.ends_at).getTime());
    await db.from("catalog_lapses" as never).update({ empty_after: new Date(now.getTime() + left).toISOString(), updated_at: now.toISOString() } as never).eq("user_id", userId);
  }
  const { error } = await db.from("account_pauses" as never).update({ ended_at: now.toISOString() } as never).eq("id", pause.id);
  if (error) throw error;
}

/** Cancel (at the end of the paid year) or keep the plan. The webhook sends the "plan ends" email. */
export async function setCancelling(db: Admin, userId: string, env: StripeEnv, cancel: boolean) {
  const s = await loadState(db, userId, env);
  if (!s.sub?.stripe_subscription_id) throw new Error("No plan to change.");
  await createStripeClient(env).subscriptions.update(s.sub.stripe_subscription_id, { cancel_at_period_end: cancel });
}

/**
 * Keep it on Free (founder, 2026-11-08): before the emptying date, the member may choose the Free plan instead. The
 * catalog stays read-only and is never emptied, and a paid plan can be started whenever they are ready. Choosing it is
 * not a refund and changes no payment.
 */
export async function keepOnFree(db: Admin, userId: string) {
  const [{ data }, { data: tier }] = await Promise.all([
    db.from("catalog_lapses" as never).select("plan_ended_at, empty_after, emptied_at, kept_free_at").eq("user_id", userId).maybeSingle(),
    db.rpc("user_tier" as never, { _uid: userId } as never),
  ]);
  const lapse = data as { empty_after: string; emptied_at: string | null; kept_free_at: string | null } | null;
  if (!lapse) throw new Error("There's no plan ending here, so there is nothing to keep on Free.");
  if (lapse.emptied_at) throw new Error("This catalog was already emptied, so there is nothing left to keep.");
  if (String(tier) !== "free") throw new Error("Your plan is running, so there is nothing to keep on Free.");
  if (lapse.kept_free_at) return { kept: true, emptyAfter: lapse.empty_after };
  const now = new Date().toISOString();
  const { error } = await db.from("catalog_lapses" as never)
    .update({ kept_free_at: now, updated_at: now } as never).eq("user_id", userId);
  if (error) throw error;
  const email = await emailOf(db, userId);
  if (email) await sendRetentionEmail(email, { kind: "kept-free" }, `kept-free-${userId}`);
  return { kept: true, emptyAfter: lapse.empty_after };
}

/** Removes every catalog song with its files and health ticks. Split sheets keep a snapshot of the song (trigger). */
export async function emptyCatalog(db: Admin, userId: string): Promise<number> {
  const { data: songs, error } = await db.from("catalogs").select("id").eq("user_id", userId);
  if (error) throw error;
  const ids = (songs ?? []).map((s) => s.id as string);
  for (const id of ids) {
    const folder = `${userId}/${id}`;
    const { data: files } = await db.storage.from(BUCKET).list(folder);
    if (files?.length) await db.storage.from(BUCKET).remove(files.map((f) => `${folder}/${f.name}`));
  }
  if (ids.length) await db.from("health_song_status" as never).delete().eq("user_id", userId).in("song_ref", ids);
  const { error: delError } = await db.from("catalogs").delete().eq("user_id", userId);
  if (delError) throw delError;
  return ids.length;
}

/**
 * Daily job: clears the lapse row for anyone who has a plan again, and keeps every other ended plan read-only on Free.
 * Nothing is emptied (founder, 2026-11-08, replacing catalog emptying): the songs, masters and artwork stay, the account
 * can download them, and a paid plan can start whenever the member is ready. An unused account's stored files (and the
 * account itself, if it never signs in) are only removed by the separate two-year inactivity job, never by a plan ending.
 */
export async function runCatalogLapses(now = new Date()) {
  const db = await admin();
  const result = { cleared: 0, kept: 0 };
  const tierOf = async (uid: string) => (await db.rpc("user_tier" as never, { _uid: uid } as never)).data as unknown as string;

  const { data: rows, error } = await db.from("catalog_lapses" as never).select("user_id, plan_ended_at, empty_after, emptied_at, kept_free_at, reminders");
  if (error) throw error;
  const lapses = (rows ?? []) as unknown as (Lapse & { user_id: string; reminders: string[] })[];
  // The ids cleared here must not be kept (or emailed) below: their plan is running again.
  const paid = new Set<string>();
  for (const l of lapses) {
    if ((await tierOf(l.user_id)) !== "free") {
      await db.from("catalog_lapses" as never).delete().eq("user_id", l.user_id);
      paid.add(l.user_id);
      result.cleared += 1;
    }
  }
  const known = new Set(lapses.map((l) => l.user_id));
  const { data: candidates } = await db.rpc("catalog_lapse_candidates" as never);
  for (const c of (candidates ?? []) as unknown as { user_id: string; plan_ended_at: string }[]) {
    if (known.has(c.user_id)) continue;
    // empty_after is written only so the row keeps its shape; nothing acts on it any more.
    const from = new Date(Math.max(new Date(c.plan_ended_at).getTime(), now.getTime()));
    const emptyAfter = addDays(from, GRACE_DAYS).toISOString();
    const { error: insError } = await db.from("catalog_lapses" as never).insert({ user_id: c.user_id, plan_ended_at: c.plan_ended_at, empty_after: emptyAfter } as never);
    if (!insError) { result.kept += 1; lapses.push({ user_id: c.user_id, plan_ended_at: c.plan_ended_at, empty_after: emptyAfter, emptied_at: null, reminders: [] }); }
  }

  for (const l of lapses) {
    // Already emptied under the old rule: nothing left to keep, and never a promise that it came back.
    if (paid.has(l.user_id) || l.emptied_at || l.kept_free_at) continue;
    await db.from("catalog_lapses" as never).update({ kept_free_at: now.toISOString(), updated_at: now.toISOString() } as never).eq("user_id", l.user_id);
    result.kept += 1;
    const email = await emailOf(db, l.user_id);
    if (email) await sendRetentionEmail(email, { kind: "kept-free" }, `kept-free-${l.user_id}`);
  }
  return result;
}

/**
 * Daily job: the pause its own subscription did not close. Stripe cancels a Vault subscription at the pause end by
 * itself (`cancel_at`), so this is the reconciliation pass: a row past its end is closed, any subscription still live is
 * cancelled, and a missing `cancel_at` is logged so it can't happen twice.
 */
export async function runVaultEndings(now = new Date()) {
  const db = await admin();
  const env = getPaymentsEnvironment();
  const { data, error } = await db.from("account_pauses" as never)
    .select("id, ends_at, vault_subscription_id")
    .eq("kind", "pause").eq("environment", env).is("ended_at", null).lte("ends_at", now.toISOString());
  if (error) throw error;
  const rows = (data ?? []) as unknown as { id: string; ends_at: string; vault_subscription_id: string | null }[];
  let ended = 0;
  let cancelled = 0;
  for (const p of rows) {
    if (p.vault_subscription_id) {
      try {
        const stripe = createStripeClient(env);
        const sub = await stripe.subscriptions.retrieve(p.vault_subscription_id);
        if (!sub.cancel_at) console.error(`Pause ${p.id}: its Vault subscription had no cancel_at, so the cron cancelled it at the pause end.`);
        if (["active", "trialing", "past_due", "unpaid"].includes(sub.status)) {
          await stripe.subscriptions.cancel(p.vault_subscription_id);
          cancelled += 1;
        }
      } catch (e) { console.error(`Pause ${p.id}: its Vault subscription could not be closed at the pause end`, e); }
    }
    await db.from("account_pauses" as never).update({ ended_at: p.ends_at } as never).eq("id", p.id).is("ended_at", null);
    ended += 1;
  }
  return { vaultPausesEnded: ended, vaultSubscriptionsCancelled: cancelled };
}

/** The webhook's "your plan ends" email, sent once when a subscription is set to cancel. */
export async function sendCancelledEmail(db: Admin, userId: string, subscriptionId: string, endsOn: string) {
  const email = await emailOf(db, userId);
  if (email) await sendRetentionEmail(email, { kind: "cancelled", endsOn }, `cancelled-${subscriptionId}-${endsOn.slice(0, 10)}`);
}

/**
 * Plan A: reminds people 90, 60, 30, 7 and 1 day before their yearly plan renews (cancelling plans and free trials are
 * skipped). Each reminder goes out once per renewal date, so a moved renewal starts a fresh set.
 */
export async function sendRenewalReminders(now = new Date()) {
  const db = await admin();
  const env = getPaymentsEnvironment();
  const horizon = addDays(now, RENEWAL_REMINDER_DAYS[0] + 1).toISOString();
  const { data, error } = await db.from("subscriptions")
    .select("id, user_id, price_id, status, current_period_end, cancel_at_period_end, renewal_reminders, renewal_reminders_for")
    .eq("environment", env).not("stripe_subscription_id", "is", null).in("status", ["active", "trialing"])
    .gt("current_period_end", now.toISOString()).lte("current_period_end", horizon);
  if (error) throw error;
  let sent = 0;
  for (const row of (data ?? []) as unknown as { id: string; user_id: string; price_id: string; current_period_end: string; cancel_at_period_end: boolean | null; renewal_reminders: string[] | null; renewal_reminders_for: string | null }[]) {
    if (row.cancel_at_period_end) continue;
    const tier = tierFromPrice(row.price_id);
    const price = PLAN_TIERS.find((p) => p.tier === tier)?.price;
    if (tier === "free" || !price) continue;
    const renews = new Date(row.current_period_end);
    const due = dueRenewalReminder(renews, row.renewal_reminders ?? [], row.renewal_reminders_for, now);
    if (due === null) continue;
    const email = await emailOf(db, row.user_id);
    if (!email) continue;
    const ok = await sendRetentionEmail(email, { kind: "renewal", plan: TIER_LABEL[tier], price, renewsOn: row.current_period_end, daysLeft: due },
      `renewal-${due}-${row.id}-${row.current_period_end.slice(0, 10)}`);
    if (!ok) continue;
    const same = row.renewal_reminders_for && new Date(row.renewal_reminders_for).getTime() === renews.getTime();
    await db.from("subscriptions").update({ renewal_reminders: [...(same ? row.renewal_reminders ?? [] : []), String(due)], renewal_reminders_for: row.current_period_end } as never).eq("id", row.id);
    sent += 1;
  }
  return { renewalReminders: sent };
}

/**
 * Plan B for a failed renewal: an email on the first failed attempt and a reminder on Stripe's third, both offering
 * Update card, Need more time and Pause. Only yearly renewals, not first payments.
 */
export async function sendPaymentFailedEmail(userId: string, priceId: string, invoiceId: string, attempt: number) {
  if (attempt !== 1 && attempt !== 3) return;
  const db = await admin();
  const email = await emailOf(db, userId);
  const tier = tierFromPrice(priceId);
  if (!email || tier === "free") return;
  await sendRetentionEmail(email, { kind: "payment-failed", plan: TIER_LABEL[tier], reminder: attempt > 1 }, `payment-failed-${invoiceId}-${attempt}`);
}

type PaidRenewal = { id: string; user_id: string; details: Record<string, string> };

/** The date a Stripe subscription next charges: the end of a trial (Need more time, Pause, Renew now) or of the period. */
async function stripeRenewal(env: StripeEnv, subscriptionId: string) {
  const sub = await createStripeClient(env).subscriptions.retrieve(subscriptionId);
  const end = sub.status === "trialing" && sub.trial_end ? sub.trial_end : sub.items.data[0]?.current_period_end;
  return end ? new Date(end * 1000) : null;
}

/**
 * Renew now, paid (called by the payment webhook): the next charge moves a full year past the renewal that was paid
 * for, so no days are lost. Safe to run twice: a renewal already at or past that date is left alone.
 */
export async function applyEarlyRenewal(db: Admin, purchase: PaidRenewal, env: StripeEnv) {
  const { subscription, renews } = purchase.details;
  if (!subscription || !renews || purchase.details["applied_at"]) return;
  const target = earlyRenewalTarget(renews);
  const current = await stripeRenewal(env, subscription);
  if (!current || current < target) {
    await createStripeClient(env).subscriptions.update(subscription, { trial_end: unix(target), proration_behavior: "none" });
  }
  await db.from("purchases").update({ details: { ...purchase.details, applied_at: new Date().toISOString() } } as never).eq("id", purchase.id);
  const email = await emailOf(db, purchase.user_id);
  if (email) await sendRetentionEmail(email, { kind: "renewed", renewsOn: target.toISOString() }, `renewed-${purchase.id}`);
}

/** A fully refunded Renew now puts the renewal back on the date it had before, if that's still ahead. */
export async function undoEarlyRenewal(purchase: PaidRenewal, env: StripeEnv) {
  const { subscription, renews } = purchase.details;
  if (!subscription || !renews || !purchase.details["applied_at"]) return;
  const back = new Date(renews);
  if (back > new Date()) await createStripeClient(env).subscriptions.update(subscription, { trial_end: unix(back), proration_behavior: "none" });
  else console.error(`Refunded Renew now ${purchase.id}: its old renewal date has passed; set the renewal by hand in Stripe.`);
}
