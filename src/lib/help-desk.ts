/**
 * The Came Through Audio Help Desk, front end (founder, 2026-11-20).
 *
 * The desk answers from the Cloudflare Worker when `VITE_CTA_HELP_WORKER_URL` is set and reachable. When it is not
 * deployed yet, is rate limited (429) or the network fails, the same question is answered here from the platform's own
 * knowledge base and help search — so the widget never shows an error and never goes silent.
 */
import { searchHelp } from "@/lib/help-search";

export const HELP_DESK_NAME = "Came Through Audio Help Desk";
export const HELP_DESK_TICKET = "/contact?type=support";
export const EXPERT_HELP = "/workspace?tab=health&view=expert";
export const MAX_HELP_CHARS = 500;

export type HelpLink = { label: string; to: string };
export type HelpAction = HelpLink;
export type HelpTurn = { role: "user" | "assistant"; content: string };
export type HelpReply = {
  text: string;
  title?: string;
  link?: HelpLink;
  /** Where the answer came from: the worker, or the local knowledge base when the worker could not answer. */
  source: "help-desk" | "local";
};

/** The workspace tab (or page) the member is on, from a route like `/workspace?tab=splits`. */
export function helpTab(route: string): string {
  const value = (route || "").toLowerCase();
  const tab = /[?&]tab=([a-z-]+)/.exec(value)?.[1];
  if (tab) return tab;
  if (value.startsWith("/plans")) return "plans";
  if (value.startsWith("/profile")) return "profile";
  return "";
}

/**
 * Two or three questions that fit this exact tab, so the desk opens on something worth asking rather than a generic
 * menu. Every one of them is a question our own pages answer.
 */
const QUICK: Record<string, string[]> = {
  embed: [
    "What's the difference between © and ℗?",
    "What is an ISWC?",
    "Where do ISRC and UPC go?",
  ],
  catalog: ["Why isn't my song registration ready?", "How do I make a radio edit of a song?"],
  health: [
    "What does the Royalty Health Check tell me?",
    "Which PRO should I join?",
    "How does Expert Help work?",
  ],
  protect: ["What does AI Protection give me?", "How does a certificate get verified?"],
  splits: [
    "How should two writers split a song?",
    "How do I send a split sheet to sign?",
    "What is the publisher share?",
  ],
  learn: [
    "How do blueprints work?",
    "How do I generate a contract?",
    "When do I need a split sheet?",
  ],
  pdf: ["How do I fill in and sign a PDF?"],
  plans: ["Which plan do I need?", "What does Catalog Management include?"],
  profile: ["How do I change my email or password?", "How do I set my embed defaults?"],
};
const QUICK_DEFAULT = [
  "What's the difference between © and ℗?",
  "Can I register a song before it's released?",
  "How do I split a song with a co-writer?",
];

export function quickQuestions(route: string, limit = 3): string[] {
  return (QUICK[helpTab(route)] ?? QUICK_DEFAULT).slice(0, limit);
}

/** The links worth offering beside this tab: the section itself, and the done-for-you desk where it applies. */
const ACTIONS: Record<string, HelpAction[]> = {
  embed: [
    { label: "Open My Catalog →", to: "/workspace?tab=catalog" },
    { label: "Let Us Do It For You →", to: EXPERT_HELP },
  ],
  catalog: [
    { label: "Jump to Royalties and Registrations →", to: "/workspace?tab=health" },
    { label: "Let Us Do It For You →", to: EXPERT_HELP },
  ],
  health: [
    { label: "Jump to Expert Help →", to: EXPERT_HELP },
    { label: "Compare plans →", to: "/plans" },
  ],
  protect: [
    { label: "Jump to AI Protection Hub →", to: "/workspace?tab=protect" },
    { label: "Let Us Do It For You →", to: EXPERT_HELP },
  ],
  splits: [
    { label: "Jump to Split Sheets →", to: "/workspace?tab=splits" },
    { label: "Let Us Do It For You →", to: EXPERT_HELP },
  ],
  learn: [
    { label: "Jump to Contracts & Blueprints →", to: "/workspace?tab=learn" },
    { label: "Jump to Split Sheets →", to: "/workspace?tab=splits" },
  ],
  pdf: [{ label: "Jump to PDF Fill & Sign →", to: "/workspace?tab=pdf" }],
  plans: [
    { label: "Compare plans →", to: "/plans" },
    { label: "Open the Help Center →", to: "/contact" },
  ],
};
const ACTIONS_DEFAULT: HelpAction[] = [
  { label: "Open the Help Center →", to: "/contact" },
  { label: "Let Us Do It For You →", to: EXPERT_HELP },
];

export function helpActions(route: string): HelpAction[] {
  return ACTIONS[helpTab(route)] ?? ACTIONS_DEFAULT;
}

/**
 * What the desk knows without the worker: the handful of facts the widget is asked most, written once here so the
 * fallback is the same answer as the Help Center. No price, deadline or allowance appears in this list.
 */
type Entry = { id: string; title: string; text: string; terms: string[]; link?: HelpLink };

const KNOWLEDGE: Entry[] = [
  {
    id: "copyright",
    title: "Composition (©) and sound recording (℗)",
    text: "They are two separate copyrights. The composition — the words and music — is marked ©. The sound recording, also called the master, is marked ℗. They are often owned by different people, which is why a cover can be released without the writer's master.",
    terms: ["composition", "copyright", "master", "recording", "c", "p", "sound", "phonogram"],
  },
  {
    id: "iswc",
    title: "What an ISWC is",
    text: "An ISWC is the international code for a composition — the song itself. Every recording of that song shares the one ISWC, while each recording gets its own ISRC.",
    terms: ["iswc", "composition", "code", "song", "work"],
  },
  {
    id: "isrc",
    title: "What an ISRC is",
    text: "An ISRC identifies one recording. A radio edit, a clean version and an instrumental are each their own recording, so each needs its own ISRC. The PROs do not require one to register a composition; The MLC and SoundExchange do.",
    terms: ["isrc", "recording", "code", "version", "upc", "release"],
  },
  {
    id: "ipi",
    title: "What an IPI (CAE) number is",
    text: "An IPI, also called a CAE number, identifies a writer or a publisher at the collection societies. Your PRO issues yours when you join; it is what lets a society match a song to the right person.",
    terms: ["ipi", "cae", "writer", "publisher", "number", "pro"],
  },
  {
    id: "splits",
    title: "How a song is split",
    text: "A song's money has two halves: the writer share and the publisher share. A writer who has no publisher keeps both halves. Splits must add up to 100% before a song can be registered, and a split sheet records who owns what.",
    terms: [
      "split",
      "50",
      "5050",
      "half",
      "writer",
      "publisher",
      "share",
      "percent",
      "cowriter",
      "collaborator",
    ],
  },
  {
    id: "unreleased",
    title: "Registering a song before it is released",
    text: "Yes — a song can be registered before release. Nothing about registering requires the song to be out yet, though some organizations ask for a release date, label or ISRC once it is. Registering early is how the writer is paid when it does come out.",
    terms: ["unreleased", "release", "before", "register", "registration", "out"],
  },
  {
    id: "pro",
    title: "Choosing a PRO",
    text: "A PRO collects performance royalties for the songs you write. In the US that is BMI or ASCAP, and you join one as a writer; SESAC and GMR are invitation-only. Both BMI and ASCAP register a composition without an ISRC.",
    terms: ["pro", "bmi", "ascap", "sesac", "gmr", "performance", "royalties", "join"],
  },
  {
    id: "mlc",
    title: "What The MLC does",
    text: "The MLC registers compositions for mechanical and streaming royalties in the US. It works from the composition, so it wants the writers, their IPI numbers and a publisher (or the self-published choice) and the ISRC.",
    terms: ["mlc", "mechanical", "streaming", "publisher", "registration"],
  },
  {
    id: "soundexchange",
    title: "What SoundExchange does",
    text: "SoundExchange collects digital-radio and non-interactive streaming royalties for the recording, not the composition. It registers the master, so it looks at the recording's ISRC, the master share and the UPC.",
    terms: ["soundexchange", "digital", "radio", "streaming", "master", "recording"],
  },
  {
    id: "expert",
    title: "Let us do it for you",
    text: "Expert Help is our done-for-you service: our team registers the songs for you in Royalties and Registrations → Expert Help, and tells you if a detail is missing. The price and what each order covers are shown there before you buy.",
    terms: ["expert", "done", "service", "register", "you", "help", "team", "manage"],
    link: { label: "Open Expert Help", to: EXPERT_HELP },
  },
  {
    id: "catalog",
    title: "My Catalog",
    text: "My Catalog holds your songs, versions, masters and artwork, and shows which songs are ready to register. Each entry carries its own ISRC, credits and cover art, so a radio edit or clean version is a separate entry.",
    terms: ["catalog", "song", "songs", "track", "master", "artwork", "version"],
    link: { label: "Open My Catalog", to: "/workspace?tab=catalog" },
  },
  {
    id: "health",
    title: "The Royalty Health Check",
    text: "The Royalty Health Check in Royalties and Registrations looks at each song and tells you what is still missing before the societies can pay it — credits, codes, splits or the paperwork — and what to fix first.",
    terms: ["health", "check", "royalty", "royalties", "missing", "ready", "score", "audit"],
    link: { label: "Open Royalties and Registrations", to: "/workspace?tab=health" },
  },
  {
    id: "contracts",
    title: "Contracts",
    text: "Contracts & Blueprints drafts a contract from what you describe, then sends it for e-signature. Each signer signs their own part, and a fully signed agreement is kept in your vault.",
    terms: ["contract", "agreement", "sign", "signature", "deal", "draft"],
    link: { label: "Open Contracts & Blueprints", to: "/workspace?tab=learn" },
  },
  {
    id: "blueprints",
    title: "Blueprints",
    text: "A blueprint is a step-by-step checklist for one job — embedding defaults, catalog defaults, copyright, registration. Tick as you go, add a note or a due date, and save it to Working On when you want it kept.",
    terms: ["blueprint", "checklist", "guide", "steps", "working"],
    link: { label: "Open Contracts & Blueprints", to: "/workspace?tab=learn" },
  },
  {
    id: "reminders",
    title: "Calendar Reminders",
    text: "Calendar Reminders sit in your workspace and on the workspace calendar, so a registration or a paperwork deadline is in front of you. Your own reminders are private to your account and appear first.",
    terms: ["calendar", "reminder", "reminders", "deadline", "due", "date"],
  },
  {
    id: "person",
    title: "Reaching a person",
    text: "Open a support ticket and our team answers by email. Choose Billing for anything about a payment or an invoice, and it goes to the billing desk.",
    terms: ["person", "human", "support", "ticket", "email", "contact", "help"],
    link: { label: "Open a support ticket", to: HELP_DESK_TICKET },
  },
];

const NO_ANSWER: HelpReply = {
  text: "I couldn't find that in our help center. Open a support ticket and our team will answer you by email.",
  source: "local",
  link: { label: "Open a support ticket", to: HELP_DESK_TICKET },
};

const NOISE = new Set(
  "a an and are as at be but by can do does for from get got have how i if in is it its me my of on or our so that the their them then there this to us was we what when where which who why will with you your im ive dont cant the".split(
    " ",
  ),
);

const words = (s: string) =>
  (
    s
      .toLowerCase()
      .replace(/[’']/g, "")
      .match(/[a-z0-9]+/g) ?? []
  ).filter((w) => w.length > 1 && !NOISE.has(w));

/** "Can you do it for me?" is the done-for-you desk, whatever else the words look like. */
const DONE_FOR_YOU =
  /\b(do (it|this) for me|done[- ]for[- ]you|expert help|let us do it|(can|could|would|will) you (register|handle|do)|your team (register|handle|do))\b/i;

/**
 * "© vs ℗" carries no searchable words once the symbols are stripped, so the two copyrights are recognised by the
 * symbols themselves, or by two of their names together ("composition and master", "copyright of the recording").
 */
function wantsCopyright(question: string): boolean {
  if (/©|℗|\(c\)|\(p\)/i.test(question)) return true;
  const names = ["copyright", "composition", "master", "recording", "song", "publishing"];
  return names.filter((n) => new RegExp(`\\b${n}`, "i").test(question)).length >= 2;
}

/** The best knowledge-base answer for a question, or the app's own help search when nothing here fits. */
export function localAnswer(question: string): HelpReply {
  const expert = KNOWLEDGE.find((e) => e.id === "expert");
  if (expert && DONE_FOR_YOU.test(question)) {
    return {
      title: expert.title,
      text: expert.text,
      source: "local",
      ...(expert.link ? { link: expert.link } : {}),
    };
  }
  const copyright = KNOWLEDGE.find((e) => e.id === "copyright");
  if (copyright && wantsCopyright(question)) {
    return { title: copyright.title, text: copyright.text, source: "local" };
  }
  const asked = [...new Set(words(question))];
  let best: { entry: Entry; score: number } | undefined;
  for (const entry of KNOWLEDGE) {
    let score = 0;
    for (const term of asked) {
      if (entry.terms.includes(term)) score += 2;
      else if (entry.terms.some((t) => t.length > 3 && (t.startsWith(term) || term.startsWith(t))))
        score += 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }
  if (best && best.score >= 2) {
    const { entry } = best;
    return {
      title: entry.title,
      text: entry.text,
      source: "local",
      ...(entry.link ? { link: entry.link } : {}),
    };
  }
  const [match] = searchHelp(question);
  if (match) {
    return {
      title: match.title,
      text: match.text,
      source: "local",
      ...(match.link ? { link: { label: match.link.label, to: match.link.to } } : {}),
    };
  }
  return NO_ANSWER;
}

/** The worker's address, or `undefined` until it is deployed. A blank setting behaves the same as a missing one. */
export function helpDeskUrl(): string | undefined {
  const raw = import.meta.env["VITE_CTA_HELP_WORKER_URL"];
  const url = typeof raw === "string" ? raw.trim() : "";
  return url || undefined;
}

type AskOptions = {
  url?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
  timeoutMs?: number | undefined;
};

/**
 * Ask the Help Desk. The worker is tried first when it is configured; every failure (no URL, 429, a 4xx/5xx, a timeout
 * or a dropped connection) falls through to the local answer, so the member always gets a reply.
 */
export async function askHelpDesk(
  input: { message: string; currentRoute?: string; history?: HelpTurn[] },
  options: AskOptions = {},
): Promise<HelpReply> {
  const message = input.message.replace(/\s+/g, " ").trim().slice(0, MAX_HELP_CHARS);
  if (!message) return localAnswer("");
  const url = options.url ?? helpDeskUrl();
  if (!url) return localAnswer(message);

  const call = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 12_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await call(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message,
        currentRoute: input.currentRoute ?? "",
        history: (input.history ?? []).slice(-6),
      }),
      signal: controller.signal,
    });
    if (!res.ok) return localAnswer(message);
    const data = (await res.json()) as { reply?: unknown };
    const text = typeof data.reply === "string" ? data.reply.trim() : "";
    return text ? { text, source: "help-desk" } : localAnswer(message);
  } catch {
    return localAnswer(message);
  } finally {
    clearTimeout(timer);
  }
}
