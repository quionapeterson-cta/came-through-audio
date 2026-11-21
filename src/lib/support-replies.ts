/**
 * The rules behind a native reply (founder, 2026-11-08). A ticket is a conversation the app owns: support writes the
 * reply in the ticket, it is stored, and the member gets it by email with a link straight back to the message box.
 *
 * Everything here is pure, so the wording rules and the status flow are testable without a database or a component.
 * The words staff send still live in `support-scripts.ts`; the policy behind them still lives in BILLING-POLICY.md.
 */
import { BILLING_EMAIL, INFO_EMAIL, SUPPORT_EMAIL } from "./email-layout";

/** `waiting` is new (founder, 2026-11-08): parked on the member, without pretending to be open or resolved. */
export const TICKET_STATUSES = ["open", "in_progress", "waiting", "resolved"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting: "Waiting on Member",
  resolved: "Resolved",
};

/** A reply can be long, but not unbounded: the database enforces the same ceiling. */
export const REPLY_MAX = 8000;

/**
 * What sending does to the ticket, chosen in the same click as sending (founder, 2026-11-08), so a reply never needs a
 * second trip to a status control. "Resolved" is the closed state the member sees.
 */
export const AFTER_SEND = [
  { id: "stay", label: "Keep it in progress", status: "in_progress" },
  { id: "waiting", label: "Waiting on the member", status: "waiting" },
  { id: "resolved", label: "Resolved — close the ticket", status: "resolved" },
] as const;
export type AfterSend = (typeof AFTER_SEND)[number]["id"];

export function afterSendStatus(after: AfterSend): TicketStatus {
  return AFTER_SEND.find((a) => a.id === after)?.status ?? "in_progress";
}

/** True when the ticket is finished for the member: the thread stays readable, the message box closes. */
export function isClosed(ticket: { status: string }): boolean {
  return ticket.status === "resolved";
}

/** A short, stable handle for an email subject, e.g. `AB12CD`, taken from the ticket's own id. */
export function ticketCode(id: string): string {
  return id
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 6)
    .toUpperCase();
}

/** The subject a reply goes out with, so it threads in a mailbox next to the member's first email. */
export function replySubject(ticket: { id: string; subject: string }): string {
  return `Re: [Ticket #${ticketCode(ticket.id)}] ${ticket.subject}`.slice(0, 200);
}

/** Replies come from and return to the box that owns the ticket: Billing's on a billing ticket, Support's otherwise. */
export function inboxFor(category: string): string {
  return category.trim().toLowerCase().startsWith("account & billing")
    ? BILLING_EMAIL
    : SUPPORT_EMAIL;
}

/**
 * The two channels one queue now serves (founder, 2026-11-19): a ticket opened through the site is `support`, and a
 * message that arrived at info@ is `info`. The channel decides which address answers it, so it is never guessed from the
 * category at send time.
 */
export const TICKET_CHANNELS = ["support", "info"] as const;
export type TicketChannel = (typeof TICKET_CHANNELS)[number];

/** The filter pills in the queue, in the order Support works them. */
export const CHANNEL_FILTERS = [
  { id: "support", label: "Support (support@)" },
  { id: "info", label: "Public Info (info@)" },
] as const;

/** The short pill on a row or a header: INFO vs SUPPORT. */
export const CHANNEL_BADGE: Record<TicketChannel, string> = { support: "SUPPORT", info: "INFO" };

/** What a ticket's channel is, with every row written before the column existed reading as `support`. */
export function channelOf(ticket: { channel?: string | null }): TicketChannel {
  return ticket.channel === "info" ? "info" : "support";
}

/**
 * The address a reply leaves from (founder, 2026-11-19): the thread's own channel. An info@ message is answered as
 * info@, so the member's reply comes back to the public inquiry channel; a ticket keeps the Support/Billing box it had.
 */
export function outboundFor(ticket: { channel?: string | null; category: string }): {
  address: string;
  display: string;
  replyTo: string;
} {
  if (channelOf(ticket) === "info") {
    return { address: INFO_EMAIL, display: "Came Through Audio", replyTo: INFO_EMAIL };
  }
  const address = inboxFor(ticket.category);
  return {
    address,
    display: `Came Through Audio ${address === BILLING_EMAIL ? "Billing" : "Support"}`,
    replyTo: address,
  };
}

export type TicketRecord = {
  id: string;
  user_id: string | null;
  kind: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
  first_reply_at?: string | null;
  member_read_at?: string | null;
  /** `support` for a ticket opened on the site, `info` for a message that arrived at info@ (founder, 2026-11-19). */
  channel?: string | null;
  /** Set when Support handed the thread to a team: the queue filters and the escalation panel read these. */
  escalated_marketing?: boolean | null;
  escalated_founder?: boolean | null;
  source_message_id?: string | null;
};

export type ThreadMessage = {
  id: string;
  ticket_id: string;
  author_kind: "staff" | "member" | "system";
  author_id: string | null;
  author_name: string;
  body: string;
  internal: boolean;
  emailed_at: string | null;
  created_at: string;
};

/** A member never reads an internal note. The server filters these too; this is the second lock, not the only one. */
export function memberVisible<T extends { internal: boolean }>(rows: readonly T[]): T[] {
  return rows.filter((r) => !r.internal);
}

/** Every placeholder still in braces. An internal note may keep them; a member reply may not. */
export function draftGaps(body: string): string[] {
  const found = body.match(/\{\{\s*[a-z_]+\s*\}\}/gi) ?? [];
  return [...new Set(found.map((m) => m.replace(/[{}]/g, "").trim()))];
}

export type SendCheck = { ok: true } | { ok: false; error: string };

/**
 * Whether a reply can go out. A member-facing reply with a bracketed placeholder left in it is refused, because the
 * member would read `{{amount}}`; an internal note may keep them, since only staff read it.
 */
export function canSendReply(body: string, internal: boolean): SendCheck {
  const trimmed = body.trim();
  if (trimmed.length < 2) return { ok: false, error: "Write the reply first." };
  if (trimmed.length > REPLY_MAX)
    return { ok: false, error: `A reply can be ${REPLY_MAX} characters or fewer.` };
  if (!internal) {
    const gaps = draftGaps(trimmed);
    if (gaps.length) {
      return {
        ok: false,
        error: `Fill in ${gaps.map((g) => `{{${g}}}`).join(", ")} before sending — the member would read the braces.`,
      };
    }
  }
  return { ok: true };
}

/** True when the member has something waiting from us: a staff reply since they last opened the thread. */
export function memberUnread(
  ticket: { member_read_at?: string | null },
  lastStaffMessageAt: string | null | undefined,
): boolean {
  if (!lastStaffMessageAt) return false;
  if (!ticket.member_read_at) return true;
  return new Date(lastStaffMessageAt).getTime() > new Date(ticket.member_read_at).getTime();
}

/** The reply body as email paragraphs, escaped: blank lines separate paragraphs, single breaks stay breaks. */
export function replyParagraphs(body: string, escape: (s: string) => string): string {
  return body
    .trim()
    .split(/\n{2,}/)
    .map(
      (para) =>
        `<p style="font-size:15px;line-height:1.6;margin:0 0 14px">${escape(para).replace(/\n/g, "<br/>")}</p>`,
    )
    .join("\n");
}

/** Where the email's button goes: the member's own thread, opened on the message box (founder, 2026-11-08). */
export function ticketLink(siteUrl: string, ticketId: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/workspace?tab=support&ticket=${ticketId}#reply`;
}
