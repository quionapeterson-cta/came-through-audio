import { resendKey } from "./collab-trial.server";
import { BILLING_EMAIL, emailLayout, escapeHtml, SITE_URL } from "./email-layout";
import { noticeLine, type InactivityReminder } from "./inactivity";

/**
 * The four notices before the deadline and the one after a deletion (founder, 2026-11-08). Upgrading is the way to
 * keep the stored files, so the main button goes to the plans page; downloading is offered beside it. Every notice in
 * a run carries the same date. The last email only goes out after an account has actually been deleted, and offers a
 * fresh start.
 */
const FROM = `Came Through Audio <${BILLING_EMAIL}>`;
const REASON = "You're receiving this because this email is on a Came Through Audio account with no recent sign-in.";
const DELETED_REASON = "You're receiving this because this email was on a Came Through Audio account that has now been deleted.";

export const longDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/**
 * Exactly what the date takes from a Free account, and exactly what it leaves on it (founder, 2026-11-09). A notice says
 * these in two lists, so nobody has to work out from a sentence what they are about to lose.
 */
const LOST_FILES = [
  "every master and every piece of artwork stored for your songs",
  "your AI Protection proof videos, including the copies stored here",
  "every song in My Catalog, with the details saved on it",
];
const KEPT = [
  "your account, still on Free",
  "every split sheet, signed or not",
  "every contract, and the Signed Vault",
  "every AI Protection certificate: its PDF, its fingerprint and its Bitcoin proof",
  "your blueprints, and everything in Working On",
];
const LOST_ACCOUNT = [
  "the account and its sign-in",
  "every master and every piece of artwork stored for your songs",
  "your AI Protection proof videos",
  "every song in My Catalog, with the details saved on it",
  "your split sheets, contracts, certificates, blueprints and everything in Working On",
];
const list = (title: string, items: string[]) =>
  `<p style="font-size:15px;line-height:1.6;margin:0"><b>${title}</b></p>\n<ul style="margin:6px 0 16px;padding-left:22px;font-size:15px;line-height:1.6">${items.map((i) => `<li style="margin-bottom:6px">${i}</li>`).join("")}</ul>`;

export type InactivityEmail =
  | { kind: InactivityReminder; deleteOn: string; keepsAccount: boolean }
  | { kind: "deleted"; deletedOn: string };

function render(e: InactivityEmail): { subject: string; html: string; reason: string } {
  if (e.kind === "deleted") {
    const gone = escapeHtml(longDate(e.deletedOn));
    return {
      subject: "Your Came Through Audio account has been deleted",
      reason: DELETED_REASON,
      html: `<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Your account</p>
<h1 style="font-size:24px;margin:8px 0 16px">This account was deleted on ${gone}</h1>
<p style="font-size:15px;line-height:1.6">The account, its files and its catalog were deleted on <b>${gone}</b>, after two years without a sign-in and the reminders before it.</p>
<p style="font-size:15px;line-height:1.6">You're welcome back at any time. Start a new account with this address whenever you're ready, and every blueprint and tool will be waiting.</p>
<p style="margin:24px 0"><a href="${SITE_URL}/login" style="background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;display:inline-block">Start a new account</a></p>
<p style="font-size:15px;line-height:1.6">If you think this is a mistake, reply to this email and a person will look at it.</p>`,
    };
  }

  const d = escapeHtml(longDate(e.deleteOn));
  const left = escapeHtml(noticeLine(e.deleteOn));
  const what = e.keepsAccount ? "the stored files and catalog" : "this account";
  const heading = e.kind === "1" ? `Last day: ${what} ${e.keepsAccount ? "are" : "is"} deleted on ${d}` : `On ${d}, ${what} ${e.keepsAccount ? "are" : "is"} deleted`;
  const buttons = `<p style="margin:24px 0"><a href="${SITE_URL}/plans" style="background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;display:inline-block">Upgrade and keep everything</a>
<a href="${SITE_URL}/workspace" style="color:#004AAD;font-weight:700;padding:12px 12px;display:inline-block">Download my assets</a></p>`;
  const body = e.keepsAccount
    ? `<p style="font-size:15px;line-height:1.6">This account has had no sign-in for two years, and it has <b>${left}</b> left. On <b>${d}</b> everything stored for it is deleted. <b>The account itself stays, on Free.</b></p>
${list(`Deleted on ${d}`, LOST_FILES)}
${list("Stays with your account, for as long as it exists", KEPT)}
<p style="font-size:15px;line-height:1.6">Upgrading before ${d} keeps every file and every song exactly where they are. Signing in keeps the account and the list above, but not the files or the catalog.</p>
<p style="font-size:15px;line-height:1.6">If you'd rather take your work with you, download everything before ${d}. Your original proof videos are yours already; keep an exact copy of each one somewhere of your own, unchanged.</p>
${buttons}`
    : `<p style="font-size:15px;line-height:1.6">This account has had no sign-in for two years. It has <b>${left}</b> left: on <b>${d}</b> the account is deleted, and everything on it with it.</p>
${list(`Deleted on ${d}`, LOST_ACCOUNT)}
<p style="font-size:15px;line-height:1.6"><b>Upgrading before ${d} keeps the account, every file and the catalog.</b> Signing in before then keeps the account and your paperwork; the files and the catalog are still removed on the date unless you upgrade.</p>
<p style="font-size:15px;line-height:1.6">If you'd rather take your work with you, download everything before ${d}. Your original proof videos are yours already; keep an exact copy of each one somewhere of your own, unchanged.</p>
${buttons}`;
  return {
    subject: e.kind === "1" ? `Last day: ${what} ${e.keepsAccount ? "are" : "is"} deleted on ${d}` : `On ${d}, ${what} ${e.keepsAccount ? "are" : "is"} deleted`,
    reason: REASON,
    html: `<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Your account</p>
<h1 style="font-size:24px;margin:8px 0 16px">${heading}</h1>
${body}
<p style="font-size:15px;line-height:1.6">If you think this is a mistake, reply to this email and a person will look at it.</p>`,
  };
}

export async function sendInactivityEmail(to: string, email: InactivityEmail, idempotencyKey: string): Promise<boolean> {
  const key = resendKey();
  if (!key) return false;
  const { subject, html, reason } = render(email);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: BILLING_EMAIL, subject, html: emailLayout(html, { reason }) }),
  });
  if (!res.ok) { console.error(`Inactivity email ${email.kind} failed [${res.status}]: ${await res.text()}`); return false; }
  return true;
}
