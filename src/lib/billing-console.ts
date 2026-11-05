/**
 * Billing console rules (founder, 2026-11-05): Billing, Finance and super admins refund and cancel from Admin → Billing,
 * so nobody needs a Stripe login for routine billing. The limits live here and are enforced again in the server function,
 * never trusted from the browser.
 *
 * There is no fixed per-refund ceiling (founder, 2026-11-05): the ceiling is what the member actually paid, minus
 * anything already refunded. A $500-style cap would block a legitimate refund on the biggest orders (Expert Assistance
 * on an album, several seats) while doing nothing about the real risk, which is somebody refunding money that was never
 * paid.
 */
import { refundDaysLeft } from "./plans";

/** The Refund Policy's full-refund window, counted from the payment. Past it a refund is a judgement call, not a rule. */
export const REFUND_WINDOW_DAYS = 30;

export const REFUND_REASONS = ["requested_by_customer", "duplicate", "fraudulent"] as const;
export type RefundReason = (typeof REFUND_REASONS)[number];

export const REFUND_REASON_LABEL: Record<RefundReason, string> = {
  requested_by_customer: "Asked for it (refund policy)",
  duplicate: "Duplicate charge",
  fraudulent: "Fraudulent",
};

const KIND_LABEL: Record<string, string> = {
  ai: "AI Protection",
  expert: "Expert Registration",
  branding: "Personal branding kit",
  renew: "Renew now",
  vault: "Vault pause",
  contract: "Contract",
  seat: "Artist seat",
};

/** A purchase's human name for the console; the raw kind is never shown to staff. */
export function purchaseKindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind.replace(/_/g, " ");
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** "12.50" → 1250. Null when it isn't a positive amount with at most two decimals. */
export function dollarsToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return cents > 0 ? cents : null;
}

export type RefundVerdict = { ok: true; discretionary: boolean } | { ok: false; reason: string };

/**
 * Whether this refund may go ahead. `discretionary` means the 30-day policy window has closed: the refund is still
 * allowed — a chargeback costs more than most refunds — but it needs a written reason, and the person is deciding, not
 * following a rule.
 */
export function refundVerdict(o: {
  paidCents: number;
  refundedCents: number;
  amountCents: number;
  paidAt: string;
  now?: Date;
}): RefundVerdict {
  if (!Number.isFinite(o.amountCents) || o.amountCents <= 0) return { ok: false, reason: "Enter an amount above zero." };
  if (o.paidCents <= 0) return { ok: false, reason: "There is no payment to refund here." };
  const left = Math.max(0, o.paidCents - o.refundedCents);
  if (left <= 0) return { ok: false, reason: "This payment has already been refunded in full." };
  if (o.amountCents > left) return { ok: false, reason: `The most you can refund is ${formatUsd(left)}, which is what they paid.` };
  return { ok: true, discretionary: refundDaysLeft(o.paidAt, o.now) <= 0 };
}

/** Days left in the refund window, for the console's row copy. */
export function windowDaysLeft(paidAt: string, now = new Date()): number {
  return refundDaysLeft(paidAt, now);
}
