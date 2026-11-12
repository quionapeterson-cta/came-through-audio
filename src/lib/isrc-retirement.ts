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
 * **Nothing at the agency is closed, and nothing is bolted on** (founder, 2026-11-13, checked against the agencies'
 * own guidance). SoundExchange says a single ISRC is used for one recording and each distinct recording has only one
 * ISRC; IFPI's standard says a recording that has a code is never assigned another one, and a code is never edited or
 * reused. The MLC registers the song and lists recordings (ISRCs) under it, one ISRC per recording. A PRO registers the
 * musical work, not the recording, so the ISRC there is an optional detail of the recording, not an identity. So the new
 * code arrives as a recording of its own and the old entry is left exactly as it is: royalties filed under the retired
 * code can surface years later — an unmatched statement, a late claim, a foreign collection — and a closed entry hides
 * them. "Retired" means retired from the member's catalog, masters and deliveries, never retired at the agency.
 *
 * The steps name the area rather than a menu path: agencies move their screens, and an invented click is worse than an
 * honest address. Nothing here is promised on the agency's behalf, and no price or timeframe is stated.
 */
export type RetireStep = { title: string; body: string };

/** The three things that are true whichever route the member takes. */
export const RETIRE_STEPS: RetireStep[] = [
  {
    title: "1. Do it yourself, if you'd rather",
    body: "The agency account is yours, so there is nobody to ask — and it is a different job at each one. SoundExchange Direct takes the recording under its new ISRC, as a recording in its own right. At The MLC the song registration stays exactly as it is and the new ISRC goes in as one of its recordings; a recording already matched to the song is removed by The MLC's support team, not by you. Your PRO registers the work, not the recording, so the ISRC is an optional recording detail there — update it if you want it on the work, and there is no second work registration.",
  },
  {
    title: "2. Or let CTA do it",
    body: "Expert Registration Assistance is our team registering with your PRO, The MLC and SoundExchange on your behalf. Choose it in the workspace, or open a Support ticket from the Help Center and say it's an ISRC change with both codes — the new code is handled as the recording's own entry and the old one is left alone either way.",
  },
  {
    title: "3. One recording, one code",
    body: "SoundExchange puts it plainly: a single ISRC is used for one recording, and each distinct recording has only one. The ISRC standard adds that a code is never edited or reused, even when the recording changes hands. You can't add a second ISRC to the existing recording, so the new code comes in as a recording of its own, carrying the same title, artists and release details. Most changes need nothing attached — keep the distributor's confirmation of the new code (a release report or the ISRC sheet) to hand for the cases that do ask, like a disputed match, a new claim on an old code, or a foreign collection.",
  },
  {
    title: "4. Leave the old entry open",
    body: "Never remove or close the old one: money filed under the retired code can still surface later — an unmatched statement, a late claim, a foreign collection — and a closed entry hides it. The agency keeps the old recording or work as it is, your deliveries carry the new code, and this app recognises either.",
  },
];

/** What to tell the member about one retired code, in one line. */
export const retireAdvice = (retired: string, current: string) =>
  current.trim()
    ? `The agency only has the retired ISRC ${retired}. Add the recording under its current ISRC ${current.trim()} as an entry of its own and leave the old one open — in your own agency account, or through CTA's Expert Registration Assistance — so royalties filed under the old code are still found (steps in Identifiers → Retired ISRC).`
    : `The agency only has the retired ISRC ${retired}. Add this recording's current code first: it comes in as its own entry, with the old one left open.`;
