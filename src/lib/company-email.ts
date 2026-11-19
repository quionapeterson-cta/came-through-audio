import type { StaffAccess } from "./departments";
import {
  ADMIN_EMAIL,
  BILLING_EMAIL,
  COLLABORATE_EMAIL,
  CONTRACTS_EMAIL,
  INFO_EMAIL,
  LEGAL_EMAIL,
  MARKETING_EMAIL,
  PARTNERS_EMAIL,
  PARTNERSHIPS_EMAIL,
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
  contracts: CONTRACTS_EMAIL,
  marketing: MARKETING_EMAIL,
  partners: PARTNERS_EMAIL,
  info: INFO_EMAIL,
  collaborate: COLLABORATE_EMAIL,
  support: SUPPORT_EMAIL,
  legal: LEGAL_EMAIL,
  billing: BILLING_EMAIL,
  partnerships: PARTNERSHIPS_EMAIL,
} as const;

export type CompanyMailbox = keyof typeof COMPANY_MAILBOXES;

/**
 * Which addresses this person may write a new letter from (founder, 2026-11-19).
 *
 * A super admin picks from every mailbox we own. The marketing team sends as the four addresses it answers as
 * (marketing@, partners@, info@, collaborate@) and no others, which is what keeps the company's own admin@ and
 * contracts@ correspondence with a super admin. Everyone else keeps the boxes their work already answers: support@,
 * legal@, billing@ and partnerships@. The server checks this same list before it sends, so the picker is not the rule.
 */
export function companyMailboxesFor(access: StaffAccess | null | undefined): CompanyMailbox[] {
  if (!access) return [];
  if (access.role === "super_admin") return Object.keys(COMPANY_MAILBOXES) as CompanyMailbox[];
  if (access.departments.includes("marketing")) return ["marketing", "partners", "info", "collaborate"];
  return ["support", "legal", "billing", "partnerships"];
}

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
