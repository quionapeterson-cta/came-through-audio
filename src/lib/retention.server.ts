import { createStripeClient, type StripeEnv } from "@/lib/stripe.server";
import { isActiveSub, PLAN_TIERS, TIER_LABEL, TIER_RANK, tierFromPrice } from "@/lib/plans";
import { getPaymentsEnvironment } from "@/lib/payments-env";
import {
  addDays, dueReminder, dueRenewalReminder, earlyRenewalTarget, extendedRenewal, RENEWAL_REMINDER_DAYS, GRACE_DAYS, offers, pauseSpan, shiftedEmptyAfter,
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
    db.from("catalog_lapses" as never).select("plan_ended_at, empty_after, emptied_at, reminders").eq("user_id", userId).maybeSingle(),
    db.from("account_pauses" as never).select("id, kind, months, starts_at, ends_at, ended_at, created_at").eq("user_id", userId).eq("environment", env).order("created_at", { ascending: false }),
  ]);
  const live = ((subs.data ?? []) as SubRow[]).filter((s) => isActiveSub(s));
  const sub = live.sort((a, b) => TIER_RANK[tierFromPrice(b.price_id)] - TIER_RANK[tierFromPrice(a.price_id)])[0] ?? null;
  return { sub, lapse: (lapse.data as AccountState["lapse"]) ?? null, pauses: (pauses.data ?? []) as Pause[] };
}

async function emailOf(db: Admin, userId: string) {
  const { data } = await db.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
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
 * Resume now: ends the pause. A pause that has started charges the renewal today; one still waiting for the renewal
 * date is called off and the plan renews on its original date. The Vault fee isn't refunded.
 */
export async function resume(db: Admin, userId: string, env: StripeEnv) {
  const s = await loadState(db, userId, env);
  const now = new Date();
  const pause = s.pauses.find((p) => p.kind === "pause" && !p.ended_at && new Date(p.ends_at) > now);
  if (!pause) throw new Error("There's no pause to resume.");
  const started = new Date(pause.starts_at) <= now;
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
 * Daily job: clears lapses for accounts that have a plan again, starts the 30 days for accounts whose plan ended,
 * sends the reminders that are due and empties catalogs on their date. Paused accounts are left alone.
 */
export async function runCatalogLapses(now = new Date()) {
  const db = await admin();
  const result = { cleared: 0, started: 0, reminded: 0, emptied: 0 };
  const tierOf = async (uid: string) => (await db.rpc("user_tier" as never, { _uid: uid } as never)).data as unknown as string;
  const pausedNow = async (uid: string) => !!(await db.rpc("is_paused" as never, { _uid: uid } as never)).data;

  const { data: rows, error } = await db.from("catalog_lapses" as never).select("user_id, plan_ended_at, empty_after, emptied_at, reminders");
  if (error) throw error;
  const lapses = (rows ?? []) as unknown as (Lapse & { user_id: string; reminders: string[] })[];
  for (const l of lapses) {
    if ((await tierOf(l.user_id)) !== "free" && !(await pausedNow(l.user_id))) {
      await db.from("catalog_lapses" as never).delete().eq("user_id", l.user_id);
      result.cleared += 1;
    }
  }
  const known = new Set(lapses.map((l) => l.user_id));
  const { data: candidates } = await db.rpc("catalog_lapse_candidates" as never);
  for (const c of (candidates ?? []) as unknown as { user_id: string; plan_ended_at: string }[]) {
    if (known.has(c.user_id)) continue;
    // Counted from when the plan ended, but never less than the full 30 days from today.
    const from = new Date(Math.max(new Date(c.plan_ended_at).getTime(), now.getTime()));
    const { error: insError } = await db.from("catalog_lapses" as never).insert({ user_id: c.user_id, plan_ended_at: c.plan_ended_at, empty_after: addDays(from, GRACE_DAYS).toISOString() } as never);
    if (!insError) { result.started += 1; lapses.push({ user_id: c.user_id, plan_ended_at: c.plan_ended_at, empty_after: addDays(from, GRACE_DAYS).toISOString(), emptied_at: null, reminders: [] }); }
  }

  for (const l of lapses) {
    if (l.emptied_at || (await pausedNow(l.user_id))) continue;
    const { data: still } = await db.from("catalog_lapses" as never).select("user_id").eq("user_id", l.user_id).maybeSingle();
    if (!still) continue;
    if (new Date(l.empty_after) <= now) {
      // Re-checked right before deleting, so a renewal that landed this morning still wins.
      if ((await tierOf(l.user_id)) !== "free") continue;
      const songs = await emptyCatalog(db, l.user_id);
      await db.from("catalog_lapses" as never).update({ emptied_at: now.toISOString(), songs_emptied: songs, updated_at: now.toISOString() } as never).eq("user_id", l.user_id);
      const email = await emailOf(db, l.user_id);
      if (email && songs) await sendRetentionEmail(email, { kind: "emptied", songs }, `emptied-${l.user_id}-${l.empty_after.slice(0, 10)}`);
      result.emptied += 1;
      continue;
    }
    const due = dueReminder(l, now);
    if (!due) continue;
    const email = await emailOf(db, l.user_id);
    if (!email) continue;
    if (await sendRetentionEmail(email, { kind: `lapse-${due.send}` as "lapse-start" | "lapse-7" | "lapse-1", emptyOn: l.empty_after }, `lapse-${due.send}-${l.user_id}-${l.empty_after.slice(0, 10)}`)) {
      await db.from("catalog_lapses" as never).update({ reminders: [...new Set([...l.reminders, ...due.covers])], updated_at: now.toISOString() } as never).eq("user_id", l.user_id);
      result.reminded += 1;
    }
  }
  return result;
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
