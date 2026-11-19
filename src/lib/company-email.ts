import type { Department, StaffAccess } from "./departments";
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
  REGISTRATIONS_EMAIL,
  SUPPORT_EMAIL,
  escapeHtml,
} from "./email-layout";

/**
 * Company email: a letter a super admin or a department lead writes by hand and sends from a named company mailbox
 * (admin@, info@ and so on). Kept apart from outreach — that is commercial mail from partnerships@ carrying an opt-out
 * line, because it goes to people who never asked for it. This is correspondence, so it carries the transactional
 * footer instead.
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
  registrations: REGISTRATIONS_EMAIL,
} as const;

export type CompanyMailbox = keyof typeof COMPANY_MAILBOXES;

/**
 * The department that owns each company mailbox (founder, 2026-11-19). One mapping: the picker, the server's send check,
 * the sent-letter log and the PDF email guard all read it, so a mailbox can't be owned in one place and open in another.
 *
 * An empty list means the mailbox belongs to the company itself, so only a super admin writes from it (admin@,
 * contracts@). partnerships@ sits with Marketing because that is the team that runs partnerships; info@ is shared, since
 * Support answers a public inquiry on it and Marketing runs the public inbox.
 */
export const COMPANY_MAILBOX_OWNERS: Record<CompanyMailbox, readonly Department[]> = {
  admin: [],
  contracts: [],
  legal: ["security"],
  billing: ["billing", "finance"],
  support: ["support"],
  info: ["support", "marketing"],
  registrations: ["registration"],
  marketing: ["marketing"],
  partners: ["marketing"],
  collaborate: ["marketing"],
  partnerships: ["marketing"],
};

/**
 * Who may write a new letter from a company mailbox (founder, 2026-11-19).
 *
 * A super admin picks from every mailbox we own. A department lead sends as the boxes their department owns — the Head of
 * Support as support@ and info@, the Head of Finance as billing@, the marketing lead as marketing@, partners@,
 * collaborate@ and partnerships@. Everyone else sends no company mail at all: general staff answer inside the tools they
 * work in (a member's own support ticket, a split invite), so a letter from the company's address is a lead's decision.
 *
 * The server checks this same list before it sends, and the sent-letter log is read through the same rule, so the picker
 * is never the permission.
 */
export function companyMailboxesFor(access: StaffAccess | null | undefined): CompanyMailbox[] {
  if (!access) return [];
  const all = Object.keys(COMPANY_MAILBOXES) as CompanyMailbox[];
  if (access.role === "super_admin") return all;
  if (access.role !== "department_lead") return [];
  return all.filter((mailbox) =>
    COMPANY_MAILBOX_OWNERS[mailbox].some((department) => access.departments.includes(department)),
  );
}

/**
 * What a person may read of the sent-letter log (founder, 2026-11-19): a super admin every mailbox company-wide, a
 * department lead the boxes their department owns — never Legal's or Finance's — and everyone else only their own sends.
 * No one reads across departments, and the server narrows the query to exactly this.
 */
export function companyMailReadScope(
  access: StaffAccess | null | undefined,
): CompanyMailbox[] | "all" | "own" {
  if (!access) return "own";
  if (access.role === "super_admin") return "all";
  const mine = companyMailboxesFor(access);
  return mine.length ? mine : "own";
}

/** A handful of real letters a day company-wide, not a mailing list. */
export const COMPANY_MAIL_DAILY_LIMIT = 25;

/**
 * One account's share of that cap: today the same figure, so the daily limit is enforced both for the company and for
 * each sender. No single account can spend the whole allowance, whatever the company-wide number becomes.
 */
export const COMPANY_MAIL_SENDER_DAILY_LIMIT = COMPANY_MAIL_DAILY_LIMIT;

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
