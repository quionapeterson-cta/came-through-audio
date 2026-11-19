/**
 * A Personal Branding kit is its own yearly subscription (founder, 2026-11-19). Its paid years are filed on `purchases`,
 * one row per kit, so everything built before the subscription (the kit is on for the year paid for, a refund ends it,
 * a plan change can't touch it) keeps reading from one place.
 *
 * The rules are here, pure, because two things must never drift:
 *  - a kit never unlocks before a period is actually paid, and
 *  - a refunded year is closed for good: however late a renewal or cancellation event arrives, it can't reopen it.
 */

/** The parts of a Stripe subscription this module reads. */
export type BrandingSubLike = {
  metadata?: Record<string, string> | null;
  items: { data: { price: { lookup_key?: string | null } }[] };
};

/** True when this subscription is a branding kit's, by its price's lookup key or the kind we put on its metadata. */
export function isBrandingSubscription(sub: BrandingSubLike, lookupKey: string): boolean {
  if (sub.metadata?.["kind"] === "branding") return true;
  return sub.items.data.some((item) => item.price.lookup_key === lookupKey);
}

export type KitYearInput = {
  subscriptionId: string;
  /** The period Stripe just billed for, in unix seconds (null when Stripe didn't report it). */
  periodStart: number | null;
  periodEnd: number | null;
  invoiceId: string | null;
  paymentIntent: string | null;
  /** True only when Stripe says this period's invoice is paid. Nothing unlocks on an unpaid one. */
  paid: boolean;
  /**
   * Whether Stripe will bill this subscription again when the paid year ends. A subscription cancelled from the
   * billing portal keeps the year it paid for but is never described as renewing (founder, 2026-11-19).
   */
  renews: boolean;
  /** Set when the subscription has ended; the kit still runs to the end of the year already paid for. */
  canceledAt?: string | null;
};

/** What one paid year looks like on `purchases`. `details` are merged, never replaced. */
export type KitPurchaseRow = {
  /** The row is keyed to the subscription, since a kit has no checkout session per renewal. */
  key: string;
  details: Record<string, string>;
  /** The paid period's start, so the kit's year counts from the money rather than the event. */
  created_at?: string;
};

/**
 * The `purchases` row for this event, or null when nothing should be written. Pure: the webhook only stores what this
 * returns, so a rule that matters can be tested without Stripe or a database.
 */
export function kitYearRow(
  year: KitYearInput,
  existing?: { details?: Record<string, string> | null } | null,
): KitPurchaseRow | null {
  const kept = existing?.details ?? {};
  const key = `sub:${year.subscriptionId}`;
  // A refunded year is finished. A late renewal, a cancellation or a re-synced subscription may never reopen the kit,
  // move its year, or replace the invoice it was refunded on.
  if (kept["refunded_at"]) return { key, details: kept };
  // No money, no kit. This also covers the first event of a checkout that hasn't settled.
  if (!year.paid) return existing ? { key, details: kept } : null;
  const details: Record<string, string> = {
    ...kept,
    subscription: year.subscriptionId,
    ...(year.invoiceId ? { invoice: year.invoiceId } : {}),
    ...(year.paymentIntent ? { payment_intent: year.paymentIntent } : {}),
    ...(year.periodEnd ? { period_end: new Date(year.periodEnd * 1000).toISOString() } : {}),
    ...(year.canceledAt ? { canceled_at: year.canceledAt } : {}),
    // Written every paid period, so resuming a cancelled subscription puts the renewal back on the page.
    renews: year.renews ? "yes" : "no",
  };
  return {
    key,
    details,
    ...(year.periodStart ? { created_at: new Date(year.periodStart * 1000).toISOString() } : {}),
  };
}

/** Whether this year still unlocks the kit: paid, and not refunded. */
export function kitYearActive(details: Record<string, string> | null | undefined): boolean {
  return !!details && !details["refunded_at"];
}
