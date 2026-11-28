import { resendKey } from "./collab-trial.server";
import { BILLING_EMAIL, emailLayout, escapeHtml, SITE_URL } from "./email-layout";
import { CARD_UPDATE_STEPS } from "./member-account";

/** Account notices about a plan ending, Need more time, Pause and catalog emptying (PLAN-catalog-emptying.md §5). */
const FROM = `Came Through Audio Billing <${BILLING_EMAIL}>`;
const REASON =
  "You're receiving this account notice because of a change to your Came Through Audio plan.";

export const longDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px">${label}</a>`;
const page = (eyebrow: string, heading: string, paragraphs: string[], cta?: [string, string]) =>
  `<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">${eyebrow}</p>
<h1 style="font-size:24px;margin:8px 0 16px">${heading}</h1>
${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.6">${p}</p>`).join("\n")}
${cta ? button(cta[0], cta[1]) : ""}`;

const KEPT =
  "Your account, badges, signed split sheets, signed contracts and AI Protection certificates are kept.";

/** "Need to change or update your card on file?" with the steps, in the renewal reminder (founder, 2026-11-05). */
const cardSteps = () => `<b>Need to change or update your card on file?</b>
<ol style="margin:8px 0 0;padding-left:20px">${CARD_UPDATE_STEPS.map((s) => `<li style="margin:4px 0">${escapeHtml(s)}</li>`).join("")}</ol>`;
const workspace = `${SITE_URL}/workspace`;
const profile = `${SITE_URL}/profile`;

export type RetentionEmail =
  | { kind: "cancelled"; endsOn: string }
  | { kind: "extended"; renewsOn: string; plan: boolean }
  /** `endsOn` is only set on a pause sold with a length before 2026-11-21; a pause now runs until the member resumes. */
  | { kind: "paused"; startsOn: string; endsOn?: string | null; plan: boolean }
  | { kind: "renewal"; plan: string; price: string; renewsOn: string; daysLeft: number }
  | { kind: "payment-failed"; plan: string; reminder: boolean }
  | { kind: "renewed"; renewsOn: string }
  | { kind: "kept-free" }
  | { kind: "vault-failed" }
  /** A pause ended because the member cancelled the plan: say the Vault fee stopped, so nothing looks still owed. */
  | { kind: "pause-ended" };

function render(e: RetentionEmail): { subject: string; html: string } {
  switch (e.kind) {
    case "cancelled": {
      const d = escapeHtml(longDate(e.endsOn));
      return {
        subject: `Your plan ends on ${d}`,
        html: page(
          "Plan cancelled",
          `Your plan ends on ${d}`,
          [
            `You keep full access until then. After that your catalog stays read-only on the Free plan and is not emptied: you can view and download everything, and start a paid plan whenever you're ready.`,
            `Changed your mind? Keep your plan anytime before ${d} in Profile.`,
            KEPT,
          ],
          [profile, "Keep my plan"],
        ),
      };
    }
    case "extended": {
      const d = escapeHtml(longDate(e.renewsOn));
      return {
        subject: `More time: ${e.plan ? "your plan now renews" : "your catalog is kept until"} ${d}`,
        html: page(
          "Need more time",
          e.plan ? `Your plan now renews on ${d}` : `Your catalog is kept until ${d}`,
          [
            e.plan
              ? "You have 30 more days, free, with full access. Nothing is charged until then, and your plan renews at its normal price after that."
              : "Your catalog stays read-only for 30 more days, so you can download it or renew.",
          ],
          [profile, "Open Profile"],
        ),
      };
    }
    case "renewal": {
      const plan = escapeHtml(e.plan);
      const when = e.daysLeft === 1 ? "tomorrow" : `on ${escapeHtml(longDate(e.renewsOn))}`;
      return {
        subject: `Your ${plan} plan renews ${when}`,
        html: page(
          "Renewal reminder",
          `Your ${plan} plan renews ${when}`,
          [
            `It renews automatically for ${escapeHtml(e.price)} a year (plus tax where it applies), with nothing for you to do. Your catalog, masters and badges carry on as they are.`,
            cardSteps(),
            "Prefer to get it done now? Renew early and keep every day you have left.",
          ],
          [`${profile}?renew=1`, "Renew now"],
        ),
      };
    }
    case "payment-failed": {
      const plan = escapeHtml(e.plan);
      return {
        subject: e.reminder
          ? "Reminder: your renewal still didn't go through"
          : "Your renewal didn't go through",
        html: page(
          "Renewal payment",
          e.reminder ? "Your renewal still didn't go through" : "Your renewal didn't go through",
          [
            `We couldn't charge your card for ${plan}. Update your card to keep your plan; Stripe will try again over the next few weeks, and you keep full access meanwhile.`,
            "Need a little longer? You can take a free month — 30 days at no charge, with full access — or pause for as long as you need for $1.99 a month, from Profile.",
            "If it's never paid, your plan ends and your catalog stays read-only on Free. Nothing is emptied, and you can start a paid plan whenever you're ready.",
          ],
          [profile, "Update my card"],
        ),
      };
    }
    case "renewed": {
      const d = escapeHtml(longDate(e.renewsOn));
      return {
        subject: `You're renewed through ${d}`,
        html: page(
          "Renewed early",
          `You're renewed through ${d}`,
          [
            "Thanks for renewing early. Your next year is paid, and you kept every day you had left, so nothing is charged until then.",
            "Your 30-day refund window starts today, the day you paid.",
          ],
          [profile, "Open Profile"],
        ),
      };
    }
    case "kept-free":
      return {
        subject: "Your catalog is kept, read-only, on Free",
        html: page(
          "Your catalog",
          "Your catalog is kept on Free",
          [
            "Nothing was emptied, and nothing will be. Your songs, masters and artwork stay right where they are, read-only: view and download, no adding or editing.",
            "You can start a paid plan whenever you're ready and pick up exactly where you left off.",
            KEPT,
          ],
          [`${SITE_URL}/plans`, "See plans"],
        ),
      };
    case "paused": {
      const s = escapeHtml(longDate(e.startsOn));
      const end = e.endsOn ? escapeHtml(longDate(e.endsOn)) : null;
      return {
        subject: end ? `Your plan is paused until ${end}` : "Your plan is paused",
        html: page(
          "Pause",
          end ? `Paused from ${s} to ${end}` : `Paused from ${s}`,
          [
            "Your catalog is kept safe and read-only while you're paused: view and download, no adding or editing. Nothing is emptied, and your masters, artwork and PDFs stay downloadable.",
            e.plan
              ? end
                ? `Your plan resumes and renews on ${end}. Want it back sooner? Use Resume now in Profile.`
                : "Your plan waits for you: resume any time in Profile and it renews from that day, for a fresh year."
              : "Renew whenever you're ready to keep your catalog.",
            `The Vault fee is $1.99 a month for as long as you're paused, charged monthly and stopped the moment you resume${end ? ", with nothing taken after the pause ends" : ""}. It isn't refundable once the month starts, and pausing is never cancelling.`,
          ],
          [profile, "Open Profile"],
        ),
      };
    }
    case "pause-ended":
      return {
        subject: "Your pause has ended and the Vault fee is stopped",
        html: page(
          "Pause ended",
          "Your pause has ended",
          [
            "Your plan was cancelled, so the pause has ended with it and the $1.99 monthly Vault fee is stopped. Nothing more is charged for the pause.",
            "Your account is on the Free plan: your catalog stays read-only and nothing is emptied, and your masters, artwork and PDFs are still downloadable. Start a paid plan whenever you're ready and pick up exactly where you left off.",
            KEPT,
          ],
          [`${SITE_URL}/plans`, "See plans"],
        ),
      };
    case "vault-failed":
      return {
        subject: "Your pause has ended: the Vault fee couldn't be charged",
        html: page(
          "Pause ended",
          "Your pause has ended",
          [
            "Stripe tried the monthly Vault fee several times and the card didn't go through, so the pause has ended and the account is now on the Free plan. Nothing else was charged.",
            "Your catalog is kept and nothing is emptied. Start a paid plan whenever you're ready, with a card that works, and pick up exactly where you left off.",
            KEPT,
          ],
          [`${SITE_URL}/plans`, "See plans"],
        ),
      };
  }
}

/** Sends one notice. The idempotency key keeps a retried job or webhook from sending it twice. */
export async function sendRetentionEmail(
  to: string,
  email: RetentionEmail,
  idempotencyKey: string,
): Promise<boolean> {
  const key = resendKey();
  if (!key) return false;
  const { subject, html } = render(email);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      reply_to: BILLING_EMAIL,
      subject,
      html: emailLayout(html, { reason: REASON }),
    }),
  });
  if (!res.ok) {
    console.error(`Retention email ${email.kind} failed [${res.status}]: ${await res.text()}`);
    return false;
  }
  return true;
}
