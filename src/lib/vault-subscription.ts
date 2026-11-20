/**
 * The Vault fee is a monthly subscription (founder, 2026-11-20, replacing the 2026-10-21 one-time charge): $1.99 a month
 * while a pause runs, billed once per month of the pause, cancelling itself at the pause end.
 *
 * The rules live here, pure, because three things must never drift:
 *  - a pause bills once per month chosen, and never after the pause ends;
 *  - a $0 invoice (the trial that waits for a renewal date) charges nothing and writes no purchase;
 *  - a refunded month is closed for good, and a month Stripe could not collect ends the pause instead of giving it away.
 */
import { addMonths } from "./retention";

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
 * The dates a pause bills on: the pause's start, then the same day each month, never on or after the end date. A
 * 1/2/3-month pause therefore has exactly 1/2/3 charges, and the last month is the one that ends with the pause.
 */
export function vaultChargeDates(starts: string | Date, ends: string | Date): Date[] {
  const end = new Date(ends);
  const out: Date[] = [];
  let at = new Date(starts);
  // Bounded: the pause is 1–3 months, so a bad pair of dates can never loop.
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
  return at.getTime() - now.getTime() >= VAULT_TRIAL_MIN_MS ? Math.floor(at.getTime() / 1000) : null;
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

/**
 * One live pause per account (founder, 2026-11-20). A double click, a second tab or a retried checkout must never open a
 * second pause subscription beside the first one, so checkout refuses before Stripe is called. The message is here so the
 * guard and its test can never disagree.
 */
export function pauseCheckoutRefusal(i: { livePause?: boolean; liveSubscription?: boolean }): string | null {
  if (!i.livePause && !i.liveSubscription) return null;
  return "You already have a pause. Resume it from Profile before starting another, or wait until this one ends.";
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
