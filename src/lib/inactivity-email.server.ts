import { resendKey } from "./collab-trial.server";
import { BILLING_EMAIL, emailLayout, escapeHtml, SITE_URL } from "./email-layout";
import { noticeLine, type InactivityReminder } from "./inactivity";

/**
 * The four notices before an inactive account is deleted (founder, 2026-11-08). Signing in is the way out, so the
 * button goes to the login page; downloading is offered beside it. Every notice carries the same date, and nothing is
 * ever described as a plan or billing problem.
 */
const FROM = `Came Through Audio <${BILLING_EMAIL}>`;
const REASON = "You're receiving this because this email is on a Came Through Audio account with no recent sign-in.";

export const longDate = (d: string | Date) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export type InactivityEmail = { kind: InactivityReminder; deleteOn: string };

function render(e: InactivityEmail): { subject: string; html: string } {
  const d = escapeHtml(longDate(e.deleteOn));
  const left = escapeHtml(noticeLine(e.deleteOn));
  const heading = e.kind === "1" ? `Last day: this account is deleted on ${d}` : `This account is deleted on ${d}`;
  return {
    subject: e.kind === "1" ? `Last day: your account is deleted on ${d}` : `Your account is deleted on ${d}`,
    html: `<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Your account</p>
<h1 style="font-size:24px;margin:8px 0 16px">${heading}</h1>
<p style="font-size:15px;line-height:1.6">This account has had no sign-in for two years. It has <b>${left}</b> left: on <b>${d}</b> the account and everything in it are deleted.</p>
<p style="font-size:15px;line-height:1.6"><b>Signing in keeps it.</b> One sign-in before that date cancels the deletion, and your songs, masters, artwork, split sheets, contracts and certificates stay exactly where they are.</p>
<p style="font-size:15px;line-height:1.6">If you'd rather take your work with you, download everything before ${d}. A catalog is never emptied for a plan that ended: it stays read-only on Free, so this notice is only about the account being unused.</p>
<p style="margin:24px 0"><a href="${SITE_URL}/login" style="background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;display:inline-block">Sign in and keep it</a>
<a href="${SITE_URL}/workspace" style="color:#004AAD;font-weight:700;padding:12px 12px;display:inline-block">Download my assets</a></p>
<p style="font-size:15px;line-height:1.6">If you think this is a mistake, reply to this email and a person will look at it.</p>`,
  };
}

export async function sendInactivityEmail(to: string, email: InactivityEmail, idempotencyKey: string): Promise<boolean> {
  const key = resendKey();
  if (!key) return false;
  const { subject, html } = render(email);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: BILLING_EMAIL, subject, html: emailLayout(html, { reason: REASON }) }),
  });
  if (!res.ok) { console.error(`Inactivity email ${email.kind} failed [${res.status}]: ${await res.text()}`); return false; }
  return true;
}
