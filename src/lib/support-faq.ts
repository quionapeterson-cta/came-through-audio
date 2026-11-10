import type { TicketArea } from "./support-topics";

/**
 * The answers a member meets before the ticket form (founder, 2026-11-10): the handful of things Support is asked most,
 * written so the common case is fixed on the spot instead of waiting for a reply. They sit above the form on the
 * Support Ticket tab and link out to the full FAQ for anything broader.
 *
 * Two rules carried from the ticket queue: reply time is a typical wait, never a promise, and nothing here carries a
 * number, date or allowance the founder has not approved. Changes to what we promise (the refund window, seats, plans)
 * change `src/lib/faq.ts` and `BILLING-POLICY.md` in the same commit.
 */
export type SupportFaq = { q: string; a: string; area: TicketArea };

export const SUPPORT_FAQ_HEADING = "Before you open a ticket: quick answers";
export const SUPPORT_FAQ_INTRO =
  "Most tickets are one of these, and the fix is faster than a reply. If yours isn't here, the form is right below and we'll take a look: most replies go out in about 48 hours, and a busy week or a holiday break can take longer.";

export const SUPPORT_FAQS: SupportFaq[] = [
  {
    area: "Embed Metadata",
    q: "The finished file looks wrong in another app",
    a: "Embedding writes your credits inside the file, so any player that shows a title and artist reads them from there. Some players keep an old copy of a file's details: remove it and add it again, or try the file somewhere else. If a field is missing, open the song, check the field was filled in, and embed again — re-embedding never deletes anything.",
  },
  {
    area: "Embed Metadata",
    q: "The download didn't start",
    a: "Look for the download icon in your browser's toolbar first, and check the browser isn't blocking downloads from camethroughaudio.com. A large master can take a moment to prepare. If it still won't save, tell us which browser you're on when you open the ticket.",
  },
  {
    area: "My Catalog",
    q: "A song won't save",
    a: "Two things usually explain it. On the Free plan the catalog you already built stays read-only, so you can view and download it but not add or edit; a paid plan turns editing back on. Otherwise a required field is still blank — the form marks it, and the save says what is missing.",
  },
  {
    area: "My Catalog",
    q: "I can't find a song I added",
    a: "If your account holds artist seats, the workspace switcher at the top of the page decides whose catalog you're looking at, and each seat has its own. Switch to the artist it belongs to and the song is there.",
  },
  {
    area: "My Catalog",
    q: "Where did my download go?",
    a: "Downloads save to your browser's usual folder, usually Downloads. A whole-catalog download arrives as one ZIP with MP3 & WAV, Artwork and Lyrics folders (split into Singles, EPs and Albums) and Catalog.pdf at the top.",
  },
  {
    area: "Split Sheets",
    q: "My splits won't save or send",
    a: "Writer shares have to add up to exactly 100%. If you listed a publisher, the publisher shares also have to total 100% of the publisher half — not of the whole song. The sheet names the field that is off.",
  },
  {
    area: "Split Sheets",
    q: "A co-writer can't open the sheet",
    a: "Signing is free for them: they create an account with the address you sent it to, then sign. Ask them to check their spam folder, and to open the newest email if you sent it more than once, because each send mails a fresh link.",
  },
  {
    area: "Royalty Health Hub",
    q: "A song is flagged that I know is registered",
    a: "The score counts what the agency needs to find and pay the song: the codes, the exact title, and every writer with their IPI — not just that something is registered. Open the song's report to see the exact items, then check each one at the agency. If they're all correct and it's still flagged, open a ticket with the song title and the agency.",
  },
  {
    area: "AI Protection Hub",
    q: "A certificate won't download",
    a: "Open the registration in the AI Protection Hub and download the certificate from its row. A blocked download prompt or a pop-up blocker is the usual reason nothing appears — allow downloads for camethroughaudio.com and try again.",
  },
  {
    area: "Account & billing",
    q: "I can't sign in",
    a: "Use Forgot password on the login page and we'll email a fresh link. If it doesn't arrive, check your spam folder and that the address matches the one on the account. Still nothing? Open a ticket and choose Account & billing — we'll confirm the address on file.",
  },
  {
    area: "Account & billing",
    q: "I want to change the card on file",
    a: "Profile → Manage billing opens Stripe's own page, where the card is changed. Our team never types a card number and never asks you for one, in a ticket or by email.",
  },
  {
    area: "Account & billing",
    q: "How do refunds work?",
    a: "You can ask for a full refund within 30 days of your order. Open a ticket with Account & billing, or write to billing@camethroughaudio.com, and Billing takes it from there.",
  },
  {
    area: "Account & billing",
    q: "I was charged and I'm not sure what for",
    a: "Profile → Manage billing lists every charge and its invoice. If a line still doesn't look right, send us the date and amount on a ticket with Account & billing and we'll check it against your account.",
  },
  {
    area: "Something else",
    q: "What should I include in a ticket?",
    a: "The area and issue you picked in the form, what you clicked, what you expected and what happened instead, plus your browser and a screenshot if you can. That's usually the difference between an answer and a round trip.",
  },
];

/** Every answer for one area, in the order they are written above. */
export function supportFaqsFor(area: TicketArea): SupportFaq[] {
  return SUPPORT_FAQS.filter((f) => f.area === area);
}
