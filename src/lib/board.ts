/**
 * The Super Admin message board's own vocabulary (founder, 2026-11-18).
 *
 * Five categories, three priorities and three states, named once so the panel, the server functions and the migration
 * cannot drift apart. The categories are the founder's own list: what registration and the other desks need to raise
 * with a super admin, in the order they are worked.
 *
 * This is additive to Admin → Team Board (the cross-department pulse and `team_notices` micro-chat), which stays exactly
 * as it is; this board is threaded correspondence, not a notice wall.
 */

export const BOARD_CATEGORIES = [
  {
    value: "reported_issues",
    label: "Reported Issues",
    hint: "Opened by Report an Issue on a registration, with a link back to that customer's card.",
  },
  {
    value: "agency_escalations",
    label: "Agency & PRO Escalations",
    hint: "SoundExchange, The MLC and ASCAP account or invitation blockers.",
  },
  {
    value: "client_followups",
    label: "Client Follow-Ups & Split Disputes",
    hint: "Missing metadata, unsigned split sheets, anything that needs the client.",
  },
  {
    value: "billing_audits",
    label: "Billing, Payouts & Verification Audits",
    hint: "Stripe and Paddle checks, refund questions and royalty health flags.",
  },
  {
    value: "announcements",
    label: "System & Operations Announcements",
    hint: "Super admin directives, SOP updates and shift handovers.",
  },
] as const;

export type BoardCategory = (typeof BOARD_CATEGORIES)[number]["value"];

export const BOARD_CATEGORY_LABEL: Record<BoardCategory, string> = Object.fromEntries(
  BOARD_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<BoardCategory, string>;

export const BOARD_CATEGORY_HINT: Record<BoardCategory, string> = Object.fromEntries(
  BOARD_CATEGORIES.map((c) => [c.value, c.hint]),
) as Record<BoardCategory, string>;

export const BOARD_PRIORITIES = ["normal", "high", "urgent"] as const;
export type BoardPriority = (typeof BOARD_PRIORITIES)[number];

export const BOARD_PRIORITY_LABEL: Record<BoardPriority, string> = {
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const BOARD_STATUSES = ["open", "in_progress", "resolved"] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];

export const BOARD_STATUS_LABEL: Record<BoardStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

/** The categories a super admin can open by hand; a reported issue is only ever created by the registration button. */
export const BOARD_POSTABLE_CATEGORIES = BOARD_CATEGORIES.filter(
  (c) => c.value !== "reported_issues",
).map((c) => c.value);

export const isBoardCategory = (value: string): value is BoardCategory =>
  BOARD_CATEGORIES.some((c) => c.value === value);

export const isBoardPriority = (value: string): value is BoardPriority =>
  (BOARD_PRIORITIES as readonly string[]).includes(value);

export const isBoardStatus = (value: string): value is BoardStatus =>
  (BOARD_STATUSES as readonly string[]).includes(value);

/**
 * Addresses tagged with @ in a reply. Only something that looks like a full address is kept, so an @handle in ordinary
 * prose ("@Dana, can you look?") never becomes a mention of a mailbox that doesn't exist.
 */
const MENTION_PATTERN = /@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

export function mentionsIn(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(MENTION_PATTERN)) found.add(match[1]!.toLowerCase());
  return [...found].slice(0, 20);
}

/** A reported issue's opening line, so a thread says which agency and case without opening it. */
export function issueTitle(input: { agency: string; songTitle: string }): string {
  return `${input.agency} \u00b7 ${input.songTitle}`.slice(0, 200);
}
