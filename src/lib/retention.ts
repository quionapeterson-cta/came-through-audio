/**
 * Need more time, Pause and the catalog-emptying grace period (PLAN-catalog-emptying.md). Pure rules shared by Profile,
 * the workspace banner and the server, which re-checks everything before touching Stripe.
 * Plan A is reminding people before renewal (90, 60, 30, 7 and 1 day ahead). Need more time and Pause are plan B: offered
 * only when someone tries to cancel, when a renewal payment fails, and during the countdown after a plan ends.
 */

export const DAY = 86_400_000;
/** Days a catalog stays read-only after a plan ends, before it's emptied. */
export const GRACE_DAYS = 30;
/** Need more time moves the renewal back this many days. */
export const EXTEND_DAYS = 30;
/** Renewal reminders go out this many days before a yearly plan renews. */
export const RENEWAL_REMINDER_DAYS = [90, 60, 30, 7, 1] as const;
export const PAUSE_MONTHS = [1, 2, 3] as const;
export const VAULT_PRICE = 1.99;
export const VAULT_LOOKUP_KEY = "vault_month";

/** The plan's Stripe subscription, as the subscriptions table stores it. */
export type PlanSub = {
  stripe_subscription_id: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};
export type Pause = { id: string; kind: "extend" | "pause"; months: number | null; starts_at: string; ends_at: string; ended_at: string | null; created_at: string };
export type Lapse = { plan_ended_at: string; empty_after: string; emptied_at: string | null };

export const addDays = (iso: string | Date, days: number) => new Date(new Date(iso).getTime() + days * DAY);
export function addMonths(iso: string | Date, months: number) {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/** The pause in force or still to come (a pause chosen before renewal starts on the renewal date). */
export const currentPause = (pauses: Pause[], now = new Date()) =>
  pauses.find((p) => p.kind === "pause" && !p.ended_at && new Date(p.ends_at) > now);
export const isPaused = (pauses: Pause[], now = new Date()) => {
  const p = currentPause(pauses, now);
  return !!p && new Date(p.starts_at) <= now;
};

/**
 * When the plan next charges. A failed renewal has already moved Stripe's period on a year, so its renewal date is
 * the start of that period (the charge that didn't go through).
 */
export function renewalDate(sub: PlanSub): Date | null {
  const at = sub.status === "past_due" ? sub.current_period_start : sub.current_period_end;
  return at ? new Date(at) : null;
}

/** Grace period running: the plan ended, the catalog isn't emptied yet. */
export const inGrace = (lapse: Lapse | null, now = new Date()) => !!lapse && !lapse.emptied_at && new Date(lapse.empty_after) > now;

export type Offers = {
  /** A renewal payment failed and Stripe is retrying it. */
  failing: boolean;
  canExtend: boolean;
  canPause: boolean;
  /** Each is once every 12 months; the date it opens again. */
  extendAgain?: Date | undefined;
  pauseAgain?: Date | undefined;
};

/**
 * What the account may use right now. `sub` is the Stripe plan, if there is one (free trials don't count). A running
 * plan qualifies (the cancel screen offers them), as does a failing renewal or a plan in its 30-day countdown.
 */
export function offers(sub: PlanSub | null, lapse: Lapse | null, pauses: Pause[], now = new Date()): Offers {
  const plan = !!sub?.stripe_subscription_id && !sub.cancel_at_period_end;
  const failing = !!sub?.stripe_subscription_id && sub.status === "past_due";
  const eligible = plan || failing || (!sub?.stripe_subscription_id && inGrace(lapse, now));
  const lastOf = (kind: Pause["kind"]) => pauses.filter((p) => p.kind === kind).map((p) => new Date(p.created_at)).sort((a, b) => b.getTime() - a.getTime())[0];
  const again = (kind: Pause["kind"]) => { const last = lastOf(kind); const at = last && addMonths(last, 12); return at && at > now ? at : undefined; };
  const extendAgain = again("extend"), pauseAgain = again("pause");
  const busy = !!currentPause(pauses, now);
  return { failing, canExtend: eligible && !busy && !extendAgain, canPause: eligible && !busy && !pauseAgain, extendAgain, pauseAgain };
}

/**
 * Where a pause sits. Before renewal it starts on the renewal date, so the paid time isn't lost; after a failed
 * renewal or a plan that has ended it starts now. Ends `months` later, when the plan renews.
 */
export function pauseSpan(sub: PlanSub | null, months: number, now = new Date()) {
  const renews = sub?.stripe_subscription_id && sub.status !== "past_due" ? renewalDate(sub) : null;
  const starts = renews && renews > now ? renews : now;
  return { starts, ends: addMonths(starts, months) };
}

/** Need more time: the new renewal date, 30 days after the current one (or after today, if that's already past). */
export function extendedRenewal(sub: PlanSub, now = new Date()) {
  const renews = renewalDate(sub);
  return addDays(renews && renews > now ? renews : now, EXTEND_DAYS);
}

/** A grace period paused or extended keeps the days it had left, counted from when the pause ends. */
export function shiftedEmptyAfter(lapse: Lapse, resumesAt: Date, now = new Date()) {
  const left = Math.max(0, new Date(lapse.empty_after).getTime() - now.getTime());
  return new Date(resumesAt.getTime() + left);
}

export const daysUntil = (iso: string | Date, now = new Date()) => Math.ceil((new Date(iso).getTime() - now.getTime()) / DAY);

/** Lapse reminders: day 0, 7 days left, 1 day left. Only the most urgent one due is sent; it covers the ones before it. */
export type Reminder = "start" | "7" | "1";
export function dueReminder(lapse: Lapse & { reminders: string[] }, now = new Date()): { send: Reminder; covers: Reminder[] } | null {
  const left = daysUntil(lapse.empty_after, now);
  const send: Reminder = left <= 1 ? "1" : left <= 7 ? "7" : "start";
  if (lapse.reminders.includes(send)) return null;
  const covers: Reminder[] = send === "1" ? ["start", "7", "1"] : send === "7" ? ["start", "7"] : ["start"];
  return { send, covers };
}

/** The renewal reminder due now (90, 60, 30, 7 or 1 day ahead), unless it already went out for this renewal date. */
export function dueRenewalReminder(renews: Date, sent: string[], sentFor: string | null, now = new Date()): number | null {
  const left = daysUntil(renews, now);
  if (left < 1) return null;
  const due = RENEWAL_REMINDER_DAYS.filter((d) => left <= d).at(-1);
  if (due === undefined) return null;
  const already = sentFor && new Date(sentFor).getTime() === renews.getTime() ? sent : [];
  return already.includes(String(due)) ? null : due;
}
