/**
 * Support scripts (founder, 2026-11-05): the words to send, per department, so a ticket is answered the same way
 * whoever is on the desk. Support is its own department and owns the ticket queue; Billing answers its own billing
 * tickets (see `ticketOwnerDepartment`), and every other department owns the scripts for its own questions.
 *
 * These are replies, not policy. Where a script says what we pay or promise, the rule behind it lives in
 * BILLING-POLICY.md and the server; a change to a promise changes both. Scripts are code on purpose: no database table
 * to fall out of step, and a super admin ships a wording change the same way as any other change.
 *
 * Every script is readable by every staff member (Admin → Support Scripts). Only Support and Billing can *read* a
 * member's ticket, and a billing ticket is Billing's alone.
 */
import { DEPARTMENT_LABEL, type Department } from "./departments";
import { BILLING_AREA } from "./support-topics";

export type SupportScript = {
  id: string;
  /** The department whose questions this answers. Anyone may read it; this is who owns the wording. */
  department: Department;
  title: string;
  /** When to use it, in one line, so nobody has to guess between two similar scripts. */
  when: string;
  /** The reply. `{{placeholders}}` are filled in the panel before copying. */
  body: string;
  /** Staff-only wording: never sent to a member. */
  internal?: true;
};

/** The values the panel offers for filling a script. Anything else stays as a visible placeholder on purpose. */
export const SCRIPT_VARIABLES = ["first_name", "plan", "amount", "date", "detail"] as const;
export type ScriptVariable = (typeof SCRIPT_VARIABLES)[number];

const REFUND_DAYS = 30;

export const SUPPORT_SCRIPTS: readonly SupportScript[] = [
  // ── Billing ────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "billing-refund-approved",
    department: "billing",
    title: "Refund approved (inside 30 days)",
    when: "A refund is approved and the payment is inside the 30-day window, so it is the full amount.",
    body: "Hi {{first_name}},\n\nYour refund of {{amount}} is approved. It goes back to the card you paid with, and most banks show it in 5–10 business days.\n\nYour access stays open until {{date}}. Nothing else is needed from you.\n\nCame Through Audio",
  },
  {
    id: "billing-refund-prorated",
    department: "billing",
    title: "Plan cancelled after 30 days (unused time only)",
    when: "A yearly plan is cancelled past the 30-day window, so the refund covers the days they did not use.",
    body: "Hi {{first_name}},\n\nWe've cancelled your {{plan}} plan. Because you're past the first 30 days, the refund covers the time you haven't used: {{amount}}.\n\nIt goes back to your card, usually within 5–10 business days. You keep every feature until {{date}}.\n\nCame Through Audio",
  },
  {
    id: "billing-duplicate-confirmed",
    department: "billing",
    title: "Duplicate charge — confirmed and refunded",
    when: "Two separate payments for the same thing both settled, and the newer one has been refunded.",
    body: "Hi {{first_name}},\n\nYou're right — there were two payments of {{amount}} on {{date}} for {{detail}}. Both went through, and only one was owed.\n\nWe've refunded the newer one. It goes back to the card you paid with, usually within 5–10 business days. The first payment stays, and your access is unchanged.\n\nCame Through Audio",
  },
  {
    id: "billing-duplicate-is-a-hold",
    department: "billing",
    title: "It looks like two charges, but one is a hold",
    when: "One of the lines is an authorization that hasn't settled. Never refund this — it clears by itself.",
    body: "Hi {{first_name}},\n\nThanks for sending that over. One of the two lines is an authorization, not a charge: your bank is holding the amount while the payment finishes, and it disappears on its own — normally within a week, by {{date}}, and always within 30 days.\n\nOnly one payment has actually left your account, so there's nothing to refund. If the extra line is still there after {{date}}, reply to this email and we'll look again with you.\n\nCame Through Audio",
  },
  {
    id: "billing-card-declined",
    department: "billing",
    title: "Card declined or payment failed",
    when: "A renewal or purchase failed and access is about to lapse.",
    body: "Hi {{first_name}},\n\nYour payment for {{plan}} didn't go through — the bank declined the card, which is usually an expiry date, a limit or a block on recurring payments.\n\nYou can update the card in your account under Profile → Billing, and the payment will retry. If you'd rather pay another way, reply here and we'll sort it out.\n\nPlease never send card numbers by email. We don't need them and can't store them.\n\nCame Through Audio",
  },
  {
    id: "billing-pause-is-not-cancel",
    department: "billing",
    title: "Pausing is not cancelling",
    when: "Someone paused believing it cancelled the plan, or is asking whether a pause stops the renewal.",
    body: "Hi {{first_name}},\n\nJust so there are no surprises: pausing stops the billing for the length of the pause, then your plan renews by itself on {{date}}. It isn't a cancellation.\n\nIf you meant to cancel, reply to this email and we'll do it for you — and if the renewal has already charged you after a pause you thought was a cancellation, we'll refund the unused time.\n\nCame Through Audio",
  },
  {
    id: "billing-cancelled-what-happens",
    department: "billing",
    title: "Cancelled — what happens to the music",
    when: "A plan is cancelled and they ask whether their catalog survives.",
    body: "Hi {{first_name}},\n\nYour plan is cancelled and won't renew. You keep everything until {{date}}.\n\nAfter that your account moves to the Free plan: your catalog stays read-only and nothing is emptied, so you can download everything or start a paid plan again whenever you're ready. Signed split sheets, contracts and AI certificates are always kept.\n\nCame Through Audio",
  },
  {
    id: "billing-seat-handed-over",
    department: "billing",
    title: "Artist seat handed over to the artist",
    when: "An owner asks why an artist seat stopped, or either side asks what an artist taking their plan over means.",
    body: "Hi {{first_name}},\n\n{{detail}} is paying for their own plan now. Their first charge is at the seat's renewal on {{date}}, and nothing was charged at the handoff.\n\nThe seat you paid for stops renewing from that date. The time already paid for is not refunded or credited, and your access to their catalog, split sheets and contracts ended when the handoff completed. Your own plan and your other seats are unchanged.\n\nCame Through Audio",
  },
  {
    id: "billing-inactive-deletion",
    department: "billing",
    title: "An account is due for deletion after two years of inactivity",
    when: "A member asks about the inactivity emails, or wants the scheduled deletion stopped.",
    body: "Hi {{first_name}},\n\nThis account has had no sign-in for two years, so it reaches its date on {{date}}. Upgrading before then keeps the account and every stored file.\n\nOn the date, an account still on Free loses the files stored for it (masters, artwork and anything else in storage) and its catalog entries. Signing in keeps the account on Free, but not the files or catalog. An account that never signs in is deleted with its files and catalog.\n\nDownload anything you want to keep before {{date}}. A plan ending is different and much less serious: that never deletes an account or empties a catalog, it just leaves it read-only on Free.\n\nCame Through Audio",
  },
  {
    id: "billing-keep-on-free",
    department: "billing",
    title: "Keeping a catalog on Free",
    when: "A member's plan has ended and they ask what happens to their catalog, or whether they have to pay to keep it.",
    body: "Hi {{first_name}},\n\nYour plan has ended, so your catalog is read-only on the Free plan. Nothing is emptied: your songs, masters and artwork stay exactly where they are, and you can download them or start a paid plan whenever you're ready.\n\nSigned split sheets, contracts and AI Protection certificates are always kept, and a plan ending never deletes your account.\n\nCame Through Audio",
  },

  // ── Support ────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "support-received",
    department: "support",
    title: "Ticket received",
    when: "First reply on any new ticket, before anyone has looked into it.",
    body: "Hi {{first_name}},\n\nThanks for writing in — we have your message about {{detail}} and a person is looking at it now. We're a small team: most replies go out in about 48 hours. On high-volume days and around holidays they take longer, and we'll say so rather than let you guess.\n\nIf you think of anything that helps (a screenshot, the song name, the email on the account), just reply to this email and it lands on the same ticket.\n\nCame Through Audio Support",
  },
  {
    id: "support-need-detail",
    department: "support",
    title: "We need one more detail",
    when: "The ticket can't be answered without a specific piece of information.",
    body: "Hi {{first_name}},\n\nI can fix this, but I need one thing first: {{detail}}.\n\nOnce you send that, I'll pick it straight back up. You don't need to open a new ticket — replying here is enough.\n\nCame Through Audio Support",
  },
  {
    id: "support-resolved",
    department: "support",
    title: "Resolved — closing the ticket",
    when: "The issue is fixed and the ticket is being marked resolved.",
    body: "Hi {{first_name}},\n\nThat's sorted: {{detail}}. I'm closing this ticket, but replying to this email reopens it if anything comes back.\n\nIf it was a good experience, telling us what worked helps us keep doing it.\n\nCame Through Audio Support",
  },
  {
    id: "support-hand-off",
    department: "support",
    title: "Handing a ticket to the right department",
    when: "The question belongs to another department (billing, registration, royalties, branding).",
    body: "Hi {{first_name}},\n\nThanks for your patience. This one belongs with our {{detail}} team, so I've passed it to them with your message and account details — you don't need to write it out again.\n\nThey'll reply from here, on this same ticket.\n\nCame Through Audio Support",
  },

  // ── Registration ───────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "registration-missing-writers",
    department: "registration",
    title: "Registration is waiting on writer details",
    when: "A song can't be registered until a writer's legal name, PRO, IPI or share is filled in.",
    body: "Hi {{first_name}},\n\nYour registration for {{detail}} is ready to send, but a song on it is missing writer information. Registration needs each writer's legal name, their PRO, their IPI number and their share adding to 100%.\n\nYou can fill those in from the song's page in My Catalog; the checklist tells you exactly which field is missing. Reply here once it's saved and we'll send it that day.\n\nCame Through Audio Registration",
  },
  {
    id: "registration-isrc",
    department: "registration",
    title: "An ISRC is needed before we can send this",
    when: "The MLC or SoundExchange registration is blocked on a missing ISRC (ASCAP and BMI never need one).",
    body: "Hi {{first_name}},\n\n{{detail}} can go ahead as soon as the recording has an ISRC. The MLC and SoundExchange register the recording itself, so they need it; ASCAP and BMI register the song and don't ask for it.\n\nIf you already have one, add it on the song's page and reply here. If you don't, tell us and we'll explain how to get one through your distributor.\n\nCame Through Audio Registration",
  },
  {
    id: "registration-submitted",
    department: "registration",
    title: "Sent to the agency",
    when: "A registration has been submitted and they are waiting.",
    body: "Hi {{first_name}},\n\n{{detail}} has been submitted. The agency confirms in its own time — usually a few weeks — and we watch for the confirmation and update your song as soon as it lands.\n\nYou don't need to do anything. If the agency comes back with a question, we'll bring it to you on this ticket.\n\nCame Through Audio Registration",
  },

  // ── Royalty Accounts ───────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "royalty-splits-not-100",
    department: "royalty_accounts",
    title: "Splits don't add up to 100%",
    when: "A split sheet is blocked because writer or publisher shares don't total exactly 100%.",
    body: "Hi {{first_name}},\n\nThe split sheet for {{detail}} can't go out yet because the shares don't add up to 100%. Registration needs the writer shares to total exactly 100%, and if a publisher is listed, the publisher shares to total 100% of the publisher half as well.\n\nYou can edit the shares on the song's split sheet and resend it. Everyone who already signed will be asked to sign the corrected version.\n\nCame Through Audio Royalties",
  },
  {
    id: "royalty-sheet-signed",
    department: "royalty_accounts",
    title: "Everyone has signed",
    when: "The last collaborator signs a split sheet.",
    body: "Hi {{first_name}},\n\nGood news: everyone has signed the split sheet for {{detail}}. The signed copy is on the song's page, and you can download it whenever you need it.\n\nIt stays there even if your plan changes.\n\nCame Through Audio Royalties",
  },
  {
    id: "royalty-statement-problem",
    department: "royalty_accounts",
    title: "A royalty statement won't read",
    when: "An uploaded agency statement fails to parse or shows the wrong totals.",
    body: "Hi {{first_name}},\n\nThanks for flagging this. The statement from {{detail}} didn't read the way it should, so please don't rely on those totals yet.\n\nIf you still have the original file, reply with it attached and we'll run it again. Nothing about your catalog or your registrations is affected.\n\nCame Through Audio Royalties",
  },

  // ── Finance ────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "finance-receipt",
    department: "finance",
    title: "Receipt or invoice request",
    when: "Someone needs a receipt or an invoice for a payment.",
    body: "Hi {{first_name}},\n\nYour receipt for {{amount}} on {{date}} is attached. It's the same document Stripe emails at the time of payment, so it's the one to give your accountant.\n\nIf you need it in a company name or with a tax number on it, reply with those details and we'll issue a fresh one.\n\nCame Through Audio Finance",
  },
  {
    id: "finance-charge-question",
    department: "finance",
    title: "A charge they don't recognise",
    when: "Somebody asks what a card charge was. Hand anything that may need money back to Billing.",
    body: "Hi {{first_name}},\n\nThat charge is from Came Through Audio — it appears on statements as CAME THROUGH AUDIO (or CAMETHROU). It was for {{detail}} on {{date}}.\n\nIf you didn't expect it, or you think it's wrong, reply and we'll look at the payment with you. Nothing needs to be disputed with your bank while we sort it out here.\n\nCame Through Audio Finance",
  },

  // ── Branding ───────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "branding-kit-setup",
    department: "branding",
    title: "Brand kit files and colours",
    when: "Someone is setting up a personal branding kit and asks what to upload.",
    body: "Hi {{first_name}},\n\nFor your kit, send a logo as a PNG with a transparent background (at least 900px wide), your business or DBA name exactly as it should print, and your colours as hex codes if you have them.\n\nOnce it's saved, it replaces our header on the documents you choose — contracts, split sheets, lyric sheets and catalog exports — while split sheets keep the artist's stage name where they should.\n\nCame Through Audio Branding",
  },
  {
    id: "branding-kit-not-showing",
    department: "branding",
    title: "The kit isn't showing on a document",
    when: "A member paid for or has a kit but a downloaded document still has our header.",
    body: "Hi {{first_name}},\n\nLet's get that fixed. Two things to check: the kit is switched on in Profile → Brand kit, and the document type is one the kit covers.\n\nIf both look right, reply with the document you downloaded and we'll trace it. A kit never blocks a download — the document simply keeps our header until it's sorted.\n\nCame Through Audio Branding",
  },

  // ── Marketing & Social Media ──────────────────────────────────────────────────────────────────────────────────
  {
    id: "marketing-feature-request",
    department: "marketing",
    title: "Feature or partnership enquiry",
    when: "Someone wants to be featured, partner with us, or asks about press.",
    body: "Hi {{first_name}},\n\nThanks for thinking of us. I've passed this to the team that handles features and partnerships, and they'll come back to you if it's a fit.\n\nSo we can consider it properly, reply with a link to your work and the timing you have in mind.\n\nCame Through Audio",
  },
  {
    id: "marketing-social-tag",
    department: "marketing",
    title: "Tagging us or asking for a repost",
    when: "A member shares our content and asks to be shared.",
    body: "Hi {{first_name}},\n\nAppreciate the share — tag @camethroughaudio and we'll take a look. We keep the feed to releases, tools and member wins, so not everything gets reposted, but we do see every tag.\n\nIf you have a release coming, send the date and we'll try to line it up.\n\nCame Through Audio",
  },

  // ── Sales ─────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "sales-plan-fit",
    department: "marketing_sales",
    title: "Which plan fits",
    when: "A pre-signup question about choosing between plans.",
    body: "Hi {{first_name}},\n\nFor {{detail}}, the short version: Catalog & Collaborate is the one for releasing and registering songs with splits and agency exports, and Catalog Management adds the deeper catalog tooling and a branding kit. Seats are for artists you work with, not for you.\n\nIf you tell me how many songs and how many artists you handle, I'll tell you which one you'd actually use — and there's no harm starting smaller and moving up.\n\nCame Through Audio",
  },
  {
    id: "sales-trial",
    department: "marketing_sales",
    title: "Trial and upgrading",
    when: "They ask what the trial includes or how an upgrade bills.",
    body: "Hi {{first_name}},\n\nYour trial gives you the paid features for {{detail}} days, and we email you before it ends — nothing charges by surprise. If you upgrade, you pay the yearly price and keep everything you made during the trial.\n\nIf you'd rather not continue, you can cancel from your account in two clicks, and the site tells you the exact date it ends.\n\nCame Through Audio",
  },

  // ── AI ────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "ai-seal-pending",
    department: "ai",
    title: "Certificate waiting on the Bitcoin seal",
    when: "A certificate is issued but the blockchain confirmation is still pending.",
    body: "Hi {{first_name}},\n\nYour certificate for {{detail}} is valid now and downloads straight away. The Bitcoin seal is still being written — that usually takes a few hours and can take up to a day — and it's added to the same certificate automatically.\n\nYou don't need to do anything, and you don't need to request it again.\n\nCame Through Audio AI Protection",
  },
  {
    id: "ai-what-is-covered",
    department: "ai",
    title: "What AI Protection covers",
    when: "A pre-purchase question about what is registered and what the certificate proves.",
    body: "Hi {{first_name}},\n\nAI Protection records the work you upload — a single, an EP or an album — and issues a timestamped certificate with a Bitcoin seal, so you can show the date and the exact file you had.\n\nIt records ownership evidence, not a copyright registration: it sits alongside your PRO registration rather than replacing it. Happy to walk through the difference for {{detail}} if that helps.\n\nCame Through Audio AI Protection",
  },

  // ── Software ─────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "software-bug-received",
    department: "software",
    title: "Bug report — received, and what we need",
    when: "A member reports something broken in the app.",
    body: "Hi {{first_name}},\n\nThanks — I've logged the problem with {{detail}}. To reproduce it quickly, could you send the device and browser you were using, and what you expected to happen instead?\n\nIf you can, a screenshot of the error helps most of all. Your data is safe; nothing you saved is lost by this.\n\nCame Through Audio",
  },
  {
    id: "software-feature-logged",
    department: "software",
    title: "Feature request logged",
    when: "A member asks for something the app doesn't do yet.",
    body: "Hi {{first_name}},\n\nThanks for the idea about {{detail}} — I've logged it for the team that decides what we build next. We don't promise dates, and we do read every one.\n\nIn the meantime, tell me what you're trying to get done and I'll see whether there's a way to do it today.\n\nCame Through Audio",
  },

  // ── Security ──────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "security-password-reset",
    department: "security",
    title: "Password or 2FA reset",
    when: "Someone can't get into their account.",
    body: "Hi {{first_name}},\n\nUse Forgot password on the sign-in page — the reset link goes to the email on the account and works for one hour.\n\nIf the email never arrives, check the spam folder, then reply here from any address and tell us the account email. We'll never ask you for your password, and we won't send one.\n\nCame Through Audio",
  },
  {
    id: "security-suspicious-login",
    department: "security",
    title: "Suspicious sign-in or changed details",
    when: "A member reports activity they don't recognise, or a changed email or payout detail.",
    body: "Hi {{first_name}},\n\nThanks for telling us quickly — that's the right move. Change your password now if you still can, and reply with the time you noticed and anything that looks different.\n\nWe'll check the account's sign-in history and what changed, and we'll tell you plainly what we find. Please don't send passwords, card numbers or ID documents by email.\n\nCame Through Audio Security",
  },

  // ── HR (internal only) ───────────────────────────────────────────────────────────────────────────────────────
  {
    id: "hr-internal-applicant",
    department: "hr",
    title: "INTERNAL — applicant holding reply",
    when: "Internal only: acknowledging an application or a hiring question. Never send to a member.",
    internal: true,
    body: "INTERNAL ONLY — not a member reply.\n\nThanks for your interest in {{detail}}. We've received your application and will be in touch if there's a fit for the role.\n\nHR note: log the application in the applicant sheet before sending, and never promise a date or a salary range in writing.\n\nCame Through Audio HR",
  },

  // ── Market Research (internal only) ──────────────────────────────────────────────────────────────────────────
  {
    id: "research-internal-survey",
    department: "research",
    title: "INTERNAL — research request to the team",
    when: "Internal only: asking staff for input on a research question. Never send to a member.",
    internal: true,
    body: "INTERNAL ONLY — not a member reply.\n\nWe're looking at {{detail}} this month. If you've heard members ask about it — on a ticket, a call, or in a feature request — reply with the exact words they used.\n\nQuotes we can trace are worth more than opinions, and nothing is attributed to a member without their permission.\n\nCame Through Audio Research",
  },
  // ── Holiday breaks (every department sends these) ─────────────────────────────────────────────────────────────
  {
    id: "support-holiday-break",
    department: "support",
    title: "Holiday break — we're away",
    when: "Any ticket that arrives while the team is on a holiday break, before anyone has looked at it.",
    body: "Hi {{first_name}},\n\nThanks for writing in — your message is safe with us. The team is on a holiday break right now, so replies are slower than usual: most messages are answered in about 30 days after we reopen, and often sooner than that — a busy week can take longer.\n\nWe reopen on {{date}}. If something can't wait, reply and tell us what's most pressing, so it's first in line when we're back.\n\nCame Through Audio Support",
  },
  {
    id: "support-holiday-open-ticket",
    department: "support",
    title: "Holiday break — an open ticket is still waiting",
    when: "They write again on a ticket that is still open while the team is away.",
    body: "Hi {{first_name}},\n\nYou're not forgotten: your ticket is in the queue and nobody needs to send it again. We're on a holiday break until {{date}}, and messages are answered in about 30 days after we reopen, usually sooner.\n\nIf it's something new, add it here so it's on the same ticket when we're back.\n\nCame Through Audio Support",
  },
  {
    id: "support-holiday-internal",
    department: "support",
    title: "INTERNAL — before a holiday break",
    when: "Internal only: the checklist to run before Christmas and New Year, Thanksgiving and spring break. Never send to a member.",
    internal: true,
    body: "INTERNAL ONLY — not a member reply.\n\nBefore every break — Christmas and New Year, Thanksgiving and spring break — run this in order:\n1. Post the holiday script on every open ticket, naming the day we reopen.\n2. Turn on the mailbox auto-reply with the same wording and the same date.\n3. Hand anything urgent, money-related or legal to the founder before we close.\n4. Never invent a reopening date: the founder sets it each year.\n\nMembers are told 30 days or more during a break. Anything still unanswered 30 days after we reopen goes to the founder that day.\n\nCame Through Audio Support",
  },
];

/** Scripts for one department, or all of them, in catalog order. */
export function scriptsFor(department: Department | "all"): SupportScript[] {
  return SUPPORT_SCRIPTS.filter((s) => department === "all" || s.department === department);
}

/** Search over the title, the "when" line, the body and the id, newest wording regardless of case. */
export function searchScripts(query: string, department: Department | "all" = "all"): SupportScript[] {
  const q = query.trim().toLowerCase();
  const list = scriptsFor(department);
  if (!q) return list;
  return list.filter((s) => `${s.title} ${s.when} ${s.body} ${s.id}`.toLowerCase().includes(q));
}

/** Departments that have at least one script, in dashboard order, for the panel's filter chips. */
export function scriptDepartments(): { department: Department; label: string; count: number }[] {
  const seen: Department[] = [];
  for (const s of SUPPORT_SCRIPTS) if (!seen.includes(s.department)) seen.push(s.department);
  return seen.map((department) => ({
    department,
    label: DEPARTMENT_LABEL[department],
    count: SUPPORT_SCRIPTS.filter((s) => s.department === department).length,
  }));
}

/** Every `{{placeholder}}` a body uses, once each, in the order it appears. */
export function scriptVariables(body: string): string[] {
  const found = body.match(/\{\{\s*[a-z_]+\s*\}\}/gi) ?? [];
  return [...new Set(found.map((m) => m.replace(/[{}]/g, "").trim()))];
}

/**
 * Fills the placeholders it was given and leaves the rest visible as `{{detail}}`, so an unfilled value is obvious in
 * the draft instead of silently becoming an empty gap the member reads.
 */
export function fillScript(body: string, values: Partial<Record<string, string>>): string {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, key: string) => {
    const value = values[key]?.trim();
    return value ? value : whole;
  });
}

/**
 * Which scripts usually answer which area (founder, 2026-11-08): the rail opens on the three most likely rows instead of
 * the whole catalog, and staff can still scroll or search everything. Ids only — the wording stays where it already is,
 * and a suggestion outside the ticket owner's department (or marked internal) is dropped rather than offered.
 */
const SUGGESTED_BY_AREA: Record<string, string[]> = {
  "Embed Metadata": ["support-received", "support-need-detail"],
  "My Catalog": ["support-received", "software-bug-received"],
  "Royalty Health Hub": ["support-need-detail", "support-received"],
  "AI Protection Hub": ["support-received", "support-need-detail"],
  "Split Sheets": ["support-need-detail", "support-received"],
  "Contracts & Blueprints": ["support-need-detail", "support-received"],
  "PDF Fill & Sign": ["support-need-detail", "support-received"],
  "Account & billing": ["billing-duplicate-is-a-hold", "billing-refund-approved", "billing-card-declined", "billing-pause-is-not-cancel"],
  "Something else": ["support-received", "support-need-detail"],
};

/** The area half of a stored "Area · Issue" category. */
export function ticketArea(category: string): string {
  return category.split("·")[0]?.trim() ?? "";
}

/** The scripts worth putting first for this ticket's area, limited to the queue owner's member-facing wording. */
export function suggestedScripts(category: string): SupportScript[] {
  const owned = scriptsForTicket(category);
  const ids = SUGGESTED_BY_AREA[ticketArea(category)] ?? [];
  return ids
    .map((id) => owned.find((s) => s.id === id))
    .filter((s): s is SupportScript => !!s && !s.internal)
    .slice(0, 3);
}

/**
 * Who answers a ticket. Support owns the queue for everything; Billing answers its own billing tickets
 * (founder, 2026-11-05), which is why a billing ticket never appears in Support's pile by accident.
 */
export function ticketOwnerDepartment(category: string): "support" | "billing" {
  return category.trim().toLowerCase().startsWith(BILLING_AREA.toLowerCase()) ? "billing" : "support";
}

/** True when this category is Billing's to answer. Mirrors the RLS policy and the inbox routing. */
export function isBillingTicket(category: string): boolean {
  return ticketOwnerDepartment(category) === "billing";
}

/**
 * The scripts to offer inside a ticket (founder, 2026-11-05): the queue owner's wording, one click from the message —
 * Billing's on a billing ticket, Support's otherwise. The whole catalog is still Admin → Support Scripts.
 */
export function scriptsForTicket(category: string): SupportScript[] {
  return scriptsFor(ticketOwnerDepartment(category));
}

/**
 * What a ticket fills in by itself: the member's first name, and the subject as the detail line. Everything else stays
 * a visible `{{placeholder}}`, so an unfilled amount is obvious before it is sent.
 */
export function ticketScriptValues(ticket: { name: string; subject: string }): Record<string, string> {
  const first = ticket.name.trim().split(/\s+/)[0] ?? "";
  const detail = ticket.subject.trim();
  return { ...(first ? { first_name: first } : {}), ...(detail ? { detail } : {}) };
}

/** The 30-day window the scripts quote, kept next to them so the wording and the rule cannot drift apart. */
export const SCRIPT_REFUND_WINDOW_DAYS = REFUND_DAYS;
