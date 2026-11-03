import {
  ADMIN_EMAIL,
  BILLING_EMAIL,
  INFO_EMAIL,
  LEGAL_EMAIL,
  SUPPORT_EMAIL,
  escapeHtml,
} from "./email-layout";

/**
 * Company email: a letter a super admin writes by hand and sends from a named company mailbox (admin@, info@ and so on).
 * Kept apart from outreach — that is commercial mail from partnerships@ carrying an opt-out line, because it goes to
 * people who never asked for it. This is correspondence, so it carries the transactional footer instead.
 */
export const COMPANY_SENDER_NAME = "Came Through Audio";

export const COMPANY_MAILBOXES = {
  admin: ADMIN_EMAIL,
  info: INFO_EMAIL,
  support: SUPPORT_EMAIL,
  legal: LEGAL_EMAIL,
  billing: BILLING_EMAIL,
  partnerships: "partnerships@camethroughaudio.com",
} as const;

export type CompanyMailbox = keyof typeof COMPANY_MAILBOXES;

/** A handful of real letters a day, not a mailing list. */
export const COMPANY_MAIL_DAILY_LIMIT = 25;

/** The Resend `from` header: our name, then the mailbox, so a reply lands in the inbox it came from. */
export function companyFrom(mailbox: CompanyMailbox): string | undefined {
  const address = (COMPANY_MAILBOXES as Record<string, string | undefined>)[mailbox];
  return address ? `${COMPANY_SENDER_NAME} <${address}>` : undefined;
}

/** Replies go to the same mailbox, so the thread stays in one inbox. */
export function companyReplyTo(mailbox: CompanyMailbox): string | undefined {
  return (COMPANY_MAILBOXES as Record<string, string | undefined>)[mailbox];
}

/**
 * Plain text in, paragraphs out. This is the only formatting a hand-written letter needs, and it escapes first so a
 * pasted address or a stray angle bracket can't become markup.
 */
export function mailBodyHtml(body: string): string {
  return body
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="font-size:15px;line-height:1.6;margin:0 0 14px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}
