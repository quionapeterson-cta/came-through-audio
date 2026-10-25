import { resendKey } from "./collab-trial.server";
import { BILLING_EMAIL, emailLayout, escapeHtml, SITE_URL } from "./email-layout";

/** Account notices about a plan ending, Need more time, Pause and catalog emptying (PLAN-catalog-emptying.md §5). */
const FROM = `Came Through Audio Billing <${BILLING_EMAIL}>`;
const REASON = "You're receiving this account notice because of a change to your Came Through Audio plan.";

export const longDate = (d: string | Date) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px">${label}</a>`;
const page = (eyebrow: string, heading: string, paragraphs: string[], cta?: [string, string]) =>
  `<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">${eyebrow}</p>
<h1 style="font-size:24px;margin:8px 0 16px">${heading}</h1>
${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.6">${p}</p>`).join("\n")}
${cta ? button(cta[0], cta[1]) : ""}`;

const KEPT = "Your account, badges, signed split sheets, signed contracts and AI Protection certificates are kept.";
const workspace = `${SITE_URL}/workspace`;
const profile = `${SITE_URL}/profile`;

export type RetentionEmail =
  | { kind: "cancelled"; endsOn: string }
  | { kind: "lapse-start" | "lapse-7" | "lapse-1"; emptyOn: string }
  | { kind: "emptied"; songs: number }
  | { kind: "extended"; renewsOn: string; plan: boolean }
  | { kind: "paused"; startsOn: string; endsOn: string; plan: boolean }
  | { kind: "renewal"; plan: string; price: string; renewsOn: string; daysLeft: number }
  | { kind: "payment-failed"; plan: string; reminder: boolean }
  | { kind: "renewed"; renewsOn: string };

function render(e: RetentionEmail): { subject: string; html: string } {
  switch (e.kind) {
    case "cancelled": {
      const d = escapeHtml(longDate(e.endsOn));
      return { subject: `Your plan ends on ${d}`, html: page("Plan cancelled", `Your plan ends on ${d}`, [
        `You keep full access until then. After that your catalog stays read-only for 30 days so you can download everything, then it's emptied.`,
        `Changed your mind? Keep your plan anytime before ${d} in Profile.`,
        KEPT,
      ], [profile, "Keep my plan"]) };
    }
    case "lapse-start":
    case "lapse-7":
    case "lapse-1": {
      const d = escapeHtml(longDate(e.emptyOn));
      const heading = e.kind === "lapse-start" ? `Your plan ended. Your catalog will be emptied on ${d}.`
        : e.kind === "lapse-7" ? `7 days left: your catalog will be emptied on ${d}` : `Last day: your catalog will be emptied on ${d}`;
      return { subject: e.kind === "lapse-start" ? "Your plan ended: download your catalog" : e.kind === "lapse-7" ? "7 days left to download your catalog" : "Last day to download your catalog", html: page("Your catalog", heading, [
        `Your songs, masters and artwork are read-only until then. Download everything with one click, or renew to keep it all.`,
        `Need more time? You can push the date back 30 days, or pause for 1 to 3 months, from Profile.`,
        KEPT,
      ], [workspace, "Download or renew"]) };
    }
    case "emptied":
      return { subject: "Your catalog was emptied", html: page("Your catalog", "Your catalog was emptied today", [
        `${e.songs} song${e.songs === 1 ? "" : "s"}, with ${e.songs === 1 ? "its" : "their"} masters and artwork, ${e.songs === 1 ? "was" : "were"} removed 30 days after your plan ended.`,
        `${KEPT} Come back anytime on a plan and start again.`,
      ], [`${SITE_URL}/plans`, "See plans"]) };
    case "extended": {
      const d = escapeHtml(longDate(e.renewsOn));
      return { subject: `More time: ${e.plan ? "your plan now renews" : "your catalog is kept until"} ${d}`, html: page("Need more time", e.plan ? `Your plan now renews on ${d}` : `Your catalog is kept until ${d}`, [
        e.plan ? "You have 30 more days, free, with full access. Nothing is charged until then." : "Your catalog stays read-only for 30 more days, so you can download it or renew.",
        "Need more time can be used once every 12 months.",
      ], [profile, "Open Profile"]) };
    }
    case "renewal": {
      const d = escapeHtml(longDate(e.renewsOn)), plan = escapeHtml(e.plan);
      const when = e.daysLeft === 1 ? "tomorrow" : `on ${d}`;
      return { subject: `Your ${plan} plan renews ${when}`, html: page("Renewal reminder", `Your ${plan} plan renews ${when}`, [
        `It renews automatically for ${escapeHtml(e.price)} a year (plus tax where it applies), with nothing for you to do. Your catalog, masters and badges carry on as they are.`,
        "Prefer to get it done now? Renew early and keep every day you have left. Want to change plans or update your card? You can do both from Profile.",
      ], [`${profile}?renew=1`, "Renew now"]) };
    }
    case "payment-failed": {
      const plan = escapeHtml(e.plan);
      return { subject: e.reminder ? "Reminder: your renewal still didn't go through" : "Your renewal didn't go through", html: page("Renewal payment", e.reminder ? "Your renewal still didn't go through" : "Your renewal didn't go through", [
        `We couldn't charge your card for ${plan}. Update your card to keep your plan; Stripe will try again over the next few weeks, and you keep full access meanwhile.`,
        "Need a little longer? You can move your renewal back 30 days free, or pause for 1 to 3 months, from Profile.",
        "If it's never paid, your plan ends and your catalog stays read-only for 30 days before it's emptied.",
      ], [profile, "Update my card"]) };
    }
    case "renewed": {
      const d = escapeHtml(longDate(e.renewsOn));
      return { subject: `You're renewed through ${d}`, html: page("Renewed early", `You're renewed through ${d}`, [
        "Thanks for renewing early. Your next year is paid, and you kept every day you had left, so nothing is charged until then.",
        "Early renewals aren't refundable: your new year simply starts the day your current paid plan ends.",
      ], [profile, "Open Profile"]) };
    }
    case "paused": {
      const s = escapeHtml(longDate(e.startsOn)), end = escapeHtml(longDate(e.endsOn));
      return { subject: `Your plan is paused until ${end}`, html: page("Pause", `Paused from ${s} to ${end}`, [
        "Your catalog is kept safe and read-only while you're paused: view and download, no adding or editing. Nothing is emptied.",
        e.plan ? `Your plan resumes and renews on ${end}. Want it back sooner? Use Resume now in Profile.` : `After ${end}, renew to keep your catalog.`,
        "The Vault fee isn't refundable once the pause starts. Pause can be used once every 12 months.",
      ], [profile, "Open Profile"]) };
    }
  }
}

/** Sends one notice. The idempotency key keeps a retried job or webhook from sending it twice. */
export async function sendRetentionEmail(to: string, email: RetentionEmail, idempotencyKey: string): Promise<boolean> {
  const key = resendKey();
  if (!key) return false;
  const { subject, html } = render(email);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: BILLING_EMAIL, subject, html: emailLayout(html, { reason: REASON }) }),
  });
  if (!res.ok) { console.error(`Retention email ${email.kind} failed [${res.status}]: ${await res.text()}`); return false; }
  return true;
}
