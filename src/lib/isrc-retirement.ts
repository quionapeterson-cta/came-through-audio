/**
 * Retiring an ISRC (founder, 2026-11-12): a recording can change code — a re-release, a distributor move, a take-down
 * and re-upload — and the agencies keep reporting under the old one until somebody tells them. The old code is kept on
 * the song (`retiredIscrs`), never embedded or exported, so the app can recognise the agency's record as the same
 * recording and tell the member exactly what to say to get it changed.
 *
 * The steps name the area rather than a menu path: agencies move their screens, and an invented click is worse than an
 * honest address. Nothing here is promised on the agency's behalf.
 */
export type RetireStep = { title: string; body: string };

/** The same steps whoever the agency is: what to send, and what to expect back. */
export const RETIRE_STEPS: RetireStep[] = [
  {
    title: "1. Have the new code ready",
    body: "Your distributor or the release's new delivery gives the recording its ISRC. Put that code on the song in My Catalog, then add the old one under Retired ISRC so the two are linked here.",
  },
  {
    title: "2. Ask the agency to change it",
    body: "Write to the agency's catalogue or royalty team (SoundExchange Direct has a change request for a recording; The MLC and the PROs take it by email or a support ticket). Give them the recording title, the artist, the release date, the retired code and the code that replaces it.",
  },
  {
    title: "3. Send the proof",
    body: "Attach the distributor's confirmation of the new code (a release report or the ISRC sheet) so the change doesn't sit in a queue waiting for evidence.",
  },
  {
    title: "4. Tick it off when they confirm",
    body: "The old code stays on the song as retired even after the change: their statements can still arrive under it for a period, and this is what lets the next upload read as the same recording instead of a mismatch.",
  },
];

/** What to tell the member about one retired code, in one line. */
export const retireAdvice = (retired: string, current: string) =>
  current.trim()
    ? `The agency still has the retired ISRC ${retired}; ask them to move it to ${current.trim()} (steps in Identifiers → Retired ISRC).`
    : `The agency still has the retired ISRC ${retired}; add this recording's current code before asking them to change it.`;
