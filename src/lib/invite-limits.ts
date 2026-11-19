/** Invite email limits and text cleanup. Pure, so the rules are tested; the server functions apply them. */

/**
 * Invite emails one account may send in 24 hours (founder, 2026-11-19: stays at 25 — bringing a whole catalog in can
 * need a lot of co-writers invited in one day). Support can raise it.
 */
export const DAILY_INVITE_LIMIT = 25;
/** Signing invitations one account may send in 24 hours, so nobody can blast them to farm free trial accounts. */
export const CONTRACT_INVITE_DAILY_LIMIT = 50;
/** Emails per split row, in total. A resend can go straight away; the three spent means a new split sheet. */
export const ROW_SEND_LIMIT = 3;
/**
 * Invites one email address may receive in 24 hours from all senders combined (founder, 2026-11-19: raised from 3, so
 * a co-writer on several projects is not cut off).
 */
export const RECIPIENT_DAILY_LIMIT = 6;
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
export function inviteBlockReason(c: InviteCounts): string | null {
  if (c.blocked) return "This collaborator has turned off split-sheet invite emails. Contact them directly to sign.";
  if (c.senderToday >= DAILY_INVITE_LIMIT) return `You've reached today's limit of ${DAILY_INVITE_LIMIT} invites. Try again tomorrow, or contact support if you need more.`;
  if (c.rowSends.length >= ROW_SEND_LIMIT)
    return `This invite was already sent ${ROW_SEND_LIMIT} times. Check the email is right before you send it again. Start a new split sheet if it needs to go again.`;
  if (c.recipientToday >= RECIPIENT_DAILY_LIMIT) return "This email address has received several invites today. Try again tomorrow.";
  return null;
}

const TRUSTED_HOSTS = /(^|\.)camethroughaudio\.com$|^localhost$/;

/**
 * The site address used in email links: the sender's page origin only when it's the live site (our domain or the
 * published address in `fallback`), so a link can't point elsewhere. Lovable editor previews (id-preview--….lovable.app,
 * ….lovableproject.com) need a Lovable login, so recipients would land on Lovable's own "no permission" page: those
 * fall back to the published site too.
 */
export function trustedOrigin(origin: string, fallback: string) {
  try {
    const u = new URL(origin);
    const live = TRUSTED_HOSTS.test(u.hostname) || u.hostname === new URL(fallback).hostname;
    return live && (u.protocol === "https:" || u.hostname === "localhost") ? u.origin : fallback;
  } catch {
    return fallback;
  }
}
