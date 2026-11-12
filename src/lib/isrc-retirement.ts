/**
 * Retiring an ISRC (founder, 2026-11-12): a recording can change code — a re-release, a distributor move, a take-down
 * and re-upload — and the agencies keep reporting under the old one until somebody tells them.
 *
 * Two rules shape everything here.
 *
 * **The member doesn't ask an agency to do it.** They either do it in their own agency account, which they already hold,
 * or Came Through Audio does it for them through Expert Registration Assistance. So the copy offers those two routes and
 * nothing that sounds like begging a support queue for permission.
 *
 * **The agency keeps both codes.** The old one is never removed or closed, because royalties filed under it can surface
 * years later — an unmatched statement, a late claim, a foreign collection — and a closed code hides them. "Retired"
 * means retired from the member's catalog, masters and deliveries, never retired at the agency.
 *
 * The steps name the area rather than a menu path: agencies move their screens, and an invented click is worse than an
 * honest address. Nothing here is promised on the agency's behalf, and no price or timeframe is stated.
 */
export type RetireStep = { title: string; body: string };

/** The three things that are true whichever route the member takes. */
export const RETIRE_STEPS: RetireStep[] = [
  {
    title: "1. Do it yourself, if you'd rather",
    body: "The agency account is yours, so there is nobody to ask: add the recording with the new ISRC and leave the old one on file — SoundExchange Direct on the recording, The MLC Portal on the work, your PRO on the work. Both codes go in, with the title, artist and release date.",
  },
  {
    title: "2. Or let CTA do it",
    body: "Expert Registration Assistance is our team registering with your PRO, The MLC and SoundExchange on your behalf. Choose it in the workspace, or open a Support ticket from the Help Center and say it's an ISRC change with both codes — the old one stays on the recording either way.",
  },
  {
    title: "3. Proof only when an agency asks",
    body: "Most changes need nothing attached: you're adding a code to a recording that's already yours, in an account you hold. Keep the distributor's confirmation of the new code (a release report or the ISRC sheet) to hand for the cases that do want it — a disputed match, a new claim on an old code, or a foreign collection.",
  },
  {
    title: "4. Leave the old code open",
    body: "Never remove or close the retired code: money filed under it can still be found and paid later, and a closed code hides it. Both codes on one recording is the state you want — the agency lists the old one, your deliveries carry the new one, and this app recognises either.",
  },
];

/** What to tell the member about one retired code, in one line. */
export const retireAdvice = (retired: string, current: string) =>
  current.trim()
    ? `The agency only has the retired ISRC ${retired}. Get ${current.trim()} added to the same recording and leave the old code open — in your own agency account, or through CTA's Expert Registration Assistance — so royalties filed under it are still found (steps in Identifiers → Retired ISRC).`
    : `The agency only has the retired ISRC ${retired}. Add this recording's current code before getting it added alongside the old one.`;
