/**
 * Every mailbox the Admin Inbox stores, and who may read and answer it (founder, 2026-11-19).
 *
 * The company mail used to live in Gmail only. Routing an address here puts its mail in Admin → Inbox, so this file is the
 * one list the Worker's receiver, the panel's filters and the server's checks all agree on.
 *
 * Who reads what:
 *   - a super admin reads every mailbox, including admin@ and contracts@;
 *   - the registration desk reads registrations@ only;
 *   - the marketing team reads marketing@, partners@, info@ and collaborate@, the four addresses it answers as.
 *
 * The marketing four are granted to the department, not to one person's row, which is how every other department tab in
 * this dashboard decides (departments.ts). Nobody else is granted anything here, and the server re-checks before it reads
 * a row, so hiding a filter in the browser is never the rule.
 *
 * Client-safe: no server-only import may be added to this module, because the panel imports it too.
 */
import type { StaffAccess } from "./departments";

export const INBOX_MAILBOXES = [
  "admin",
  "contracts",
  "registrations",
  "marketing",
  "partners",
  "info",
  "collaborate",
] as const;

export type InboxMailbox = (typeof INBOX_MAILBOXES)[number];

/** The address behind a mailbox name. The panel says it and the reply is sent from it, so it is written once. */
export const INBOX_ADDRESS: Record<InboxMailbox, string> = {
  admin: "admin@camethroughaudio.com",
  contracts: "contracts@camethroughaudio.com",
  registrations: "registrations@camethroughaudio.com",
  marketing: "marketing@camethroughaudio.com",
  partners: "partners@camethroughaudio.com",
  info: "info@camethroughaudio.com",
  collaborate: "collaborate@camethroughaudio.com",
};

/** How a mailbox reads on a chip or a badge: the address with the domain trimmed. */
export const INBOX_LABEL: Record<InboxMailbox, string> = {
  admin: "admin@",
  contracts: "contracts@",
  registrations: "registrations@",
  marketing: "marketing@",
  partners: "partners@",
  info: "info@",
  collaborate: "collaborate@",
};

/**
 * The four addresses the marketing team sends and receives as (founder, 2026-11-19). A super admin may use them too, and
 * nobody else may use any of them.
 */
export const MARKETING_MAILBOXES = ["marketing", "partners", "info", "collaborate"] as const satisfies readonly InboxMailbox[];

/** The mailboxes this staff member may read and answer, in the order the inbox lists them. Empty means no inbox at all. */
export function mailboxesFor(access: StaffAccess | null | undefined): InboxMailbox[] {
  if (!access) return [];
  if (access.role === "super_admin") return [...INBOX_MAILBOXES];
  const granted = new Set<InboxMailbox>();
  if (access.departments.includes("registration")) granted.add("registrations");
  if (access.departments.includes("marketing")) {
    for (const mailbox of MARKETING_MAILBOXES) granted.add(mailbox);
  }
  return INBOX_MAILBOXES.filter((mailbox) => granted.has(mailbox));
}

/** Whether this staff member may read and answer one mailbox. The server checks this before it hands over a row. */
export function canUseMailbox(
  access: StaffAccess | null | undefined,
  mailbox: InboxMailbox,
): boolean {
  return mailboxesFor(access).includes(mailbox);
}
