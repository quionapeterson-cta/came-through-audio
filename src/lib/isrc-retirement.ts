/**
 * Retiring an ISRC (founder, 2026-11-12): a recording can change code — a re-release, a distributor move, a take-down
 * and re-upload — and the agencies keep reporting under the old one until somebody tells them.
 *
 * The founder's rule, and the whole shape of this: **the agency keeps both codes.** The old one is never removed or
 * closed, because royalties filed under it can surface years later — an unmatched statement, a late claim, a foreign
 * collection — and a closed code hides them. So "retired" here means retired from your catalog, your masters and your
 * deliveries, never retired at the agency: they are asked to add the new code alongside the old one, on the same
 * recording.
 *
 * The steps name the area rather than a menu path: agencies move their screens, and an invented click is worse than an
 * honest address. Nothing here is promised on the agency's behalf.
 */
export type RetireStep = { title: string; body: string };

/** The same steps whoever the agency is: what to send, and what to leave alone. */
export const RETIRE_STEPS: RetireStep[] = [
  {
    title: "1. Have the new code ready",
    body: "Your distributor or the release's new delivery gives the recording its ISRC. Put that code on the song in My Catalog, then add the old one under Retired ISRC so the two are linked here.",
  },
  {
    title: "2. Ask them to add it, not to swap it",
    body: "Write to the agency's catalogue or royalty team (SoundExchange Direct takes a change request on a recording; The MLC and the PROs take it by email or a support ticket). Give them the recording title, the artist, the release date and both codes, and ask for the new ISRC to be added to the same recording while the old one stays on it.",
  },
  {
    title: "3. Send the proof",
    body: "Attach the distributor's confirmation of the new code (a release report or the ISRC sheet) so the change doesn't sit in a queue waiting for evidence.",
  },
  {
    title: "4. Leave the old code open",
    body: "Never ask them to remove or close the retired code: money filed under it can still be found and paid later, and a closed code hides it. Both codes sitting on one recording is the state you want — the agency lists the old one, your deliveries carry the new one, and this app recognises either.",
  },
];

/** What to tell the member about one retired code, in one line. */
export const retireAdvice = (retired: string, current: string) =>
  current.trim()
    ? `The agency only has the retired ISRC ${retired}. Ask them to add ${current.trim()} to the same recording and keep the old code open, so royalties filed under it are still found (steps in Identifiers → Retired ISRC).`
    : `The agency only has the retired ISRC ${retired}. Add this recording's current code before asking them to add it alongside the old one.`;
