/**
 * The one place we send email from (founder, 2026-11-10).
 *
 * Two problems it settles. First, every address we send from is named here once, so a typo cannot quietly send from a
 * mailbox nobody watches. Second, every send carries an idempotency key: Resend drops a repeat of the same key, so a
 * double click, a retried request or a Stripe redelivery can no longer send the same invite, code or receipt twice.
 */
import {
  ADMIN_EMAIL,
  AUTH_EMAIL,
  BILLING_EMAIL,
  COLLABORATE_EMAIL,
  INFO_EMAIL,
  LEGAL_EMAIL,
  PARTNERSHIPS_EMAIL,
  REGISTRATIONS_EMAIL,
  SECURITY_EMAIL,
  SUPPORT_EMAIL,
} from "./email-layout";

/** Every mailbox the company sends from. A sender names one of these, never a raw address. */
export const MAILBOXES = {
  admin: ADMIN_EMAIL,
  auth: AUTH_EMAIL,
  billing: BILLING_EMAIL,
  collaborate: COLLABORATE_EMAIL,
  info: INFO_EMAIL,
  legal: LEGAL_EMAIL,
  partnerships: PARTNERSHIPS_EMAIL,
  registrations: REGISTRATIONS_EMAIL,
  security: SECURITY_EMAIL,
  support: SUPPORT_EMAIL,
} as const;

export type MailboxName = keyof typeof MAILBOXES;

/** The address behind a mailbox name. */
export const mailboxAddress = (mailbox: MailboxName) => MAILBOXES[mailbox];

/**
 * The Resend `from` header: our name, then the mailbox, so a reply lands in the inbox the mail came from.
 * A caller that needs a different display name (Support, Billing) passes it.
 */
export function mailFrom(mailbox: MailboxName, display = "Came Through Audio") {
  return `${display} <${MAILBOXES[mailbox]}>`;
}

/** The sending key. A missing key is "not configured", never a send with no authorisation. */
export function resendKey(): string | undefined {
  return process.env["RESEND_API_KEY"] || process.env["CameThroughAudio"];
}

export type MailAttachment = { filename: string; content: string };

export type Mail = {
  /** A mailbox name from `MAILBOXES`, so no caller can invent an address. */
  from: MailboxName;
  to: string[];
  subject: string;
  html: string;
  /**
   * What makes this send unique: the same key never sends the same email twice. Build it from the row it belongs to
   * with `mailKey`, and add a time bucket when the same email is legitimately sent again later.
   */
  key: string;
  replyTo?: string | undefined;
  cc?: string[] | undefined;
  attachments?: MailAttachment[] | undefined;
  /** A different `from` display name, for the mailboxes that read "Support" or "Billing". */
  display?: string | undefined;
};

export type MailResult = { ok: boolean; status?: number; detail?: string };

/**
 * One stable, readable idempotency key from the parts that identify the send: `mailKey("seat-invite", seat.id)`.
 * Anything that is not a letter or digit becomes a dash, repeats collapse, and the whole thing stays inside Resend's
 * 256-character limit.
 */
export function mailKey(...parts: (string | number)[]): string {
  return parts
    .map((part) => String(part).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"))
    .filter(Boolean)
    .join("-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}

/**
 * Sends one email through Resend. Never throws for a failed send — the caller decides whether that is a hard error
 * (an invite that must arrive) or a note in the log (a courtesy copy). A send with no idempotency key throws, because
 * that is a programming mistake, not a delivery problem.
 */
export async function sendMail(mail: Mail): Promise<MailResult> {
  // A missing key or recipient is our mistake, so it throws whatever the provider is configured to do.
  if (!mail.key?.trim()) throw new Error("Every email needs an idempotency key: pass key: mailKey(...).");
  const to = mail.to.map((address) => address.trim()).filter(Boolean);
  if (!to.length) throw new Error("Every email needs at least one recipient.");
  const key = resendKey();
  if (!key) return { ok: false, detail: "no-key" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": mail.key,
      },
      body: JSON.stringify({
        from: mailFrom(mail.from, mail.display),
        to,
        ...(mail.cc?.length ? { cc: mail.cc.map((address) => address.trim()).filter(Boolean) } : {}),
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
        ...(mail.attachments?.length ? { attachments: mail.attachments } : {}),
        subject: mail.subject,
        html: mail.html,
      }),
    });
    if (!res.ok) return { ok: false, status: res.status, detail: await res.text().catch(() => "") };
    return { ok: true, status: res.status };
  } catch (e) {
    console.error(`Email to ${to.join(", ")} failed:`, e);
    return { ok: false, detail: "network" };
  }
}
