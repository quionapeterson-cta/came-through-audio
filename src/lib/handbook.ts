/**
 * Team handbook (PLAN-phase4-order item 10, approved 2026-10-25): what every new team member needs, in Admin →
 * Handbook, searchable together with the customer answer library (help-search.ts). Keep it in step with BRANDING.md,
 * the email routing and the policies; the founder reviews changes.
 */
export type HandbookSection = { id: string; title: string; body: string[] };

export const HANDBOOK: HandbookSection[] = [
  { id: "welcome", title: "Welcome to Came Through Audio", body: [
    "We are YOUR FIRST STOP BEFORE DISTRIBUTION: artists embed their credits, organize their catalog, settle splits and get every song registered, so the money they earn can find them.",
    "Came Through Audio came through for every artist we help. That's the standard: careful, honest and kind.",
  ] },
  { id: "how-we-work", title: "How we work", body: [
    "We thank people for outcomes and quality, never hours. No late night or weekend heroics.",
    "Your day: open Admin → My Queue. Start the item you're working on; if something urgent comes in, pause it with a note on where you left off, handle the urgent one, then resume.",
    "Plans and ideas live in the Task Bank (with deadlines and owners); meetings and dates in the Calendar. Your staff badges are in My Recognition.",
  ] },
  { id: "voice", title: "Brand and voice", body: [
    "Black and white first, Cobalt Blue as the accent. Gold and Platinum only for badges.",
    "Write like a real person: short sentences, plain words, no fancy dashes or buzzwords. Never gendered words or fixed names; use the artist's own name.",
    "Lead with the tagline YOUR FIRST STOP BEFORE DISTRIBUTION and \"Came Through\". Crowns and \"Don't let em knock you out cho'crown\" are the founder's personal branding, used only now and then.",
  ] },
  { id: "privacy", title: "Customer privacy and security", body: [
    "Never share a customer's PRO, IPI numbers, splits, contracts or files with anyone but them. Never put customer data on a personal device or in a personal account.",
    "Nobody on staff can give a customer paid access or change their plan by hand; payments come from Stripe. Staff access is granted only in Admin → Staff.",
    "Use a password manager and two-step sign-in. Report anything suspicious to the founder right away.",
  ] },
  { id: "support", title: "Answering customers", body: [
    "First reply within 4 business hours. Be honest: never promise royalties, acceptance or timing; agencies decide those.",
    "Billing questions belong to billing@camethroughaudio.com; general support to support@; contact messages to info@.",
    "Not legal, financial or tax advice: point people to a music attorney or accountant for their situation.",
  ] },
  { id: "registration", title: "Registration basics", body: [
    "A song is Ready when it has an author (or is instrumental), a composer, and every writer has a legal name. Splits must total exactly 100% before we register; publisher shares are 100% of the publisher half.",
    "BMI writers with no publishing company need no publisher at BMI (BMI pays them the publisher share). The MLC bulk file lists them as publisher with the placeholder IPI 123456789, which is removed in The MLC Portal after upload.",
    "Always register under each writer's legal name, and tick Registered in the checklist once it's filed.",
  ] },
  { id: "email", title: "Which mailbox", body: [
    "billing@: payments, renewals, refunds. support@: support tickets. info@: Contact Us. legal@: legal questions. admin@: staff access. collaborate@: split sheets, contracts and invites. registrations@: Expert Registration. partnerships@: company outreach.",
  ] },
  { id: "escalate", title: "When you're stuck", body: [
    "Ask your department lead first, then the founder. Anything about money, legal terms or a customer's safety goes to the founder the same day.",
  ] },
];

/** Tutorial videos the founder will record; each shows as coming soon until it has a link. */
export const TUTORIALS: { title: string; url?: string }[] = [
  { title: "A tour of Admin" }, { title: "Working the registration queue" }, { title: "Answering a support ticket" },
  { title: "Using My Queue, the Task Bank and the Calendar" }, { title: "How royalties work: PROs, The MLC and SoundExchange" },
];

const words = (s: string) => (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2);

/** Handbook sections that mention every word of the search. */
export function searchHandbook(query: string): HandbookSection[] {
  const q = words(query);
  if (!q.length) return [];
  return HANDBOOK.filter((s) => { const text = `${s.title} ${s.body.join(" ")}`.toLowerCase(); return q.every((w) => text.includes(w)); });
}
