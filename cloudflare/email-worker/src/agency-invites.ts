/**
 * Agency invitations, tagged at the edge (founder, 2026-11-18).
 *
 * SoundExchange, The MLC and ASCAP each email an invitation when someone is added as a representative, and each sends a
 * verification code or a confirm link. The inbox used to file them as ordinary mail; this module recognises them while
 * the message is still in the Worker and posts the tag alongside the mail, so Admin → Registrations can surface the
 * invitation without re-reading every inbox thread.
 *
 * The tag is a hint, not the decision. The app classifies the same mail again with its own rules when the receiver stores
 * it (src/lib/agency-invites.ts), because the app is where the agency list, the statuses and the panel live; a Worker
 * deploy must never be able to files something the app would refuse.
 *
 * Standalone on purpose: no imports, no app code, so the bundle stays small and this file can be updated without
 * touching the receiver.
 */

export type AgencyTag = {
  agency: "SoundExchange" | "The MLC" | "ASCAP";
  kind: "invite" | "verification";
  /** The invited address, when the mail carries exactly one that isn't ours or the agency's. */
  userEmail?: string;
  /** The account the invite names, when the wording makes it unambiguous. */
  accountName?: string;
  /** The link worth clicking: the agency's own address, otherwise the most invite-shaped one. */
  verifyUrl?: string;
};

const AGENCIES: { agency: AgencyTag["agency"]; domains: string[]; keywords: string[] }[] = [
  {
    agency: "SoundExchange",
    domains: ["soundexchange.com"],
    keywords: ["soundexchange", "sx direct", "guest list"],
  },
  {
    agency: "The MLC",
    domains: ["themlc.com", "themlc.org"],
    keywords: ["the mlc", "mechanical licensing collective", "mlc portal"],
  },
  {
    agency: "ASCAP",
    domains: ["ascap.com"],
    keywords: ["ascap", "member access", "designated user"],
  },
];

const EMPTY = new Set(["camethroughaudio.com"]);

function domainOf(address: string): string {
  return (address.split("@")[1] ?? "").trim().toLowerCase();
}

/** The mail's readable text, so a tag can be matched on what a person would read. */
function plainText(input: { text?: string; html?: string }): string {
  const raw = input.text?.trim() ? input.text : (input.html ?? "");
  return raw
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function agencyOf(from: string, subject: string, body: string): AgencyTag["agency"] | null {
  const domain = domainOf(from);
  for (const entry of AGENCIES) {
    if (entry.domains.some((known) => domain === known || domain.endsWith(`.${known}`))) return entry.agency;
  }
  const haystack = `${subject} ${body}`.toLowerCase();
  for (const entry of AGENCIES) {
    if (entry.keywords.some((word) => haystack.includes(word))) return entry.agency;
  }
  return null;
}

function invitedEmail(from: string, body: string): string | undefined {
  const own = new Set([...EMPTY, domainOf(from)]);
  const found = new Set<string>();
  for (const match of body.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) {
    const address = match[0].toLowerCase();
    const domain = domainOf(address);
    if (!domain || own.has(domain)) continue;
    if (/^(no-?reply|donotreply|notifications?|support)\b/.test(address.split("@")[0] ?? "")) continue;
    found.add(address);
  }
  return found.size === 1 ? [...found][0] : undefined;
}

function accountNameOf(subject: string, body: string): string | undefined {
  const text = `${subject}. ${body}`;
  const hit =
    /account (?:name|holder)\s*[:\u2013-]\s*([A-Za-z0-9][A-Za-z0-9 .,'&()/-]{1,80})/i.exec(text)?.[1] ??
    /(?:added|invited)\s+you\s+to\s+(?:the\s+)?([A-Za-z0-9][A-Za-z0-9 .,'&()/-]{1,80}?)\s+(?:account|organization|organisation|profile)/i.exec(text)?.[1];
  return hit?.trim().replace(/[.,;:]$/, "").slice(0, 120);
}

function verifyUrlOf(html: string | undefined, body: string, agency: AgencyTag["agency"]): string | undefined {
  const links: string[] = [];
  if (html) for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) links.push(match[1]!);
  for (const match of body.matchAll(/https?:\/\/[^\s<>"')]+/gi)) links.push(match[0]!);

  const domains = AGENCIES.find((entry) => entry.agency === agency)?.domains ?? [];
  const scored = links
    .map((url) => {
      const clean = url.replace(/[.,;:)]+$/, "");
      const lower = clean.toLowerCase();
      if (!/^https?:\/\//.test(lower)) return { url: clean, score: -1 };
      if (/(unsubscribe|preferences|privacy|terms|support\.)/.test(lower)) return { url: clean, score: -1 };
      let score = 0;
      if (domains.some((domain) => lower.includes(domain))) score += 3;
      if (/(verif|confirm|accept|invit|activation|activate|join|signin|sign-in|login|guest|portal)/.test(lower)) score += 2;
      return { url: clean, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.url.slice(0, 400);
}

/** The tag for one mail, or null when it isn't an invitation (a plain agency notice is left alone). */
export function tagAgencyEmail(input: {
  from: string;
  subject?: string;
  text?: string;
  html?: string;
}): AgencyTag | null {
  const body = plainText({ text: input.text, html: input.html });
  const subject = (input.subject ?? "").trim();
  const agency = agencyOf(input.from, subject, body);
  if (!agency) return null;

  const haystack = `${subject} ${body}`.toLowerCase();
  const verification =
    /\b(verification|verify|one[- ]time|confirm (your|the) (email|account)|access code|security code)\b/.test(haystack);
  const invitation =
    /\b(invit|has been added|have been added|added as|guest list|designated user|user permission|permission group|representative|accept access)\b/.test(
      haystack,
    );
  if (!verification && !invitation) return null;

  const userEmail = invitedEmail(input.from, body);
  const accountName = accountNameOf(subject, body);
  const verifyUrl = verifyUrlOf(input.html, body, agency);
  return {
    agency,
    kind: verification ? "verification" : "invite",
    ...(userEmail ? { userEmail } : {}),
    ...(accountName ? { accountName } : {}),
    ...(verifyUrl ? { verifyUrl } : {}),
  };
}
