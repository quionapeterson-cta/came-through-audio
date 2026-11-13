import { agencyKind } from "@/lib/agency-kind";

/**
 * How each agency's own repertoire search actually finds a song (founder, 2026-11-15).
 *
 * This is not a preference: a PRO registers a **composition**, and its public search matches the writer's name, while
 * SoundExchange registers a **recording** and matches its ISRC. The panel used to offer two checks for a BMI work — one
 * by title and one by ISWC — and neither is what the founder uses: searching BMI for "Qui-Ona Peterson" finds nothing,
 * while "Qui-Ona LaShay Peterson" (the full registered name) opens her works. So every composition card offers one check,
 * by the writer's name, and every recording card offers the ISRC search.
 *
 * The label and the method live here together, so a button can never copy a title and claim to search by a writer.
 */
export type LookupKind = "writer" | "isrc";

/** The societies whose search is a code search. Every other agency (a PRO, The MLC) matches the writer's name. */
const ISRC_LOOKUPS = new Set(["soundexchange", "resound"]);

export const lookupFor = (society: string): LookupKind =>
  ISRC_LOOKUPS.has(society) || agencyKind(society) === "recording" ? "isrc" : "writer";

/** The one check button for an agency: the method it searches by, and the words on the button. */
export const checkLabel = (society: string, name: string) =>
  lookupFor(society) === "isrc" ? "Copy ISRC & Check Repertoire ↗" : `Copy Writer Name & Check ${name} ↗`;

/** What the member copies with that button. */
export const checkWhat = (society: string) => (lookupFor(society) === "isrc" ? "ISRC" : "writer name");

/**
 * Said once, under a writer-based treatment (founder, 2026-11-15): names have to match the registration exactly, which is
 * the one thing members get wrong. The founder's own case: "Qui-Ona Peterson" found nothing at BMI, "Qui-Ona LaShay
 * Peterson" found the works.
 */
export const WRITER_NAME_HINT =
  "Repertoire search matches the writer's name exactly as it was registered — a missing middle name or a different spelling finds nothing. Use the full registered name in My Catalog and search it there.";

/** True for the agencies where that hint belongs. */
export const writerLookup = (society: string) => lookupFor(society) === "writer";
