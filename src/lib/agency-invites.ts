/**
 * Agency invitations, as the app reads them (founder, 2026-11-18).
 *
 * SoundExchange, The MLC and ASCAP each email an invitation when someone is added as a representative, and each sends a
 * verification code or link. Those mails used to be just another row in the inbox; this module is the one rule that says
 * which agency a mail came from, whether it is an invitation, and what inside it staff need (the invited address, the
 * account name, the link to accept).
 *
 * The Cloudflare Email Worker tags a mail with the same agencies before it posts it here. The tag is a hint, never the
 * decision: the receiver classifies the mail again with these rules, so a sender name cannot be spoofed into an invite
 * and a change to the list happens in one place the app owns.
 *
 * Kept free of React and Supabase so the mapping and the extraction can be reasoned about (and tested) on their own.
 */

/** The agencies that invite a representative. BMI is not one: access is granted inside the account, not by email. */
export const INVITE_AGENCIES = ["SoundExchange", "The MLC", "ASCAP"] as const;
export type InviteAgency = (typeof INVITE_AGENCIES)[number];

/** Where an invitation stands for one account. Counted per invitation, aggregated per user and agency by the panel. */
export const AGENCY_INVITE_STATUSES = [
  "invite_received",
  "representative_accepted",
  "action_needed",
] as const;
export type AgencyInviteStatus = (typeof AGENCY_INVITE_STATUSES)[number];

export const AGENCY_INVITE_STATUS_LABEL: Record<AgencyInviteStatus, string> = {
  invite_received: "Invite Received",
  representative_accepted: "Representative Accepted",
  action_needed: "Action Needed",
};

export const AGENCY_INVITE_STATUS_HINT: Record<AgencyInviteStatus, string> = {
  invite_received: "The agency emailed an invitation and nobody has accepted it yet.",
  representative_accepted: "Came Through Audio now has access at this agency for the account.",
  action_needed: "Something is blocking the invite: a wrong address, an expired link or a missing account.",
};

/** What kind of agency mail arrived; a notice is filed but is not an invitation. */
export type AgencyEmailKind = "invite" | "verification" | "notice";

export const AGENCY_EMAIL_KIND_LABEL: Record<AgencyEmailKind, string> = {
  invite: "Invitation",
  verification: "Verification",
  notice: "Notice",
};

/** Our own mailboxes, so an address in our footer is never read as the invited person. */
export const OWN_EMAIL_DOMAINS = ["camethroughaudio.com"] as const;

const MATCHERS: Record<InviteAgency, { domains: string[]; keywords: string[] }> = {
  SoundExchange: {
    domains: ["soundexchange.com"],
    keywords: ["soundexchange", "sx direct", "guest list", "registrant"],
  },
  "The MLC": {
    domains: ["themlc.com", "themlc.org"],
    keywords: ["the mlc", "mechanical licensing collective", "mlc portal", "member hub"],
  },
  ASCAP: {
    domains: ["ascap.com"],
    keywords: ["ascap", "member access", "designated user"],
  },
};

export type AgencyEmailRead = {
  agency: InviteAgency;
  kind: AgencyEmailKind;
  /** The invited address, when the mail carries one that is not ours and not the agency's. */
  userEmail: string | null;
  /** The account the invite names, when it says so. */
  accountName: string | null;
  /** The one link worth clicking, when there is one. */
  verifyUrl: string | null;
};

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_PATTERN = /https?:\/\/[^\s<>"')]+/gi;
const HREF_PATTERN = /href\s*=\s*["']([^"']+)["']/gi;

/** `person@agency.com` → `agency.com`. */
export function domainOf(address: string): string {
  return (address.split("@")[1] ?? "").trim().toLowerCase();
}

/** The readable text of a mail: tags removed, entities unescaped enough to match on, whitespace collapsed. */
export function plainText(input: { text?: string | undefined; html?: string | undefined }): string {
  const raw = input.text?.trim() ? input.text : (input.html ?? "");
  return raw
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Which agency sent the mail, if any. The sender domain wins, because a signature can say "SoundExchange" in a mail from
 * somewhere else; the keywords are the fallback for the agencies' mailing platforms.
 */
export function agencyOf(from: string, subject = "", body = ""): InviteAgency | null {
  const domain = domainOf(from);
  for (const agency of INVITE_AGENCIES) {
    if (MATCHERS[agency].domains.some((known) => domain === known || domain.endsWith(`.${known}`))) {
      return agency;
    }
  }
  const haystack = `${subject} ${body}`.toLowerCase();
  for (const agency of INVITE_AGENCIES) {
    if (MATCHERS[agency].keywords.some((word) => haystack.includes(word))) return agency;
  }
  return null;
}

/** Invitation, verification or plain notice. A code or confirm link is the verification; the ask is the invite. */
export function kindOf(subject = "", body = ""): AgencyEmailKind {
  const haystack = `${subject} ${body}`.toLowerCase();
  if (/\b(verification|verify|one[- ]time|confirm (your|the) (email|account)|access code|security code)\b/.test(haystack)) {
    return "verification";
  }
  if (
    /\b(invit|has been added|have been added|added as|guest list|designated user|user permission|permission group|representative|accept access)\b/.test(
      haystack,
    )
  ) {
    return "invite";
  }
  return "notice";
}

/** The address a mail is asking someone to act on: not ours, not the agency's own, not a no-reply. */
export function invitedEmail(from: string, body: string): string | null {
  const ownDomain = new Set([...OWN_EMAIL_DOMAINS, domainOf(from)]);
  const found = new Set<string>();
  for (const match of body.matchAll(EMAIL_PATTERN)) {
    const address = match[0].toLowerCase();
    const domain = domainOf(address);
    if (!domain || ownDomain.has(domain)) continue;
    if (domain.endsWith("example.com") || domain.endsWith("sentry.io")) continue;
    if (/^(no-?reply|donotreply|notifications?|support)\b/.test(address.split("@")[0] ?? "")) continue;
    found.add(address);
  }
  // One address is the usual case (the invite names the person). More than one means the mail is a notice, so the
  // panel shows it without guessing which person it belongs to.
  return found.size === 1 ? [...found][0]! : null;
}

/** The account the invite names, when the wording makes it unambiguous. */
export function accountNameOf(subject: string, body: string): string | null {
  const text = `${subject}. ${body}`;
  const patterns = [
    /account (?:name|holder)\s*[:\u2013-]\s*([A-Za-z0-9][A-Za-z0-9 .,'&()/-]{1,80})/i,
    /(?:added|invited)\s+you\s+to\s+(?:the\s+)?([A-Za-z0-9][A-Za-z0-9 .,'&()/-]{1,80}?)\s+(?:account|organization|organisation|profile)/i,
    /(?:account|organization|organisation)\s+["\u201c]([^"\u201d]{2,80})["\u201d]/i,
  ];
  for (const pattern of patterns) {
    const hit = pattern.exec(text)?.[1]?.trim();
    if (hit) return hit.replace(/[.,;:]$/, "").slice(0, 120);
  }
  return null;
}

/**
 * The link to click: the agency's own address if it is there, otherwise the most invite-shaped link, and never a
 * tracker or an unsubscribe. Ties keep the order they appeared in, so the mail reads the way its sender meant.
 */
export function verifyUrlOf(html: string | undefined, body: string, agency: InviteAgency | null): string | null {
  const links: { url: string; score: number }[] = [];
  if (html) {
    for (const match of html.matchAll(HREF_PATTERN)) links.push({ url: match[1]!, score: 0 });
  }
  for (const match of body.matchAll(URL_PATTERN)) links.push({ url: match[0]!, score: 0 });

  const domains = agency ? MATCHERS[agency].domains : [];
  const scored = links
    .map(({ url }) => {
      const clean = url.replace(/[.,;:)]+$/, "");
      const lower = clean.toLowerCase();
      if (!/^https?:\/\//.test(lower)) return { url: clean, score: -1 };
      if (/(unsubscribe|preferences|privacy|terms|help center|support\.)/.test(lower)) return { url: clean, score: -1 };
      let score = 0;
      if (domains.some((domain) => lower.includes(domain))) score += 3;
      if (/(verif|confirm|accept|invit|activation|activate|join|signin|sign-in|login|guest|portal)/.test(lower)) score += 2;
      return { url: clean, score };
    })
    .filter((entry) => entry.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.url.slice(0, 400) ?? null;
}

/**
 * Everything the inbox needs to know about one agency mail, or null when it isn't from an agency.
 * `from` is the sender address, `subject` the subject and `text`/`html` the bodies exactly as the worker posted them.
 */
export function readAgencyEmail(input: {
  from: string;
  subject?: string | undefined;
  text?: string | undefined;
  html?: string | undefined;
}): AgencyEmailRead | null {
  const body = plainText({ text: input.text, html: input.html });
  const subject = (input.subject ?? "").trim();
  const agency = agencyOf(input.from, subject, body);
  if (!agency) return null;
  return {
    agency,
    kind: kindOf(subject, body),
    userEmail: invitedEmail(input.from, body),
    accountName: accountNameOf(subject, body),
    verifyUrl: verifyUrlOf(input.html, body, agency),
  };
}

export const isInviteAgency = (value: string): value is InviteAgency =>
  (INVITE_AGENCIES as readonly string[]).includes(value);

export const isAgencyInviteStatus = (value: string): value is AgencyInviteStatus =>
  (AGENCY_INVITE_STATUSES as readonly string[]).includes(value);

/** Best status per agency for one account, so a header badge shows one answer per agency, newest news first. */
export function summariseInvites(
  rows: { agency: string; status: string; received_at: string }[],
): { agency: InviteAgency; status: AgencyInviteStatus; receivedAt: string }[] {
  const order: Record<AgencyInviteStatus, number> = {
    representative_accepted: 3,
    action_needed: 2,
    invite_received: 1,
  };
  const best = new Map<InviteAgency, { agency: InviteAgency; status: AgencyInviteStatus; receivedAt: string }>();
  for (const row of rows) {
    if (!isInviteAgency(row.agency) || !isAgencyInviteStatus(row.status)) continue;
    const current = best.get(row.agency);
    const candidate = { agency: row.agency, status: row.status, receivedAt: row.received_at };
    if (!current) {
      best.set(row.agency, candidate);
      continue;
    }
    const better =
      order[candidate.status] > order[current.status] ||
      (order[candidate.status] === order[current.status] &&
        Date.parse(candidate.receivedAt) > Date.parse(current.receivedAt));
    if (better) best.set(row.agency, candidate);
  }
  return INVITE_AGENCIES.flatMap((agency) => {
    const row = best.get(agency);
    return row ? [row] : [];
  });
}
