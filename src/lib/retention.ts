/**
 * Need more time, Pause and the catalog-emptying grace period (PLAN-catalog-emptying.md). Pure rules shared by Profile,
 * the workspace banner and the server, which re-checks everything before touching Stripe.
 * Plan A is reminding people before renewal (90, 60, 30, 7 and 1 day ahead). Need more time and Pause are plan B: offered
 * only when someone tries to cancel, when a renewal payment fails, and during the countdown after a plan ends.
 */

export const DAY = 86_400_000;
/**
 * Legacy: the 30-day emptying window is retired (founder, 2026-11-08). The column is still written so old rows keep
 * their shape, but a plan that ends keeps the catalog read-only on Free and nothing is emptied.
 */
export const GRACE_DAYS = 30;
/** Need more time moves the renewal back this many days. */
export const EXTEND_DAYS = 30;
/** Renewal reminders go out this many days before a yearly plan renews. */
export const RENEWAL_REMINDER_DAYS = [90, 60, 30, 7, 1] as const;
export const VAULT_PRICE = 1.99;
export const VAULT_LOOKUP_KEY = "vault_month";
/**
 * The Vault fee is a monthly subscription (founder, 2026-11-20, replacing the one-time charge of 2026-10-21): $1.99
 * billed once per month for as long as the pause runs, stopped by Stripe on Resume or when its card cannot be charged.
 * A pause has no fixed length (founder, 2026-11-21): it lasts as long as the member needs it to. The interval lives here
 * so no surface repeats the string.
 */
export const VAULT_INTERVAL = "month";
/**
 * A pause has no end date, so the plan's own charge is held by pushing its trial forward instead of to a sold end date.
 * Each paid Vault month tops it up to this many days ahead, and the daily job does the same before it gets within the
 * top-up window. Resume ends the trial, which charges the new year (founder, 2026-11-21).
 */
export const PAUSE_TRIAL_DAYS = 60;
export const PAUSE_TRIAL_TOPUP_DAYS = 30;

/** The plan's Stripe subscription, as the subscriptions table stores it. */
export type PlanSub = {
  stripe_subscription_id: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};
export type Pause = {
  id: string;
  kind: "extend" | "pause";
  /** Null on an open-ended pause; the length is only recorded on pauses sold before 2026-11-21. */
  months: number | null;
  starts_at: string;
  /** Null means the pause runs until the member resumes (founder, 2026-11-21). */
  ends_at: string | null;
  ended_at: string | null;
  created_at: string;
  /** The pause's own monthly Vault subscription (null on rows written before 2026-11-20). */
  vault_subscription_id?: string | null;
};
export type Lapse = { plan_ended_at: string; empty_after: string; emptied_at: string | null; kept_free_at?: string | null };

export const addDays = (iso: string | Date, days: number) => new Date(new Date(iso).getTime() + days * DAY);
export function addMonths(iso: string | Date, months: number) {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/**
 * The pause in force or still to come (a pause chosen before renewal starts on the renewal date). An open-ended pause
 * has no end date, so only resuming closes it.
 */
export const currentPause = (pauses: Pause[], now = new Date()) =>
  pauses.find((p) => p.kind === "pause" && !p.ended_at && (!p.ends_at || new Date(p.ends_at) > now));
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

/**
 * The old countdown is retired (founder, 2026-11-08): any lapse that has not been emptied is already kept on Free, so
 * there is no window left to act in and every offer that depended on it stays closed. Kept for the components that ask.
 */
export const inGrace = (lapse: Lapse | null, now = new Date()) =>
  !!lapse && !lapse.emptied_at && !keptOnFree(lapse) && new Date(lapse.empty_after) > now;

/**
 * A plan that ends is kept read-only on Free automatically (founder, 2026-11-08, replacing catalog emptying): nothing is
 * removed, the catalog can be downloaded, and a paid plan can be started whenever the member is ready. Rows emptied
 * under the old rule stay emptied, because their songs are already gone.
 */
export const keptOnFree = (lapse: Lapse | null) => !!lapse && !lapse.emptied_at;

export type Offers = {
  /** A renewal payment failed and Stripe is retrying it. */
  failing: boolean;
  canExtend: boolean;
  canPause: boolean;
  /** Each is once every 12 months, measured from when it was last taken; the date it opens again. */
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
 * Cancelling a plan while paused ends the pause in the same step (founder, 2026-11-21). An open-ended pause has no end
 * of its own, so leaving it alive would bill the $1.99 Vault fee forever with no plan to come back to; and cancelling
 * the plan at a period end would hand back a paid tier from the trial the pause is holding. The caller cancels the plan
 * now (not at a period end), cancels the Vault subscription, and ends this pause. Returns the live pause, or null.
 */
export function pauseEndingOnCancel(pauses: Pause[], now = new Date()): Pause | null {
  return currentPause(pauses, now) ?? null;
}

/**
 * Where a pause starts. Before renewal it starts on the renewal date, so paid time isn't lost; after a failed renewal or
 * a plan that has ended it starts now. It has no end date: it runs until the member resumes (founder, 2026-11-21).
 */
export function pauseSpan(sub: PlanSub | null, now = new Date()) {
  const renews = sub?.stripe_subscription_id && sub.status !== "past_due" ? renewalDate(sub) : null;
  return { starts: renews && renews > now ? renews : now };
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

/**
 * Renew now: pay for the next year early. Only on a plan that's running normally (not cancelling, failing or paused)
 * and only one year ahead, so a renewal more than a year away can't be paid again.
 */
/**
 * Most paid-for time an account may hold ahead, renewals included (founder, 2026-11-05): five years. Nothing can reach
 * it today — every payment buys one year and early renewal only reaches a renewal within a year — so this is the guard
 * for the day a longer prepay is offered, not a limit anyone meets now.
 */
export const MAX_PREPAID_YEARS = 5;

/** Whether a paid-through date still sits inside the five-year prepay cap. */
export function withinPrepayCap(target: Date, now = new Date()): boolean {
  return target.getTime() <= addMonths(now, 12 * MAX_PREPAID_YEARS).getTime();
}

export function canRenewEarly(sub: PlanSub | null, pauses: Pause[], now = new Date()) {
  if (!sub?.stripe_subscription_id || sub.cancel_at_period_end || !["active", "trialing"].includes(sub.status) || currentPause(pauses, now)) return false;
  const renews = renewalDate(sub);
  // One year per payment, and never past five years of paid time however many payments are made.
  return !!renews && renews > now && renews.getTime() - now.getTime() <= 365 * DAY && withinPrepayCap(earlyRenewalTarget(renews), now);
}

/** After renewing early, the plan runs a full year past the renewal date that was paid for, so no days are lost. */
export const earlyRenewalTarget = (renews: string | Date) => addMonths(renews, 12);
