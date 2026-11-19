/**
 * The two emails a Personal Branding kit's own yearly subscription needs (founder, 2026-11-19): a renewal notice when
 * Stripe charges for another year, and a failed-payment notice when it can't. Sales receipts for the first year already
 * come from `purchase-emails.server.ts`; these are about the years after it.
 *
 * Neither ever throws at the caller: the payment is already recorded, and a courtesy email must not fail its webhook.
 * The Resend idempotency key is the invoice, so a retried event can't send the same notice twice.
 */
import { resendKey } from "./collab-trial.server";
import { BILLING_EMAIL, emailLayout, escapeHtml, SITE_URL } from "./email-layout";
import { CARD_UPDATE_STEPS } from "./member-account";
import { money } from "./purchase-receipt";

const FROM = `Came Through Audio Billing <${BILLING_EMAIL}>`;
const KIT_LINK = `${SITE_URL}/profile#brand-kit`;
const REASON = "You're receiving this because you subscribe to a Personal Branding kit from Came Through Audio.";

export type MailResult = { sent: boolean; reason?: string };

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

async function sendMail(i: { to: string; subject: string; html: string; idempotencyKey: string }): Promise<MailResult> {
  const key = resendKey();
  if (!key) return { sent: false, reason: "no-key" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        // One per invoice: a retried webhook can't send the same notice twice.
        "Idempotency-Key": i.idempotencyKey,
      },
      body: JSON.stringify({ from: FROM, to: [i.to], reply_to: BILLING_EMAIL, subject: i.subject, html: i.html }),
    });
    if (!res.ok) {
      console.error(`Branding kit email failed [${res.status}]: ${await res.text()}`);
      return { sent: false, reason: `status-${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error("Branding kit email failed", e);
    return { sent: false, reason: "network" };
  }
}

export type KitRenewalInput = {
  subscriptionId: string;
  invoiceId: string;
  email: string;
  /** What Stripe charged for the new year, in minor units, and its currency. */
  amount: number | null;
  currency: string | null;
  /** The end of the year just paid for, which is also the next renewal date. */
  renewsOn: string | null;
};

/** "Your branding kit renewed": the charge, what it keeps doing, and how to stop it. */
export async function sendKitRenewalEmail(i: KitRenewalInput): Promise<MailResult> {
  const charged = money(i.amount, i.currency);
  const html = emailLayout(
    `<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Personal Branding</p>
<h1 style="font-size:24px;margin:8px 0 16px">Your branding kit renewed</h1>
<p style="font-size:15px;line-height:1.6">${charged ? `We charged ${escapeHtml(charged)} to the card on file for another year of your Personal Branding kit.` : "We charged the card on file for another year of your Personal Branding kit."}</p>
<p style="font-size:15px;line-height:1.6">It keeps printing on the contracts, split sheets, lyric downloads and catalog downloads you hand out, in place of our header.</p>
${i.renewsOn ? `<p style="font-size:15px;line-height:1.6">Your next renewal is on ${escapeHtml(longDate(i.renewsOn))}.</p>` : ""}
<p style="font-size:15px;line-height:1.6">Cancel any time from Profile → Manage billing. The kit keeps working until the end of the year you have already paid for, and cancelling or changing your plan never ends a paid kit.</p>
<p style="margin:24px 0"><a href="${KIT_LINK}" style="background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px;display:inline-block">Open your brand kit</a></p>
<p style="font-size:13px;line-height:1.6;color:#666">Questions about the charge? Reply to this email and Billing answers it.</p>`,
    { reason: REASON },
  );
  return sendMail({ to: i.email, subject: "Your branding kit renewed", html, idempotencyKey: `kit-renewal-${i.invoiceId}` });
}

export type KitFailedInput = {
  subscriptionId: string;
  invoiceId: string;
  email: string;
  /** Which attempt Stripe is on, so a second notice isn't mistaken for the first. */
  attempt: number;
  /** What Stripe tried to charge, in minor units, and its currency. */
  amount: number | null;
  currency: string | null;
};

/** "The card for your branding kit didn't go through": what failed, what still works, and how to fix it. */
export async function sendKitPaymentFailedEmail(i: KitFailedInput): Promise<MailResult> {
  const due = money(i.amount, i.currency);
  const html = emailLayout(
    `<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Personal Branding</p>
<h1 style="font-size:24px;margin:8px 0 16px">The card for your branding kit didn't go through</h1>
<p style="font-size:15px;line-height:1.6">${due ? `Stripe couldn't take ${escapeHtml(due)} for your yearly Personal Branding kit.` : "Stripe couldn't take this year's payment for your Personal Branding kit."}${i.attempt > 1 ? ` This was attempt ${i.attempt}.` : ""}</p>
<p style="font-size:15px;line-height:1.6">Your kit stays on for the year you have already paid for while you update the card, so nothing you hand out loses your header in the meantime.</p>
<ol style="font-size:15px;line-height:1.6;padding-left:20px">${CARD_UPDATE_STEPS.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
<p style="margin:24px 0"><a href="${KIT_LINK}" style="background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px;display:inline-block">Update the card</a></p>
<p style="font-size:13px;line-height:1.6;color:#666">Questions about the charge? Reply to this email and Billing answers it.</p>`,
    { reason: REASON },
  );
  return sendMail({
    to: i.email,
    subject: "Your branding kit payment didn't go through",
    html,
    idempotencyKey: `kit-failed-${i.invoiceId}-${i.attempt}`,
  });
}
