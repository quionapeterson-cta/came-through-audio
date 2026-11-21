/**
 * The Vault fee is a monthly subscription (founder, 2026-11-20, replacing the 2026-10-21 one-time charge): $1.99 a month
 * for as long as a pause runs, billed once per month with no end date, cancelled on Resume or when the card fails
 * (founder, 2026-11-21, replacing the 1–3 month pause).
 *
 * The rules live here, pure, because three things must never drift:
 *  - a pause bills once per month for as long as it lasts, and nothing after it is ended;
 *  - a $0 invoice (the trial that waits for a renewal date) charges nothing and writes no purchase;
 *  - a refunded month is closed for good, and a month Stripe could not collect ends the pause instead of giving it away.
 */
import { addDays, addMonths, DAY, PAUSE_TRIAL_DAYS, PAUSE_TRIAL_TOPUP_DAYS } from "./retention";

/** The parts of a Stripe subscription this module reads. */
export type VaultSubLike = {
  metadata?: Record<string, string> | null;
  items: { data: { price: { lookup_key?: string | null } }[] };
};

/** True when this subscription is a pause's Vault subscription, by its price's lookup key or the kind on its metadata. */
export function isVaultSubscription(sub: VaultSubLike, lookupKey: string): boolean {
  if (sub.metadata?.["kind"] === "vault") return true;
  return sub.items.data.some((item) => item.price.lookup_key === lookupKey);
}

/**
 * The dates a pause bills on for a dated pause (one sold before 2026-11-21): the pause's start, then the same day each
 * month, never on or after its end date. An open-ended pause has no end to list: it bills monthly until it is resumed.
 */
export function vaultChargeDates(starts: string | Date, ends: string | Date): Date[] {
  const end = new Date(ends);
  const out: Date[] = [];
  let at = new Date(starts);
  // Bounded: a dated pause was at most 3 months, so a bad pair of dates can never loop.
  while (at < end && out.length < 36) {
    out.push(new Date(at));
    at = addMonths(at, 1);
  }
  return out;
}

/** Stripe will not defer a trial by less than 48 hours, so a pause closer than that starts (and bills) now. */
export const VAULT_TRIAL_MIN_MS = 48 * 60 * 60 * 1000;

/**
 * The unix second the Vault subscription's trial ends: the pause's start, when that is far enough away for Stripe to
 * hold it as a trial. Null means the first month is charged at checkout (a pause starting now).
 */
export function vaultTrialEnd(starts: string | Date, now = new Date()): number | null {
  const at = new Date(starts);
  if (Number.isNaN(at.getTime())) return null;
  return at.getTime() - now.getTime() >= VAULT_TRIAL_MIN_MS
    ? Math.floor(at.getTime() / 1000)
    : null;
}

/** The parts of a plan's Stripe subscription the pause rules read. */
export type PausePlanTrial = { status: string; trialEnd: number | null };

/** The trial the daily pass pushes a paused plan's charge behind: PAUSE_TRIAL_DAYS ahead of today. */
export function pauseTrialTopUpEnd(now = new Date()): number {
  return Math.floor(addDays(now, PAUSE_TRIAL_DAYS).getTime() / 1000);
}

/**
 * What the daily pass should do with a paused plan's subscription: keep a running trial at least PAUSE_TRIAL_TOPUP_DAYS
 * ahead, leave it alone, or the trial already lapsed and the plan is billing (or gone). Stripe refuses a new `trial_end`
 * on a subscription it no longer treats as trialing, which is how a paused plan used to end up charged for a year it
 * could not use — and then charged again on Resume.
 */
export function pauseTrialAction(
  i: PausePlanTrial,
  now = new Date(),
): "top-up" | "leave" | "lapsed" {
  if (i.status === "trialing") {
    const topUpAt = Math.floor(addDays(now, PAUSE_TRIAL_TOPUP_DAYS).getTime() / 1000);
    return i.trialEnd == null || i.trialEnd < topUpAt ? "top-up" : "leave";
  }
  if (["active", "past_due", "unpaid", "canceled", "incomplete_expired"].includes(i.status))
    return "lapsed";
  return "leave";
}

/**
 * Whether Resume should end the trial now and charge a fresh year. Only a still-running trial may be charged that way:
 * once the trial has lapsed the year is already paid (or being collected), so ending the pause must use the time they
 * have rather than charge a second year for one pause.
 */
export function resumeChargesFreshYear(i: PausePlanTrial, now = new Date()): boolean {
  if (i.status !== "trialing") return false;
  return i.trialEnd == null || i.trialEnd > Math.floor(now.getTime() / 1000);
}

/** One paid month is filed on `purchases` per invoice, never one row for the whole pause. */
export const vaultMonthKey = (invoiceId: string) => `vault:${invoiceId}`;

export type VaultMonthInput = {
  subscriptionId: string;
  invoiceId: string;
  /** What Stripe actually collected, in minor units. A $0 trial invoice never writes a row. */
  amountPaid: number | null;
  currency?: string | null;
  paymentIntent?: string | null;
  /** The end of the month this invoice paid for, in unix seconds. */
  periodEnd?: number | null;
};

/** The `purchases` row for one paid month, or null when nothing was paid. Pure: the webhook only stores this. */
export function vaultMonthRow(
  month: VaultMonthInput,
  existing?: { details?: Record<string, string> | null } | null,
): { key: string; details: Record<string, string> } | null {
  const key = vaultMonthKey(month.invoiceId);
  const kept = existing?.details ?? {};
  // A refunded month is finished: a late `invoice.paid` or a re-synced subscription may never reopen it.
  if (kept["refunded_at"]) return { key, details: kept };
  if (!month.amountPaid || month.amountPaid <= 0) return existing ? { key, details: kept } : null;
  return {
    key,
    details: {
      ...kept,
      subscription: month.subscriptionId,
      invoice: month.invoiceId,
      ...(month.paymentIntent ? { payment_intent: month.paymentIntent } : {}),
      ...(month.periodEnd ? { period_end: new Date(month.periodEnd * 1000).toISOString() } : {}),
      ...(typeof month.amountPaid === "number" ? { amount: String(month.amountPaid) } : {}),
      ...(month.currency ? { currency: month.currency.toUpperCase() } : {}),
    },
  };
}

/** The parts of a Stripe price the checkout guard reads. */
export type VaultPriceLike = {
  lookup_key?: string | null;
  type?: string | null;
  recurring?: { interval?: string | null } | null;
};

/**
 * What is wrong with the Vault price's own shape — it must be recurring, monthly — or null when Stripe holds the price
 * the pause is sold as. The amount is checked separately (`amountProblem`), so the two never disagree about the figure.
 * The wording names what Stripe actually holds, so the fix is obvious without reading Stripe's generic error.
 */
export function vaultPriceShapeProblem(price: VaultPriceLike): string | null {
  if (price.type === "recurring" && price.recurring?.interval === "month") return null;
  const interval = price.recurring?.interval;
  const every =
    interval === "year"
      ? "yearly"
      : interval === "week"
        ? "weekly"
        : interval === "day"
          ? "daily"
          : interval;
  const held =
    price.type === "recurring"
      ? every
        ? `a recurring ${every} price`
        : "a recurring price with no interval set"
      : price.type === "one_time"
        ? "a one-time price"
        : "a price with no type";
  const key = price.lookup_key ?? "vault_month";
  return `${key} (Pause · Vault fee) must be a monthly subscription in Stripe: the published price is $1.99 a month, billed monthly, but Stripe holds ${held}.`;
}

/**
 * One live pause per account (founder, 2026-11-20). A double click, a second tab or a retried checkout must never open a
 * second pause subscription beside the first one, so checkout refuses before Stripe is called. The message is here so the
 * guard and its test can never disagree.
 */
export function pauseCheckoutRefusal(i: {
  livePause?: boolean;
  liveSubscription?: boolean;
}): string | null {
  if (!i.livePause && !i.liveSubscription) return null;
  return "You already have a pause. Resume it from Profile before starting another.";
}

/** Whether this month still counts as paid: a refunded month is closed. */
export function vaultMonthActive(details: Record<string, string> | null | undefined): boolean {
  return !!details && !details["refunded_at"];
}

/**
 * Whether Stripe has given up on a month's charge. A failed attempt with another retry scheduled keeps the pause; the
 * one with no retry left ends it, so a pause is never free and the account moves to the Free plan (founder, 2026-11-20).
 */
export function vaultCollectionGaveUp(i: {
  /** The next time Stripe will try, or null when it has stopped trying. */
  nextPaymentAttempt?: number | null;
  /** The subscription's status after the failure, when it was read. */
  status?: string | null;
}): boolean {
  if (i.status && ["unpaid", "canceled", "incomplete_expired"].includes(i.status)) return true;
  return i.nextPaymentAttempt == null;
}
