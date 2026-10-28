import { DOCS } from "@/lib/docs";
import { FAQS } from "@/lib/faq";
import { GLOSSARY } from "@/lib/glossary";
import { GUIDES } from "@/lib/guides";
import { PACKAGES } from "@/lib/proof";
import { PLAN_TIERS, TIER_LABEL } from "@/lib/plans";
import { BRANDING_PRICE } from "@/lib/brand-kit";
import { CONTRACT_PRICE } from "@/lib/contract-generator";
import { VAULT_PRICE } from "@/lib/retention";

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
  cancel: "cancellation", canceling: "cancellation", cancelling: "cancellation", price: "plans", prices: "plans", pricing: "plans", cost: "plans", costs: "plans", plan: "plans", much: "plans", fee: "plans", fees: "plans", expensive: "plans", charge: "plans",
  ai: "protection", certificate: "protection", certificates: "protection", bitcoin: "protection",
  register: "registration", registering: "registration", registered: "registration", pro: "pro", ascap: "pro", bmi: "pro", sesac: "pro",
  isrcs: "isrc", upcs: "upc", songs: "song", writers: "writer", publishers: "publisher", password: "login", signin: "login",
};

const words = (s: string) => (s.toLowerCase().replace(/[’']/g, "").match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 1 && !STOP.has(w)).map((w) => SAME[w] ?? w);

type Entry = HelpAnswer & { terms: string[]; titleTerms: Set<string> };

const money = (n: number) => `$${n.toFixed(2)}`;
const plans = PLAN_TIERS.filter((p) => p.tier !== "free").map((p) => `${TIER_LABEL[p.tier]} ${p.price}/year`).join(", ");

/**
 * Prices and the most-asked questions (founder, 2026-10-27: "How much is AI Protection" found nothing). Prices come
 * from the same settings checkout uses, so the answers change when the prices do.
 */
const ASKED: HelpAnswer[] = [
  { id: "price-ai", title: "How much does AI Protection cost?", text: `AI Protection certificates are one-time purchases: ${PACKAGES.map((p) => `${p.label.split(" ·")[0]} ${money(p.price)}${p.id === "Single" ? " per song" : ` for up to ${p.songs} songs`}`).join(", ")}. Each song gets a time-stamped certificate you can download and anyone can verify.`, link: { label: "Open the AI Protection Hub", to: "/workspace?tab=protect" }, source: "FAQ" },
  { id: "price-plans", title: "How much do the plans cost?", text: `The Free plan costs nothing. Paid plans are yearly: ${plans}. Upgrade any time and only pay the difference for the rest of your plan year.`, link: { label: "Compare plans", to: "/plans" }, source: "FAQ" },
  { id: "price-expert", title: "How much is Expert Registration?", text: "Our team registers your songs for you: a setup fee of $14.99 for a single or EP or $29.99 for an album, plus $4.99 per song for each organization (ASCAP or BMI, The MLC, SoundExchange). Refundable for 30 days, until our team starts work.", link: { label: "Start Expert Registration", to: "/workspace?tab=health&view=expert" }, source: "FAQ" },
  { id: "price-branding", title: "How much is a Branding Kit?", text: `${BRANDING_PRICE} per kit per year, on any plan (Catalog Management includes one). Your logo, colors and font replace our header on your contracts; you can have a kit for each business.`, link: { label: "Set up your Branding Kit", to: "/profile#brand-kit" }, source: "FAQ" },
  { id: "price-contract", title: "How much is a generated contract?", text: `Describe your deal and the Contract Generator drafts it from our blueprints. Opening a draft as your contract is ${CONTRACT_PRICE}, on any plan, and you can send it for e-signature.`, source: "FAQ" },
  { id: "price-vault", title: "How much is the Vault (pause)?", text: `Once every 12 months you can pause your plan for 1 to 3 months for ${money(VAULT_PRICE)} per month. Your catalog stays safe and read-only while paused.`, source: "FAQ" },
  { id: "ask-embed-vs-register", title: "What's the difference between embedding and registering?", text: "Embedding writes your credits and codes into the audio file itself, so the song carries its details wherever it goes. Registering tells the organizations that collect royalties (your PRO, The MLC, SoundExchange) that the song exists and who gets paid. You need both: embedding doesn't register a song.", source: "FAQ" },
  { id: "ask-which-pro", title: "Do I need a PRO, and which one should I join?", text: "If you write songs, yes: a PRO (performing rights organization) collects your performance royalties. In the US the main ones are ASCAP and BMI (SESAC and GMR are invitation-only). You can only belong to one as a writer. Both are fine; compare their sign-up steps and pick one.", source: "FAQ" },
  { id: "ask-cancel", title: "How do I cancel or pause my plan?", text: "Profile → Account. You can turn off renewal, push your renewal back 30 days once a year at no charge, or pause for 1 to 3 months with the Vault. Your songs stay downloadable either way.", link: { label: "Go to Profile", to: "/profile" }, source: "FAQ" },
  { id: "ask-change-email", title: "How do I change my email or password?", text: "Profile → Account → Change email or Change password. Both ask for your current password. A new email changes once you click the link we send to it.", link: { label: "Go to Profile", to: "/profile" }, source: "FAQ" },
  { id: "ask-badges", title: "What do badges do?", text: "Badges celebrate your progress as you catalog, register and protect your music. Share them to show your work. They have no cash value. Want to earn them again from the start? Profile → Badge settings → Reset my badges.", source: "FAQ" },
  { id: "ask-invite-split", title: "How do I invite a collaborator to sign a split sheet?", text: "Split Sheets → choose the song → Generate. Add each collaborator's name, email and share, sign as the owner, then send. They get an email to review and sign, plus a free 30-day Catalog & Collaborate trial. Collecting e-signatures starts with Catalog & Collaborate.", source: "FAQ" },
  { id: "ask-private", title: "Is my music private?", text: "Yes. Your catalog, masters, splits, PRO and IPI numbers are visible only to you. Only what you choose to share (a share card, a split sheet you send) is seen by others.", source: "FAQ" },
];

/** Account basics people ask the chat that aren't FAQ questions. */
const BASICS: HelpAnswer[] = [
  ...ASKED,
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
