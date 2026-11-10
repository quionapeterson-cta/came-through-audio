import { FAQS, type FaqCategory } from "./faq";
import { supportFaqsFor, SUPPORT_FAQS } from "./support-faq";
import { GENERAL_AREA, TICKET_TOPICS, type TicketArea } from "./support-topics";

/**
 * The Help Center's four front doors (founder, 2026-11-10). Each card is a topic people actually write in about, and its
 * answers come from the two catalogues we already keep — `src/lib/faq.ts` (the full FAQ) and `src/lib/support-faq.ts`
 * (the quick answers that sat above the form) — so the page can answer far more than the form's own list without a
 * second body of copy. Nothing here carries a number, date or allowance of its own: the facts stay in those two files.
 */
export type HelpCategoryId = "files" | "metadata" | "billing" | "royalties";
export type HelpIcon = "audio" | "metadata" | "billing" | "royalties";

export type HelpCategory = {
  id: HelpCategoryId;
  title: string;
  blurb: string;
  icon: HelpIcon;
  /** The full-FAQ sections that belong under this card. */
  faq: FaqCategory[];
  /** The support areas whose quick answers belong under it too. */
  areas: TicketArea[];
};

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: "files",
    title: "Audio & Mastered Files",
    blurb: "A finished master that won't play, save or download, the artwork and lyrics that travel with it, and the documents your branding prints on.",
    icon: "audio",
    faq: ["My Catalog", "PDF Fill & Sign", "Personal branding"],
    areas: ["My Catalog"],
  },
  {
    id: "metadata",
    title: "Metadata & Distribution",
    blurb: "Credits, ISRC and UPC written into the file itself, and getting every detail in order before the song is distributed.",
    icon: "metadata",
    faq: ["Embedding", "Agency exports & registration"],
    areas: ["Embed Metadata"],
  },
  {
    id: "billing",
    title: "Account & Billing",
    blurb: "Signing in, the card on file, plans, seats, pausing and refunds.",
    icon: "billing",
    faq: ["Plans & billing", "Account & security"],
    areas: ["Account & billing"],
  },
  {
    id: "royalties",
    title: "Royalties & Payouts",
    blurb: "What each agency needs to find and pay a song, registering it, protecting it, and the splits behind the money.",
    icon: "royalties",
    faq: ["Royalties and Registrations", "Split sheets & contracts", "AI Protection Hub"],
    areas: ["Royalties and Registrations", "Split Sheets", "AI Protection Hub"],
  },
];

export type HelpArticle = { id: string; q: string; a: string; source: "Quick answer" | "FAQ" };

/** Same question asked in both catalogues is one answer here, worded by whichever is listed first. */
const key = (q: string) => q.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const slug = (q: string) => key(q).replace(/ /g, "-").slice(0, 60);

/** Every answer under one card: the practical quick answers first, then the longer FAQ ones. */
export function helpArticles(category: HelpCategory): HelpArticle[] {
  const quick: HelpArticle[] = SUPPORT_FAQS.filter((f) => category.areas.includes(f.area))
    .map((f) => ({ id: `q-${slug(f.q)}`, q: f.q, a: f.a, source: "Quick answer" }));
  const full: HelpArticle[] = FAQS.filter((f) => category.faq.includes(f.category))
    .map((f) => ({ id: `f-${slug(f.q)}`, q: f.q, a: f.a, source: "FAQ" }));
  const seen = new Set<string>();
  return [...quick, ...full].filter((a) => {
    const k = key(a.q);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export const helpCategory = (id: HelpCategoryId) => HELP_CATEGORIES.find((c) => c.id === id);

/**
 * The two or three answers shown above the Subject line once "Where is it?" is picked: a reminder to check the obvious
 * before the ticket is sent, written for that exact area. Never more than three, and never a question from another area.
 */
export function deflectionFor(area: string, limit = 3) {
  return supportFaqsFor(area as TicketArea).slice(0, limit);
}

/**
 * The answers that belong beside the form rather than under a card — how to write a useful ticket. They still have a
 * home on the page, so nothing the old form offered quietly disappears.
 */
export const FORM_TIPS = supportFaqsFor(GENERAL_AREA);

/** A typo in a category's area would silently empty a card, so the tests read this list. */
export const HELP_AREAS = HELP_CATEGORIES.flatMap((c) => c.areas);
export const TICKET_AREA_NAMES = TICKET_TOPICS.map((t) => t.area);
