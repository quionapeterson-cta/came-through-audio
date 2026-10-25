/**
 * Live lookup for the Royalty Health Hub: Deezer, to see whether the ISRC is live on streaming and how it's credited.
 * MusicBrainz was removed from the checks and the score (most independent releases aren't listed there).
 * This runs on the server; `fetcher` is injectable so tests don't touch the network.
 */
export type StreamingHit = { title: string; artist: string; isrc?: string | undefined; link: string; cover?: string | undefined };
export type LookupResult = { streaming: StreamingHit | null };
export type LookupInput = { isrc?: string | undefined; title: string; artist: string };

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
const norm = (v: string) => v.toLowerCase().replace(/\(.*?\)|\[.*?\]|\s-\s.*$|feat\..*$|ft\..*$/g, "").replace(/[^\p{L}\p{N}]+/gu, "");
const sameArtist = (a: string, b: string) => norm(a).includes(norm(b)) || norm(b).includes(norm(a));
export const cleanIsrc = (isrc?: string) => (isrc ?? "").replace(/[-\s]/g, "").toUpperCase();
type DzTrack = { id?: number; title?: string; isrc?: string; link?: string; artist?: { name: string }; album?: { cover_medium?: string }; error?: unknown };
const toHit = (t: DzTrack): StreamingHit | null => t.id && t.title && t.artist ? { title: t.title, artist: t.artist.name, isrc: t.isrc, link: t.link ?? `https://www.deezer.com/track/${t.id}`, cover: t.album?.cover_medium } : null;

async function lookupStreaming(input: LookupInput, fetcher: Fetcher): Promise<StreamingHit | null> {
  const get = async (url: string) => { try { const r = await fetcher(url); return r.ok ? ((await r.json()) as DzTrack & { data?: DzTrack[] }) : null; } catch { return null; } };
  const isrc = cleanIsrc(input.isrc);
  if (isrc) { const hit = toHit((await get(`https://api.deezer.com/track/isrc:${isrc}`)) ?? {}); if (hit) return hit; }
  if (!input.title.trim()) return null;
  // "artist title" first; Deezer doesn't recognize every artist name, so then the title alone.
  // Either way, only accept a result whose title and artist both match.
  const match = (t: DzTrack) => !!t.title && !!t.artist && norm(t.title) === norm(input.title) && sameArtist(t.artist.name, input.artist);
  let first: DzTrack | undefined;
  for (const q of [`${input.artist} ${input.title}`, input.title]) {
    first = ((await get(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=25`))?.data ?? []).find(match);
    if (first) break;
  }
  // Search results may leave out the ISRC, so fetch the track itself to report which ISRC is live.
  return first?.id ? toHit((await get(`https://api.deezer.com/track/${first.id}`)) ?? first) : null;
}

export async function lookupSong(input: LookupInput, fetcher: Fetcher = fetch): Promise<LookupResult> {
  return { streaming: await lookupStreaming(input, fetcher) };
}

export type Finding = { level: "ok" | "warn"; text: string; field?: "title" | "artist" | "isrc" | "iswc" | "writers" };

/** What the lookups say about the catalog entry, worded for the user. */
export function compareLookup(r: LookupResult, song: { title: string; artist: string; isrc?: string }): Finding[] {
  const out: Finding[] = [];
  if (r.streaming) {
    const s = r.streaming;
    out.push({ level: "ok", text: `Live on streaming as "${s.title}" by ${s.artist}.` });
    if (norm(s.title) !== norm(song.title)) out.push({ level: "warn", field: "title", text: `Streaming shows the title "${s.title}", but your catalog says "${song.title}". Titles must match exactly to be paid.` });
    if (!sameArtist(s.artist, song.artist)) out.push({ level: "warn", field: "artist", text: `Streaming credits "${s.artist}", but your catalog says "${song.artist}".` });
    if (s.isrc && !song.isrc) out.push({ level: "warn", field: "isrc", text: `Your song is live with ISRC ${s.isrc}. Add it to your catalog.` });
    else if (s.isrc && song.isrc && cleanIsrc(song.isrc) !== s.isrc) out.push({ level: "warn", field: "isrc", text: `The live release uses ISRC ${s.isrc}, not the ${song.isrc} in your catalog.` });
  }
  return out;
}
