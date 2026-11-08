/**
 * The purchase confirmation email (founder, 2026-11-08): one per checkout, sent by the payment webhook as soon as Stripe
 * says the money is in. Words come from `receiptCopy` in purchase-receipt.ts, so the email carries no figure the founder
 * hasn't approved beyond the amount Stripe itself charged.
 *
 * It never throws at the caller: a purchase that is already recorded must not fail its webhook over a courtesy email,
 * and the idempotency key is the session, so a retried event cannot send the same confirmation twice.
 */
import { resendKey } from "./collab-trial.server";
import { BILLING_EMAIL, emailLayout, escapeHtml, SITE_URL } from "./email-layout";
import { money, purchaseKind, purchaseLanding, purchasedPlan, receiptCopy } from "./purchase-receipt";

const FROM = `Came Through Audio Billing <${BILLING_EMAIL}>`;
const REASON = "You're receiving this because you made a purchase from Came Through Audio.";

export type ReceiptInput = {
  /** The Stripe Checkout Session this purchase came from: also the idempotency key. */
  sessionId: string;
  email: string;
  /** The session's `kind` metadata, or "plan" for a plan subscription. */
  kind: string;
  /** Lookup keys the session carried, used to name the plan. */
  priceIds: string[];
  /** What Stripe charged, in minor units, and its currency. */
  amount: number | null;
  currency: string | null;
  /** True when Link (Stripe Managed Payments) was the merchant of record and sends its own receipt too. */
  managed: boolean;
};

export type ReceiptResult = { sent: boolean; reason?: string };

export async function sendPurchaseReceipt(i: ReceiptInput): Promise<ReceiptResult> {
  const kind = purchaseKind(i.kind);
  if (!kind) return { sent: false, reason: "unknown-kind" };
  const key = resendKey();
  if (!key) return { sent: false, reason: "no-key" };

  const copy = receiptCopy({ kind, plan: purchasedPlan(i.priceIds), paid: money(i.amount, i.currency), managed: i.managed });
  const html = emailLayout(
    `<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">${escapeHtml(copy.eyebrow)}</p>
<h1 style="font-size:24px;margin:8px 0 16px">${escapeHtml(copy.heading)}</h1>
${copy.paragraphs.map((p) => `<p style="font-size:15px;line-height:1.6">${escapeHtml(p)}</p>`).join("\n")}
<p style="margin:24px 0"><a href="${SITE_URL}${purchaseLanding(kind)}" style="background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px;display:inline-block">${escapeHtml(copy.cta)}</a></p>
<p style="font-size:13px;line-height:1.6;color:#666">Questions about the charge? Reply to this email and Billing answers it.</p>`,
    { reason: REASON },
  );

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        // One id per checkout: a retried webhook can't send the same confirmation twice.
        "Idempotency-Key": `purchase-receipt-${i.sessionId}`,
      },
      body: JSON.stringify({ from: FROM, to: [i.email], reply_to: BILLING_EMAIL, subject: copy.subject, html }),
    });
    if (!res.ok) {
      console.error(`Purchase receipt failed [${res.status}]: ${await res.text()}`);
      return { sent: false, reason: `status-${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error("Purchase receipt failed", e);
    return { sent: false, reason: "network" };
  }
}
