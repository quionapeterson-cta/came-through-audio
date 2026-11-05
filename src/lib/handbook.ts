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
    "Being a member and working here is allowed, and it isn't a conflict by itself. Acting on your own account is: never work your own ticket, refund, split sheet, badge or registration. Hand it to another admin, and anything about your own money goes to the founder.",
  ] },
  { id: "support", title: "Answering customers", body: [
    "Give a typical wait, never a promise: most replies go out in about 48 hours, and high-volume days and holiday breaks take longer. If it already has, say so instead of letting the member guess. Be honest: never promise royalties, acceptance or timing; agencies decide those.",
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
  { id: "joining", title: "Joining the team", body: [
    "Staff sign in with their own email, separate from any member account they already have. Two identities, two passwords: a member account is never turned into a staff login, and staff access is never added to the account an artist works in.",
    "HR or a super admin invites from Admin → Staff: pick the role, pick the departments, then send it to the work address. An address that already belongs to a member account is refused on purpose — ask for a different one.",
    "The invite email is branded and lists the steps. The link opens our own page where the person chooses a password; it is not a sign-up form, and nobody has to land on one wondering what to do.",
    "If the link expires, Forgot password on the login page sends a branded email from admin@camethroughaudio.com within the hour.",
    "First day: open Admin → My Queue, read this handbook, and check My Recognition. A lead walks the new starter through their department's queue before they answer a customer alone.",
  ] },
  { id: "benefits", title: "Your own account while you work here", body: [
    "Your account is free while you work at Came Through Audio.",
    "Already paying? Nothing changes now, and nothing is refunded mid-year. When the time you paid for ends, the account moves to the staff plan instead of charging you again.",
    "Join with no paid plan and it is free from your first day.",
    "The staff plan ends on your last day. From then the usual plan rules apply, and the catalog follows the retention policy like any member's.",
    "Which plan the staff account gets is not decided yet: the founder sets it, and until then nothing here promises a tier or a feature list.",
    "Proposed extras, not switched on: a seat for an artist you manage, AI Protection credits, Expert Registration assistance, a brand kit for your own project and priority support. Each one needs the founder's number before it becomes an entitlement, so ask before you rely on it.",
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
