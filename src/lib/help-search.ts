import { DOCS } from "@/lib/docs";
import { FAQS } from "@/lib/faq";
import { GLOSSARY } from "@/lib/glossary";
import { GUIDES } from "@/lib/guides";

/**
 * Help chat, version 1 (PLAN-phase4-order item 4, approved 2026-10-25): free, no AI. Answers come only from our own
 * FAQ, glossary, Help Center pages and guide summaries, matched by words, so it never makes anything up; when nothing
 * matches well it says so and offers a support ticket. Guides are a Catalog Management feature, so only their summary
 * and where to find them are shown.
 */
export type HelpAnswer = { id: string; title: string; text: string; link?: { label: string; to: string } | undefined; source: "FAQ" | "Glossary" | "Help Center" | "Guide" };

const STOP = new Set("a an and are as at be but by can do does for from get got have how i if in is it its me my of on or our so that the their them then there this to us was we what when where which who why will with you your im ive dont cant".split(" "));
/** A few ways people ask that our content words differently. */
const SAME: Record<string, string> = {
  refunds: "refund", money: "royalties", paid: "royalties", pay: "royalties", payment: "royalties", royalty: "royalties",
  splitsheet: "split", splits: "split", contracts: "contract", sign: "signature", signing: "signature", esign: "signature",
  embedding: "embed", embedded: "embed", tag: "embed", tags: "embed", tagging: "embed", metadata: "embed",
  cancel: "cancellation", canceling: "cancellation", cancelling: "cancellation", price: "plans", pricing: "plans", cost: "plans", plan: "plans",
  ai: "protection", certificate: "protection", certificates: "protection", bitcoin: "protection",
  register: "registration", registering: "registration", registered: "registration", pro: "pro", ascap: "pro", bmi: "pro", sesac: "pro",
  isrcs: "isrc", upcs: "upc", songs: "song", writers: "writer", publishers: "publisher", password: "login", signin: "login",
};

const words = (s: string) => (s.toLowerCase().replace(/[’']/g, "").match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 1 && !STOP.has(w)).map((w) => SAME[w] ?? w);

type Entry = HelpAnswer & { terms: string[]; titleTerms: Set<string> };

/** Account basics people ask the chat that aren't FAQ questions. */
const BASICS: HelpAnswer[] = [
  { id: "basic-password", title: "How do I reset my password?", text: "On the sign-in form, click Forgot password?, enter your email and follow the link we send you. Passwords need at least 12 characters. Already signed in? Profile → Change password.", source: "FAQ" },
  { id: "basic-contact", title: "How do I reach a person?", text: "Open a support ticket and our team answers by email. For billing questions, choose Billing so it goes straight to billing@camethroughaudio.com.", link: { label: "Open a support ticket", to: "/contact?type=support" }, source: "FAQ" },
];

function entries(): Entry[] {
  const list: HelpAnswer[] = [
    ...BASICS,
    ...FAQS.map((f, i) => ({ id: `faq-${i}`, title: f.q, text: f.a, link: { label: "See all questions", to: "/faq" }, source: "FAQ" as const })),
    ...Object.entries(GLOSSARY).map(([k, g]) => ({ id: `term-${k}`, title: `What is ${(g as { term: string }).term}?`, text: (g as { text: string }).text, source: "Glossary" as const })),
    ...DOCS.flatMap((d) => d.sections.map((s, i) => ({ id: `doc-${d.slug}-${i}`, title: `${d.title}: ${s.heading}`, text: [...(s.paragraphs ?? []), ...(s.bullets ?? [])].join(" "), link: { label: `Read "${d.title}"`, to: `/docs/${d.slug}` }, source: "Help Center" as const }))),
    ...GUIDES.map((g) => ({ id: `guide-${g.id}`, title: g.title, text: `${g.summary} The full step-by-step guide is in Contracts & Blueprints → Blueprints (Catalog Management).`, source: "Guide" as const })),
  ];
  return list.map((e) => ({ ...e, terms: words(`${e.title} ${e.text}`), titleTerms: new Set(words(e.title)) }));
}

let cache: { list: Entry[]; df: Map<string, number> } | undefined;
function index() {
  if (!cache) {
    const list = entries();
    const df = new Map<string, number>();
    for (const e of list) for (const t of new Set(e.terms)) df.set(t, (df.get(t) ?? 0) + 1);
    cache = { list, df };
  }
  return cache;
}

/** Best answers for a question: the top one and up to 2 related, or none when nothing matches well enough. */
export function searchHelp(question: string, limit = 3): HelpAnswer[] {
  const q = [...new Set(words(question))];
  if (!q.length) return [];
  // "What is…" / "What's…" asks for a definition, so the glossary leads.
  const define = /^\s*(what\s*(is|are|'?s)|define|meaning of)\b/i.test(question);
  const { list, df } = index();
  const n = list.length;
  const scored = list.map((e) => {
    let score = 0, hits = 0;
    for (const t of q) {
      const tf = e.terms.filter((x) => x === t).length;
      if (!tf) continue;
      hits++;
      const idf = Math.log(1 + n / (df.get(t) ?? 1));
      // Words in the question or term's title count most (a question that matches an FAQ question is the best answer).
      score += idf * (Math.min(tf, 3) / (1 + e.terms.length / 120)) + (e.titleTerms.has(t) ? idf * 1.5 : 0);
    }
    // FAQ answers are written for exactly this, so they win ties.
    const boost = e.source === "FAQ" ? 1.2 : define && e.source === "Glossary" ? 1.6 : 1;
    return { e, score: score * boost, coverage: hits / q.length };
  }).filter((s) => s.coverage >= (q.length === 1 ? 1 : 0.5) && s.score > 1.5).sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ e }) => ({ id: e.id, title: e.title, text: e.text, link: e.link, source: e.source }));
}
