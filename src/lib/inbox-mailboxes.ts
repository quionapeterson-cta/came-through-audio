/**
 * Every mailbox the Admin Inbox stores, and who may read and answer it (founder, 2026-11-19).
 *
 * The company mail used to live in Gmail only. Routing an address here puts its mail in Admin → Inbox, so this file is the
 * one list the Worker's receiver, the panel's filters and the server's checks all agree on.
 *
 * Who reads what:
 *   - a super admin ("The Founder") reads every mailbox;
 *   - the registration desk reads registrations@ only;
 *   - the marketing team reads marketing@, partners@ and collaborate@;
 *   - the billing team reads billing@, and a super admin beside them.
 *
 * info@ is not an inbox mailbox: it is the public general-inquiry channel and lands in the Support queue instead (see
 * `support-intake.ts`), so it is named in `INBOUND_MAILBOXES` for the Worker and the receiver but never here.
 *
 * The teams are granted to the department, not to one person's row, which is how every other department tab in this
 * dashboard decides (departments.ts). Nobody else is granted anything, and the server re-checks before it reads a row, so
 * hiding a filter in the browser is never the rule.
 *
 * Client-safe: no server-only import may be added to this module, because the panel imports it too.
 */
import type { StaffAccess } from "./departments";

export const INBOX_MAILBOXES = [
  "admin",
  "contracts",
  "security",
  "legal",
  "billing",
  "registrations",
  "marketing",
  "partners",
  "collaborate",
] as const;

export type InboxMailbox = (typeof INBOX_MAILBOXES)[number];

/** What Cloudflare may deliver: the inbox mailboxes plus info@, which becomes a Support ticket. */
export const INBOUND_MAILBOXES = [...INBOX_MAILBOXES, "info"] as const;
export type InboundMailbox = (typeof INBOUND_MAILBOXES)[number];

/** The address behind a mailbox name. The panel says it and the reply is sent from it, so it is written once. */
export const INBOX_ADDRESS: Record<InboundMailbox, string> = {
  admin: "admin@camethroughaudio.com",
  contracts: "contracts@camethroughaudio.com",
  security: "security@camethroughaudio.com",
  legal: "legal@camethroughaudio.com",
  billing: "billing@camethroughaudio.com",
  registrations: "registrations@camethroughaudio.com",
  marketing: "marketing@camethroughaudio.com",
  partners: "partners@camethroughaudio.com",
  collaborate: "collaborate@camethroughaudio.com",
  info: "info@camethroughaudio.com",
};

/** How a mailbox reads on a chip or a badge: the address with the domain trimmed. */
export const INBOX_LABEL: Record<InboundMailbox, string> = {
  admin: "admin@",
  contracts: "contracts@",
  security: "security@",
  legal: "legal@",
  billing: "billing@",
  registrations: "registrations@",
  marketing: "marketing@",
  partners: "partners@",
  collaborate: "collaborate@",
  info: "info@",
};

/** The three addresses the marketing team sends and receives as (founder, 2026-11-19). info@ went to Support. */
export const MARKETING_MAILBOXES = ["marketing", "partners", "collaborate"] as const satisfies readonly InboxMailbox[];

/** The billing team's mailbox: billing@ and a super admin read and answer it. */
export const BILLING_MAILBOXES = ["billing"] as const satisfies readonly InboxMailbox[];

/** The mailboxes this staff member may read and answer, in the order the inbox lists them. Empty means no inbox at all. */
export function mailboxesFor(access: StaffAccess | null | undefined): InboxMailbox[] {
  if (!access) return [];
  if (access.role === "super_admin") return [...INBOX_MAILBOXES];
  const granted = new Set<InboxMailbox>();
  if (access.departments.includes("registration")) granted.add("registrations");
  if (access.departments.includes("marketing")) {
    for (const mailbox of MARKETING_MAILBOXES) granted.add(mailbox);
  }
  if (access.departments.includes("billing")) {
    for (const mailbox of BILLING_MAILBOXES) granted.add(mailbox);
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
