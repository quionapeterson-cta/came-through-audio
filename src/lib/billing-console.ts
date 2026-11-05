/**
 * Billing console rules (founder, 2026-11-05): Finance refunds and cancels plans from Admin → Billing, so nobody needs
 * a Stripe login for routine billing. The limits live here and are enforced again in the server function, never trusted
 * from the browser.
 */
import { refundDaysLeft } from "./plans";

/** The Refund Policy's full-refund window, counted from the payment. */
export const REFUND_WINDOW_DAYS = 30;

/** One refund a Finance member may issue without a super admin: $500. A super admin has no cap. */
export const REFUND_CAP_CENTS = 50_000;

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

export type RefundVerdict = { ok: true } | { ok: false; reason: string };

/**
 * Whether this refund may go ahead. `superAdmin` lifts the per-action cap and the 30-day window (a goodwill refund is a
 * judgement call, not a bug), but never the ceiling of what was actually paid.
 */
export function refundVerdict(o: {
  paidCents: number;
  refundedCents: number;
  amountCents: number;
  paidAt: string;
  capCents?: number;
  superAdmin?: boolean;
  now?: Date;
}): RefundVerdict {
  const cap = o.capCents ?? REFUND_CAP_CENTS;
  if (!Number.isFinite(o.amountCents) || o.amountCents <= 0) return { ok: false, reason: "Enter an amount above zero." };
  if (o.paidCents <= 0) return { ok: false, reason: "There is no payment to refund here." };
  const left = Math.max(0, o.paidCents - o.refundedCents);
  if (left <= 0) return { ok: false, reason: "This payment has already been refunded in full." };
  if (o.amountCents > left) return { ok: false, reason: `The most you can refund is ${formatUsd(left)}.` };
  if (!o.superAdmin) {
    if (o.amountCents > cap) {
      return { ok: false, reason: `That is over the ${formatUsd(cap)} limit for a single Finance refund. A super admin can approve it.` };
    }
    if (refundDaysLeft(o.paidAt, o.now) <= 0) {
      return { ok: false, reason: `The ${REFUND_WINDOW_DAYS}-day refund window has closed. A super admin can still approve it.` };
    }
  }
  return { ok: true };
}

/** Days left in the refund window, for the console's row copy. */
export function windowDaysLeft(paidAt: string, now = new Date()): number {
  return refundDaysLeft(paidAt, now);
}
