/**
 * Streaming Fast-Track, composition side (PLAN-royalty-health-hub-v2 §4): match a released recording to the musical
 * work behind it — writers as registered, publisher, IPI, ISWC.
 *
 * The only authority for that is The MLC's Public Search API, which needs Data Access Hub enrolment. Until it is
 * active, a work is **unverified**, never "unregistered": saying a work is missing when we simply could not ask would
 * accuse the artist of a problem they may not have. The same rule applies when a lookup fails — a timeout is not an
 * answer. Only a successful search that returns nothing produces the locked "Unregistered Musical Work" diagnosis.
 */
export type WorkWriter = { name: string; ipi?: string | undefined; pro?: string | undefined };
export type WorkPublisher = { name: string; ipi?: string | undefined };

export type WorkRecord = {
  workId?: string | undefined;
  iswc?: string | undefined;
  title?: string | undefined;
  writers: WorkWriter[];
  publishers: WorkPublisher[];
};

export type CompositionQuery = { isrc?: string | undefined; title: string; artist: string };

/** A source that can answer "is this recording's work on file?" */
export type WorkLookup = {
  name: string;
  /** False when the source has no credentials: every work then comes back unverified. */
  available: boolean;
  find: (query: CompositionQuery) => Promise<WorkRecord | null>;
};

export type CompositionStatus = "matched" | "unregistered" | "unverified";

export type CompositionMatch = {
  title: string;
  artist: string;
  isrc?: string | undefined;
  status: CompositionStatus;
  source: "mlc" | "none";
  /** Why it has this status, worded for the artist. */
  note: string;
  work?: WorkRecord | undefined;
};

/** The MLC's public work search: one click, no login, and the artist can confirm the work themselves. */
export const MLC_SEARCH_URL = "https://portal.themlc.com/search";

/** The locked wording for a released recording with no work on file (hub plan §4.4). */
export const UNREGISTERED_DIAGNOSIS =
  "Diagnosis: Unregistered Musical Work : Mechanical and Digital Performance Royalties Uncollected.";

const NOT_CONFIGURED =
  "Composition checks switch on once our MLC Public Search API access is active. Check this work at The MLC in one click.";

/** No composition source at all: everything is unverified, and nothing is claimed about the work. */
export const NO_LOOKUP: WorkLookup = {
  name: "none",
  available: false,
  find: async () => {
    throw new Error("No composition source is configured.");
  },
};

async function matchOne(query: CompositionQuery, lookup: WorkLookup): Promise<CompositionMatch> {
  const base = {
    title: query.title,
    artist: query.artist,
    ...(query.isrc ? { isrc: query.isrc } : {}),
  };
  if (!lookup.available)
    return { ...base, status: "unverified", source: "none", note: NOT_CONFIGURED };
  try {
    const work = await lookup.find(query);
    if (!work) {
      return {
        ...base,
        status: "unregistered",
        source: "mlc",
        note: `No work on file at ${lookup.name} for this recording.`,
      };
    }
    return {
      ...base,
      status: "matched",
      source: "mlc",
      note: `On file at ${lookup.name}${work.workId ? ` · work ${work.workId}` : ""}.`,
      work,
    };
  } catch {
    // A failed or unreadable answer is not evidence of anything, so it stays unverified.
    return {
      ...base,
      status: "unverified",
      source: "mlc",
      note: `${lookup.name} didn't answer just now, so this work is unverified — not missing. Try again later.`,
    };
  }
}

/** One status per released track. Runs a few at a time so a big catalog doesn't stall the page. */
export async function matchCompositions(
  queries: CompositionQuery[],
  lookup: WorkLookup = NO_LOOKUP,
  concurrency = 3,
): Promise<CompositionMatch[]> {
  const out: CompositionMatch[] = [];
  for (let i = 0; i < queries.length; i += concurrency) {
    out.push(
      ...(await Promise.all(queries.slice(i, i + concurrency).map((q) => matchOne(q, lookup)))),
    );
  }
  return out;
}

export const compositionCounts = (matches: CompositionMatch[]) => ({
  total: matches.length,
  matched: matches.filter((m) => m.status === "matched").length,
  unregistered: matches.filter((m) => m.status === "unregistered").length,
  unverified: matches.filter((m) => m.status === "unverified").length,
});
