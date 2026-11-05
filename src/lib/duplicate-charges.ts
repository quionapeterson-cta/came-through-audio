/**
 * "It charged me twice" (founder, 2026-11-05): the check that has to happen *before* a duplicate refund.
 *
 * A bank app shows more lines than Stripe does, and most of them are not a second charge:
 * - an authorization hold that never settled sits beside the real charge, and it drops off by itself;
 * - one charge and the refund for it read as two lines;
 * - two seats, two $2.99 certificates, a renewal on the same day as an upgrade, or a failed attempt beside a successful
 *   one are two real payments for two real things.
 *
 * Refunding one of those either fails in Stripe (an authorization cannot be refunded) or gives money back for something
 * the member kept. So nothing here guesses from the member's screenshot: a payment is only a duplicate when two
 * *settled* payments, for the same item, are separate payments close together. Everything else gets an answer staff can
 * send instead of a refund.
 */
import { formatUsd } from "./billing-console";

/** Card networks release an unsettled authorization in about this long. Most issuers are quicker. */
export const HOLD_RELEASE_DAYS = 7;
/** The outside edge issuers are allowed; say this when a member has already waited and it is still showing. */
export const HOLD_RELEASE_DAYS_LONG = 30;
/** How close together two settled payments have to be before they are even looked at as a pair. */
export const DUPLICATE_WINDOW_HOURS = 72;

/** A payment intent's status, narrowed to the four answers that change what staff should do. */
export type PaymentState = "succeeded" | "requires_capture" | "processing" | "failed";

/** Everything the console needs about one payment, with Stripe's words already translated. */
export type ChargeFacts = {
  /** Stripe charge or payment intent id — whatever the console can show and refund against. */
  id: string;
  paymentIntent: string | null;
  amountCents: number;
  refundedCents: number;
  currency: string;
  /** ISO timestamp of the payment. */
  createdAt: string;
  state: PaymentState;
  /** What was bought, in staff words ("Artist seat", "Plan renewal"). Two different items are never a duplicate. */
  item: string;
  /** The purchase row this charge came from, when there is one, so the console can refund it in one click. */
  purchaseId: string | null;
};

export type ChargeReading = {
  /** Money actually moved. */
  settled: boolean;
  /** Authorized but not captured: a hold, never a payment. */
  held: boolean;
  /** Paid and fully given back. */
  refunded: boolean;
  /** For an unsettled hold, the date it should be gone by itself. Null once money has moved. */
  clearsBy: string | null;
  /** One plain sentence staff can read out or paste to the member. */
  line: string;
};

/** Stripe's status strings differ between charges and payment intents; this keeps the console to four answers. */
export function paymentState(status: string, captured?: boolean | null): PaymentState {
  if (status === "requires_capture") return "requires_capture";
  if (status === "processing" || status === "pending") return "processing";
  if (status === "succeeded" || status === "paid") return captured === false ? "requires_capture" : "succeeded";
  return "failed";
}

export function addDays(iso: string, days: number): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return iso;
  return new Date(at + days * 24 * 60 * 60 * 1000).toISOString();
}

export const dayLabel = (iso: string | null): string => (iso ? iso.slice(0, 10) : "—");

/**
 * What one line on the member's statement actually is. `held` is the important one: it looks exactly like a charge in a
 * banking app, and it is the most common reason somebody insists they were billed twice.
 */
export function readCharge(c: ChargeFacts): ChargeReading {
  const refunded = c.amountCents > 0 && c.refundedCents >= c.amountCents;
  if (c.state === "requires_capture") {
    const clearsBy = addDays(c.createdAt, HOLD_RELEASE_DAYS);
    return {
      settled: false,
      held: true,
      refunded,
      clearsBy,
      line: `Only an authorization so far — no money has left their account. It should disappear by ${dayLabel(clearsBy)}; some banks take up to ${HOLD_RELEASE_DAYS_LONG} days. Never refund it: Stripe has nothing to give back.`,
    };
  }
  if (c.state === "processing") {
    const clearsBy = addDays(c.createdAt, HOLD_RELEASE_DAYS);
    return {
      settled: false,
      held: true,
      refunded,
      clearsBy,
      line: `Still processing. If it never settles it drops off by ${dayLabel(clearsBy)} on its own — wait rather than refund.`,
    };
  }
  if (c.state === "succeeded") {
    if (refunded) {
      return { settled: true, held: false, refunded: true, clearsBy: null, line: "Paid, and already refunded in full — the second line they are seeing is the refund on its way back." };
    }
    const partly = c.refundedCents > 0 ? ` ${formatUsd(c.refundedCents)} of it has already been refunded.` : "";
    return { settled: true, held: false, refunded: false, clearsBy: null, line: `Paid. The money left their account.${partly}` };
  }
  return { settled: false, held: false, refunded, clearsBy: null, line: "No money moved: the payment failed or was cancelled." };
}

export type DuplicateVerdict =
  | { kind: "real_duplicate"; keepId: string; refundId: string; why: string }
  | { kind: "wait"; why: string; clearsBy: string | null }
  | { kind: "not_duplicate"; why: string }
  | { kind: "already_refunded"; why: string };

export type DuplicateGroup = { amountCents: number; currency: string; charges: ChargeFacts[]; verdict: DuplicateVerdict };

/**
 * The decision for one group of same-amount payments. Order matters: a hold beats everything (there is no second charge
 * to refund), then an existing refund, then different items, then the real duplicate.
 */
export function assessDuplicateGroup(group: ChargeFacts[]): DuplicateVerdict {
  const readings = group.map((c) => ({ c, r: readCharge(c) }));
  const unsettled = readings.filter((x) => x.r.held);
  if (unsettled.length) {
    const first = unsettled[0]!;
    return {
      kind: "wait",
      why: `${first.c.item} on ${dayLabel(first.c.createdAt)} is ${first.c.state === "processing" ? "still processing" : "an authorization, not a payment"}. Card networks release those by themselves — usually within ${HOLD_RELEASE_DAYS} days, always within ${HOLD_RELEASE_DAYS_LONG}. A refund would fail, and cancelling the hold can leave the payment it is covering uncovered.`,
      clearsBy: first.r.clearsBy,
    };
  }
  const settled = readings.filter((x) => x.r.settled);
  const refunded = settled.filter((x) => x.r.refunded);
  if (refunded.length && settled.length > refunded.length) {
    return { kind: "already_refunded", why: "One of those lines is a refund going back to their card, not a second charge. Nothing is owed." };
  }
  if (settled.length < 2) {
    return { kind: "not_duplicate", why: "Only one payment actually went through, so there is nothing to refund twice." };
  }
  const items = [...new Set(settled.map((x) => x.c.item))];
  if (items.length > 1) {
    return { kind: "not_duplicate", why: `Two payments for two different things (${items.join(" and ")}). That is not a duplicate.` };
  }
  const intents = new Set(settled.map((x) => x.c.paymentIntent ?? x.c.id));
  if (intents.size === 1) {
    return { kind: "not_duplicate", why: "Both lines are the same payment shown twice by the bank. Nothing is owed." };
  }
  const keep = settled[0]!;
  const refund = settled[settled.length - 1]!;
  return {
    kind: "real_duplicate",
    keepId: keep.c.id,
    refundId: refund.c.id,
    why: `Two separate payments of ${formatUsd(keep.c.amountCents)} for ${keep.c.item.toLowerCase()}, both settled, ${dayLabel(keep.c.createdAt)} and ${dayLabel(refund.c.createdAt)}. Refund the newer one and keep the older.`,
  };
}

/** Payments of the same amount close enough together to be a pair worth looking at. One payment is never a group. */
export function groupPossibleDuplicates(charges: readonly ChargeFacts[]): DuplicateGroup[] {
  const sorted = [...charges].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const groups: DuplicateGroup[] = [];
  for (const c of sorted) {
    if (c.amountCents <= 0) continue;
    const windowMs = DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000;
    const match = groups.find((g) => {
      if (g.amountCents !== c.amountCents || g.currency !== c.currency) return false;
      const newest = g.charges[g.charges.length - 1]!;
      return Date.parse(c.createdAt) - Date.parse(newest.createdAt) <= windowMs;
    });
    if (match) match.charges.push(c);
    else groups.push({ amountCents: c.amountCents, currency: c.currency, charges: [c], verdict: { kind: "not_duplicate", why: "" } });
  }
  return groups
    .filter((g) => g.charges.length > 1)
    .map((g) => ({ ...g, verdict: assessDuplicateGroup(g.charges) }));
}

/**
 * The four things a person must be able to say yes to before the button says "duplicate". Ticking them is not a
 * formality: the refund reason is what a bank sees, and a wrong "duplicate" is money out of the business for a payment
 * the member kept.
 */
export const DUPLICATE_CHECKS = [
  { id: "settled", label: "Both payments show as paid in Stripe — not an authorization, not 'processing'." },
  { id: "same_item", label: "They paid twice for the same thing, not two seats, two certificates, or a purchase plus a renewal." },
  { id: "nothing_back", label: "No refund has already gone back on either payment." },
  { id: "not_a_hold", label: "What they are looking at is the charge, not a hold sitting beside the real charge." },
] as const;
export type DuplicateCheck = (typeof DUPLICATE_CHECKS)[number]["id"];
export const DUPLICATE_CHECK_IDS = DUPLICATE_CHECKS.map((c) => c.id) as [DuplicateCheck, ...DuplicateCheck[]];

export function duplicateChecksDone(checks: readonly string[]): boolean {
  return DUPLICATE_CHECKS.every((c) => checks.includes(c.id));
}

/**
 * Refuses a refund that claims "duplicate" when the payment says otherwise. Runs on the server and again in the panel,
 * so neither a screenshot nor a hurried click can turn a hold into a refund.
 */
export function duplicateRefundBlock(o: { checks: readonly string[]; settled: boolean; held: boolean; refunded: boolean }): string | null {
  if (o.held) return "That payment hasn't settled yet, so there is nothing to refund: it is an authorization that clears by itself. Tell them when it should be gone, and check again after that.";
  if (!o.settled) return "No money moved on that payment, so a duplicate refund would refund nothing. Check the Stripe status with them before doing anything else.";
  if (o.refunded) return "That payment is already refunded in full. Refunding it again is refused, not just unwise.";
  if (!duplicateChecksDone(o.checks)) return `A duplicate refund needs all ${DUPLICATE_CHECKS.length} checks ticked. If any is not true, it isn't a duplicate: answer the member instead of refunding.`;
  return null;
}
