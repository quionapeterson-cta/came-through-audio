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
 * **Nothing at the agency is closed, and nothing is bolted on** (founder, 2026-11-13). A recording carries one ISRC, so
 * the new code is not added to the old entry: it is registered as its own registration, with the old one left exactly as
 * it is. Royalties filed under the retired code can surface years later — an unmatched statement, a late claim, a
 * foreign collection — and a closed entry hides them. "Retired" means retired from the member's catalog, masters and
 * deliveries, never retired at the agency.
 *
 * The steps name the area rather than a menu path: agencies move their screens, and an invented click is worse than an
 * honest address. Nothing here is promised on the agency's behalf, and no price or timeframe is stated.
 */
export type RetireStep = { title: string; body: string };

/** The three things that are true whichever route the member takes. */
export const RETIRE_STEPS: RetireStep[] = [
  {
    title: "1. Do it yourself, if you'd rather",
    body: "The agency account is yours, so there is nobody to ask: register the recording under its new ISRC as its own registration and leave the old one as it is — SoundExchange Direct on the recording, The MLC Portal on the work, your PRO on the work. The new entry takes the title, artist and release date.",
  },
  {
    title: "2. Or let CTA do it",
    body: "Expert Registration Assistance is our team registering with your PRO, The MLC and SoundExchange on your behalf. Choose it in the workspace, or open a Support ticket from the Help Center and say it's an ISRC change with both codes — the new code is registered on its own and the old registration is left alone either way.",
  },
  {
    title: "3. A new code means another registration",
    body: "You can't add a second ISRC to the same recording: a recording carries one code, so the new code goes in as its own registration, with the same title, writers and release details. Most changes need nothing attached — keep the distributor's confirmation of the new code (a release report or the ISRC sheet) to hand for the cases that do ask, like a disputed match, a new claim on an old code, or a foreign collection.",
  },
  {
    title: "4. Leave the old registration open",
    body: "Never remove or close the old registration: money filed under the retired code can still surface later — an unmatched statement, a late claim, a foreign collection — and a closed entry hides it. The agency keeps the old registration, your deliveries carry the new code, and this app recognises either.",
  },
];

/** What to tell the member about one retired code, in one line. */
export const retireAdvice = (retired: string, current: string) =>
  current.trim()
    ? `The agency only has the retired ISRC ${retired}. Register ${current.trim()} as its own registration and leave the old one open — in your own agency account, or through CTA's Expert Registration Assistance — so royalties filed under the old code are still found (steps in Identifiers → Retired ISRC).`
    : `The agency only has the retired ISRC ${retired}. Add this recording's current code first: it is registered as its own entry, with the old one left open.`;
