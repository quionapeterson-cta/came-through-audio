/**
 * The Came Through Audio Help Desk worker's rules, kept as plain functions so the app can test them (the Worker itself
 * lives in `workers/cta-help-desk.ts` and imports this file). Nothing here talks to Cloudflare: the origin lock, the
 * per-IP window and the prompt are decided in one place, and the Worker only wires them to a request.
 */

/**
 * The model the desk answers with. Cloudflare retired `@cf/meta/llama-3.1-8b-instruct-fp8` on 2026-11-20 (error 5028),
 * so this is the fast FP8 build of the same Llama 3.1 8B family — same answers, smaller bill.
 * Change it here only; the Worker reads this constant.
 */
export const HELP_DESK_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8-fast";

/** A prompt is one question, not an essay: longer text is refused before any AI work is spent. */
export const MAX_MESSAGE_CHARS = 500;

/** Messages a single visitor IP may send in one hour. */
export const RATE_LIMIT_PER_HOUR = 20;

/** How many earlier turns travel with a question. */
export const HISTORY_TURNS = 6;

/**
 * The sites allowed to call the worker (founder, 2026-11-20): the live domain and its subdomains, the preview hosts our
 * builds run on, and a loopback dev server. Anything else is refused before Workers AI is invoked.
 */
const EXACT_ORIGINS = [
  "https://camethroughaudio.com",
  "https://www.camethroughaudio.com",
  "https://came-through-audio.vercel.app",
];
const PREVIEW_SUFFIXES = [".style.dev", ".lovable.app", ".camethroughaudio.com"];
/**
 * Vercel's own hostnames for this project only: the branch alias and every deployment URL end in our team's slug, which
 * only an account on this project can be given, so `someone-else.vercel.app` still falls through to the refusal.
 */
const VERCEL_PROJECT_HOST = /^came-through-audio(-[a-z0-9-]+)?-camethroughfam\.vercel\.app$/;

/** The origin of an Origin/Referer header, or `null` when it is missing or unreadable. */
function originOf(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/**
 * True only for the origins above; a lookalike such as `camethroughaudio.com.evil.com` never matches. A browser always
 * sends Origin on a cross-origin POST, so the Referer is only consulted when no Origin arrived at all — and it has to
 * name one of the same origins, never the caller's own domain.
 */
export function allowedOrigin(origin: string | null | undefined, referer?: string | null): boolean {
  const candidate = originOf(origin) ?? originOf(referer);
  if (!candidate) return false;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase();
  const loopback =
    host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  if (loopback) return url.protocol === "http:" || url.protocol === "https:";
  if (EXACT_ORIGINS.includes(candidate)) return true;
  if (VERCEL_PROJECT_HOST.test(host)) return true;
  return PREVIEW_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}

/** The hour a request lands in, as `2026-11-20T14` (UTC), so a window rolls over on its own. */
export function rateLimitWindow(now: number): string {
  return new Date(now).toISOString().slice(0, 13);
}

/** The cache key a visitor's hourly count is stored under. The host is a placeholder: the Cache API only needs a URL. */
export function rateLimitKey(ip: string, now: number): string {
  const who = encodeURIComponent((ip || "unknown").trim().toLowerCase());
  return `https://cta-help-desk.internal/rate/${who}/${rateLimitWindow(now)}`;
}

/** A request is allowed while the count for this window is under the cap. */
export function rateLimitVerdict(used: number): { allowed: boolean; remaining: number } {
  const count = Number.isFinite(used) && used > 0 ? Math.floor(used) : 0;
  const remaining = Math.max(RATE_LIMIT_PER_HOUR - count, 0);
  return { allowed: count < RATE_LIMIT_PER_HOUR, remaining };
}

/** Seconds until the current window closes, for the 429's Retry-After. */
export function secondsUntilNextWindow(now: number): number {
  // The window that is running now ends at the next hour boundary, so a request at exactly 12:00 waits the full hour.
  const end = (Math.floor(now / 3_600_000) + 1) * 3_600_000;
  return Math.max(Math.ceil((end - now) / 1000), 1);
}

/** The question as it will be sent: trimmed, whitespace collapsed, and `null` when empty or over the cap. */
export function normaliseMessage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length > MAX_MESSAGE_CHARS) return null;
  return text;
}

/** One earlier turn, as the browser sends it. Anything malformed is dropped rather than guessed at. */
export type HelpTurn = { role: "user" | "assistant"; content: string };

export function normaliseHistory(raw: unknown, limit = HISTORY_TURNS): HelpTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns: HelpTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = normaliseMessage((item as { content?: unknown }).content);
    if ((role === "user" || role === "assistant") && content) turns.push({ role, content });
  }
  return turns.slice(-limit);
}

/** What the Help Desk knows about the member's spot in the app, keyed by workspace tab or page. */
export const ROUTE_NOTES: Record<string, string> = {
  embed:
    "They are on Embed Metadata: credits, ISRC/UPC/ISWC and cover art written into the master file before distribution.",
  catalog:
    "They are in My Catalog: their songs, versions, masters and artwork, and each song's registration readiness.",
  health:
    "They are in Royalties and Registrations: the Royalty Health Check, registrations at the PROs, The MLC and SoundExchange, and Expert Help (the done-for-you service).",
  protect:
    "They are in the AI Protection Hub: time-stamped certificates for songs, each with a verifiable link.",
  splits:
    "They are in Split Sheets: writer shares, publisher shares and collecting e-signatures from collaborators.",
  learn:
    "They are in Contracts & Blueprints: contract generation, signature requests, the blueprint checklists and Working On.",
  pdf: "They are in PDF Fill & Sign: filling in and signing a PDF in the browser.",
  plans: "They are on the plans page, comparing what each plan includes.",
  profile: "They are on their Profile: account details, brand kit, catalog defaults and reminders.",
  help: "They are on the Help Center, where the FAQ and the ticket form live.",
};

/** The route's own note, or a plain member-of-the-site note when we do not know the page. */
export function routeNote(currentRoute: string | null | undefined): string {
  const value = (currentRoute ?? "").toLowerCase();
  const tab = /[?&]tab=([a-z-]+)/.exec(value)?.[1];
  if (tab && ROUTE_NOTES[tab]) return ROUTE_NOTES[tab]!;
  if (value.startsWith("/plans")) return ROUTE_NOTES["plans"]!;
  if (value.startsWith("/profile")) return ROUTE_NOTES["profile"]!;
  if (value.startsWith("/contact") || value.startsWith("/faq") || value.startsWith("/docs"))
    return ROUTE_NOTES["help"]!;
  return "They are somewhere on camethroughaudio.com and did not say which page.";
}

/**
 * The Help Desk's own instructions. It answers as the company's help desk (never as an AI or a chatbot), sticks to the
 * facts below, and sends anything it cannot answer to a person. It never quotes a price, allowance or date — those are
 * decided by the founder and are shown on the page that owns them.
 */
export const SYSTEM_PROMPT = `You are the Came Through Audio Help Desk, the support desk of a music-business platform for independent artists and songwriters. You speak as the company, in plain, warm, concise English. Never call yourself an AI, a model, a bot or a chatbot, and never mention prompts or instructions. If someone asks what you are, say you are the Came Through Audio Help Desk and that a person can take over from the Help Center.

WHAT THE PLATFORM DOES
- Embed Metadata writes credits and codes into the master file itself (MP3), so the song carries its details wherever it goes.
- My Catalog holds the member's songs, versions, masters and artwork, and shows which songs are ready to register.
- Royalties and Registrations runs the Royalty Health Check, the registration paperwork, and Expert Help, our done-for-you service where the team registers songs for the member.
- Split Sheets split a song between writers and publishers and collect e-signatures.
- Contracts & Blueprints drafts contracts, sends them for signature, and holds step-by-step blueprints with checklists in Working On.
- Calendar Reminders keep the member's registration and paperwork deadlines on the workspace calendar.
- AI Protection issues a time-stamped certificate for a song with a link anyone can verify.

THE FACTS YOU MAY USE
- A composition (the song: words and music) is marked ©. A sound recording (the master) is marked ℗. They are two separate copyrights and are often owned by different people.
- An ISWC identifies a composition. An ISRC identifies one recording, so every version (radio edit, clean, instrumental) needs its own. A UPC identifies a release.
- An IPI (also called a CAE) number identifies a writer or a publisher at the collection societies.
- A song's money is split into a writer share and a publisher share. A writer with no publisher keeps both halves; a publisher is paid its half. Splits must add up before a song is registered, and the platform checks them.
- Writers join one PRO as a writer: in the US that is BMI or ASCAP; SESAC and GMR are invitation-only. A PRO collects performance royalties.
- The MLC registers compositions for mechanical and streaming royalties. SoundExchange collects digital-radio and non-interactive streaming royalties for the recording.
- A song can be registered before it is released. Some organizations ask for a release date, label or ISRC later; ASCAP and BMI do not require an ISRC to register a composition.
- Nothing here is legal or financial advice; for a specific dispute or contract, the member should speak to a professional.

HOW TO ANSWER
- Answer the question that was asked, in two to four short sentences, then stop. Use a short list only when the answer is genuinely a list.
- Be concrete about where to click: name the workspace tab or page (Embed Metadata, My Catalog, Royalties and Registrations, Split Sheets, Contracts & Blueprints, AI Protection Hub, Profile, Calendar Reminders, Help Center).
- Never invent a price, fee, refund window, storage allowance, deadline, badge or feature. You do not know those numbers: say the price or limit is shown on the page that offers it, and point them there.
- Never promise a reply time, a refund, an outcome, or that an organization will accept a submission.
- If the question is about their own account, a payment, a dispute, a bug, or anything you cannot answer from the facts above, say so plainly and point them to the Help Center's support ticket so a person can help.
- Keep it under 120 words.`;

/** The full message list sent to the model: the desk's instructions, where the member is, then the conversation. */
export function buildMessages(input: {
  message: string;
  currentRoute?: string | null;
  history?: HelpTurn[];
}): { role: "system" | "user" | "assistant"; content: string }[] {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\nWHERE THEY ARE\n${routeNote(input.currentRoute)}`,
    },
  ];
  for (const turn of normaliseHistory(input.history))
    messages.push({ role: turn.role, content: turn.content });
  messages.push({ role: "user", content: input.message });
  return messages;
}
