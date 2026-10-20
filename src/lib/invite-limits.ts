/** Split-invite email limits and text cleanup. Pure, so the rules are tested; the server function applies them. */

/** Invite emails one account may send in 24 hours (an album's worth of co-writers). Support can raise it. */
export const DAILY_INVITE_LIMIT = 25;
/** Emails per split row, ever, and the wait between them. */
export const ROW_SEND_LIMIT = 3;
export const ROW_RESEND_GAP_MS = 86_400_000;
/** Invites one email address may receive in 24 hours from all senders combined. */
export const RECIPIENT_DAILY_LIMIT = 3;
/** Longest title, artist or name that goes into an email. */
export const INVITE_TEXT_MAX = 80;

const LINKISH = /(?:https?:\/\/|www\.)\S*|\S+@\S+|\S+\.(?:com|net|org|info|biz|io|co|me|ly|gg|app|xyz|top|site|online|link|click|shop|store|live|us|uk|ru|cn)\b\S*/gi;

/** Sender-typed text for an email: no web addresses or emails, single spaces, at most 80 characters. */
export function cleanInviteText(s: string | null | undefined) {
  const out = (s ?? "").replace(LINKISH, " ").replace(/\s+/g, " ").trim();
  return out.length > INVITE_TEXT_MAX ? out.slice(0, INVITE_TEXT_MAX - 1).trimEnd() + "…" : out;
}

export interface InviteCounts {
  /** Invites this sender sent in the last 24 hours. */
  senderToday: number;
  /** Every earlier send for this split row (ISO times). */
  rowSends: string[];
  /** Invites this recipient got in the last 24 hours, from anyone. */
  recipientToday: number;
  blocked: boolean;
}

/** Why this invite can't go out right now, in words for the sender, or null when it can. */
export function inviteBlockReason(c: InviteCounts, now = Date.now()): string | null {
  if (c.blocked) return "This collaborator has turned off split-sheet invite emails. Contact them directly to sign.";
  if (c.senderToday >= DAILY_INVITE_LIMIT) return `You've reached today's limit of ${DAILY_INVITE_LIMIT} invites. Try again tomorrow, or contact support if you need more.`;
  if (c.rowSends.length >= ROW_SEND_LIMIT) return `This invite was already sent ${ROW_SEND_LIMIT} times. Contact them directly to sign.`;
  const last = Math.max(0, ...c.rowSends.map((t) => Date.parse(t) || 0));
  if (now - last < ROW_RESEND_GAP_MS) return "This invite was sent in the last 24 hours. Resend available tomorrow.";
  if (c.recipientToday >= RECIPIENT_DAILY_LIMIT) return "This email address has received several invites today. Try again tomorrow.";
  return null;
}

const TRUSTED_HOSTS = /(^|\.)(camethroughaudio\.com|lovable\.app|lovableproject\.com)$|^localhost$/;

/** The site address used in email links: the sender's page origin only when it's one of ours, so a link can't point elsewhere. */
export function trustedOrigin(origin: string, fallback: string) {
  try {
    const u = new URL(origin);
    return TRUSTED_HOSTS.test(u.hostname) && (u.protocol === "https:" || u.hostname === "localhost") ? u.origin : fallback;
  } catch {
    return fallback;
  }
}
