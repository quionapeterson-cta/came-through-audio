/**
 * The staff view of retired ISRCs (founder, 2026-11-12): every song in any member's catalog that carries an old code, so
 * Registration and Royalty Accounts can work the agency update without the member sending it to us.
 *
 * The rule it exists to protect: the agency keeps **both** codes. An old code can still carry uncollected royalties
 * years later, so the new one is added to the recording and the old one is left open. Nothing here closes a code, and
 * the copy staff send says that out loud.
 */
export type CatalogRow = {
  id: string;
  user_id: string;
  track_title: string | null;
  artist_name: string | null;
  album_title: string | null;
  release_date?: string | null;
  isrc: string | null;
  details: unknown;
  updated_at?: string | null;
};

export type RetiredIsrcRow = {
  id: string;
  ownerId: string;
  title: string;
  artist: string;
  album: string;
  released: string;
  /** The code the song and its deliveries use now. */
  current: string;
  /** Every code the recording used to carry, in the order the member entered them. */
  retired: string[];
  updatedAt: string;
};

/** Codes are compared the way the agencies print them: stripped and upper-cased. */
export const isrcKey = (value: string) => value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * One catalog row as a queue entry, or null when the song carries no retired code. A row whose retired list is empty,
 * missing or full of blanks is not work, and neither is a "retired" code that is really the current one typed twice.
 */
export function retiredRow(row: CatalogRow): RetiredIsrcRow | null {
  const saved = (row.details ?? {}) as { retiredIscrs?: unknown };
  const list = Array.isArray(saved.retiredIscrs) ? saved.retiredIscrs : [];
  const current = clean(row.isrc);
  const seen = new Set<string>();
  const retired: string[] = [];
  for (const raw of list) {
    const code = clean(raw);
    const key = isrcKey(code);
    if (!key || key === isrcKey(current) || seen.has(key)) continue;
    seen.add(key);
    retired.push(code);
  }
  if (!retired.length) return null;
  return {
    id: row.id,
    ownerId: row.user_id,
    title: clean(row.track_title) || "Untitled",
    artist: clean(row.artist_name),
    album: clean(row.album_title),
    released: clean(row.release_date ?? ""),
    current,
    retired,
    updatedAt: clean(row.updated_at ?? ""),
  };
}

/**
 * What staff send the agency (or use themselves in the portal). SoundExchange and the ISRC standard give a recording
 * one code, so the new code can't be added to the old entry: the message asks for the recording under its new ISRC as
 * an entry of its own and leaves the old one open. It carries no price, deadline or promise on the agency's side.
 */
export function agencyRequestText(row: RetiredIsrcRow) {
  const codes = row.retired.map((code) => `- Retired ISRC: ${code}`).join("\n");
  return [
    `Recording: ${row.title}${row.artist ? ` — ${row.artist}` : ""}`,
    ...(row.album ? [`Release: ${row.album}`] : []),
    ...(row.released ? [`Release date: ${row.released}`] : []),
    `- Current ISRC: ${row.current || "(not entered yet)"}`,
    codes,
    "",
    `Please register the recording under ${row.current || "the current ISRC"} as an entry of its own, with the same title and release details, and leave ${row.retired.length > 1 ? "the retired ISRCs" : "the retired ISRC"} open, so royalties filed under the old ${row.retired.length > 1 ? "codes" : "code"} can still be found and paid.`,
  ].join("\n");
}
