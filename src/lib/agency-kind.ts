/**
 * What an agency registers (founder, 2026-11-14). A PRO and The MLC register the **composition**: a work title, an
 * ISWC and writers, with no recording artist and no ISRC. SoundExchange registers the **recording**: an ISRC, a recording
 * title, its version and the artist. Judging a BMI list by SoundExchange's rules flagged "No ISRC on the list" and
 * "Artist: Not on the list" on every BMI song, and told the member to check their distributor about a composition.
 */
export type AgencyKind = "composition" | "recording";

/** The societies that register recordings. Everything else — every PRO, the MLC and the rest of the world's societies — registers works. */
const RECORDING_AGENCIES = new Set(["soundexchange", "resound"]);

export const agencyKind = (society: string): AgencyKind => (RECORDING_AGENCIES.has(society) ? "recording" : "composition");
export const registersRecording = (society: string) => agencyKind(society) === "recording";

/** What the member copies to look the song up at that agency: a work is found by its title, a recording by its ISRC. */
export const searchesBy = (society: string): "isrc" | "work-title" | "writer" =>
  agencyKind(society) === "recording" ? "isrc" : society === "mlc" ? "writer" : "work-title";
