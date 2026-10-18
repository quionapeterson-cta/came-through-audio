/**
 * Live lookups for the Royalty Health Check, from open sources that allow apps to query them:
 * MusicBrainz (recordings, their compositions, ISWCs and writers) and Deezer (is the ISRC live on streaming).
 * These run on the server; `fetcher` is injectable so tests don't touch the network.
 */
export type StreamingHit = { title: string; artist: string; isrc?: string | undefined; link: string; cover?: string | undefined };
export type WorkHit = { recordingTitle: string; artist: string; workTitle?: string | undefined; iswcs: string[]; writers: string[]; link: string };
export type LookupResult = { streaming: StreamingHit | null; work: WorkHit | null };
export type LookupInput = { isrc?: string | undefined; title: string; artist: string };

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
const MB = "https://musicbrainz.org/ws/2";
// MusicBrainz asks every app to identify itself and allows about one request per second per IP.
const UA = "CameThroughAudio/1.0 ( https://camethroughaudio.com )";
const MB_GAP_MS = 1100;

let mbQueue: Promise<unknown> = Promise.resolve();
/** Requests to MusicBrainz go out one at a time, at least MB_GAP_MS apart, across every user on this server. */
function mbGet<T>(path: string, fetcher: Fetcher, gap = MB_GAP_MS): Promise<T | null> {
  const run = mbQueue.then(async () => {
    const url = `${MB}${path}${path.includes("?") ? "&" : "?"}fmt=json`, init = { headers: { "User-Agent": UA, Accept: "application/json" } };
    let res = await fetcher(url, init);
    await new Promise((r) => setTimeout(r, gap));
    // 503 means "slow down": wait once more and retry.
    if (res.status === 503) { await new Promise((r) => setTimeout(r, gap * 2)); res = await fetcher(url, init); }
    return res.ok ? ((await res.json()) as T) : null;
  });
  mbQueue = run.catch(() => undefined);
  return run.catch(() => null);
}

const norm = (v: string) => v.toLowerCase().replace(/\(.*?\)|\[.*?\]|\s-\s.*$|feat\..*$|ft\..*$/g, "").replace(/[^\p{L}\p{N}]+/gu, "");
const sameArtist = (a: string, b: string) => norm(a).includes(norm(b)) || norm(b).includes(norm(a));
export const cleanIsrc = (isrc?: string) => (isrc ?? "").replace(/[-\s]/g, "").toUpperCase();
const quote = (v: string) => `"${v.replace(/["\\]/g, "")}"`;

type MbRecording = { id: string; title: string; score?: number; "artist-credit"?: { name: string; joinphrase?: string }[] };
type MbRelation = { type: string; work?: { id: string; title: string; iswcs?: string[] }; artist?: { name: string } };
const credit = (r: MbRecording) => (r["artist-credit"] ?? []).map((c) => c.name + (c.joinphrase ?? "")).join("");

async function lookupWork(input: LookupInput, fetcher: Fetcher, gap?: number): Promise<WorkHit | null> {
  const isrc = cleanIsrc(input.isrc);
  let rec: MbRecording | undefined;
  if (isrc) rec = (await mbGet<{ recordings?: MbRecording[] }>(`/isrc/${isrc}?inc=artist-credits`, fetcher, gap))?.recordings?.[0];
  if (!rec && input.title.trim()) {
    const q = encodeURIComponent(`recording:${quote(input.title)} AND artist:${quote(input.artist)}`);
    rec = (await mbGet<{ recordings?: MbRecording[] }>(`/recording?query=${q}&limit=1`, fetcher, gap))?.recordings?.find((r) => (r.score ?? 0) >= 90);
  }
  if (!rec) return null;
  const rels = (await mbGet<{ relations?: MbRelation[] }>(`/recording/${rec.id}?inc=work-rels`, fetcher, gap))?.relations ?? [];
  const work = rels.find((r) => r.work)?.work;
  const writers = work ? ((await mbGet<{ relations?: MbRelation[] }>(`/work/${work.id}?inc=artist-rels`, fetcher, gap))?.relations ?? [])
    .filter((r) => ["writer", "composer", "lyricist"].includes(r.type) && r.artist).map((r) => r.artist!.name) : [];
  return {
    recordingTitle: rec.title, artist: credit(rec), workTitle: work?.title, iswcs: work?.iswcs ?? [],
    writers: [...new Set(writers)], link: `https://musicbrainz.org/recording/${rec.id}`,
  };
}

type DzTrack = { id?: number; title?: string; isrc?: string; link?: string; artist?: { name: string }; album?: { cover_medium?: string }; error?: unknown };
const toHit = (t: DzTrack): StreamingHit | null => t.id && t.title && t.artist ? { title: t.title, artist: t.artist.name, isrc: t.isrc, link: t.link ?? `https://www.deezer.com/track/${t.id}`, cover: t.album?.cover_medium } : null;

async function lookupStreaming(input: LookupInput, fetcher: Fetcher): Promise<StreamingHit | null> {
  const get = async (url: string) => { try { const r = await fetcher(url); return r.ok ? ((await r.json()) as DzTrack & { data?: DzTrack[] }) : null; } catch { return null; } };
  const isrc = cleanIsrc(input.isrc);
  if (isrc) { const hit = toHit((await get(`https://api.deezer.com/track/isrc:${isrc}`)) ?? {}); if (hit) return hit; }
  if (!input.title.trim()) return null;
  // A plain "artist title" search is the form Deezer answers; only accept a result whose title and artist match.
  const results = (await get(`https://api.deezer.com/search?q=${encodeURIComponent(`${input.artist} ${input.title}`)}&limit=5`))?.data ?? [];
  const first = results.find((t) => t.title && t.artist && norm(t.title) === norm(input.title) && sameArtist(t.artist.name, input.artist));
  // Search results may leave out the ISRC, so fetch the track itself to report which ISRC is live.
  return first?.id ? toHit((await get(`https://api.deezer.com/track/${first.id}`)) ?? first) : null;
}

export async function lookupSong(input: LookupInput, fetcher: Fetcher = fetch, mbGap?: number): Promise<LookupResult> {
  const [streaming, work] = await Promise.all([lookupStreaming(input, fetcher), lookupWork(input, fetcher, mbGap)]);
  return { streaming, work };
}

const normIswc = (v: string) => v.replace(/[^0-9T]/gi, "").toUpperCase();

export type Finding = { level: "ok" | "warn"; text: string; field?: "title" | "artist" | "isrc" | "iswc" | "writers" };

/** What the lookups say about the catalog entry, worded for the user. */
export function compareLookup(r: LookupResult, song: { title: string; artist: string; isrc?: string; iswc?: string; writers: string[] }): Finding[] {
  const out: Finding[] = [];
  if (r.streaming) {
    const s = r.streaming;
    out.push({ level: "ok", text: `Live on streaming as "${s.title}" by ${s.artist}.` });
    if (norm(s.title) !== norm(song.title)) out.push({ level: "warn", field: "title", text: `Streaming shows the title "${s.title}", but your catalog says "${song.title}". Titles must match exactly to be paid.` });
    if (!sameArtist(s.artist, song.artist)) out.push({ level: "warn", field: "artist", text: `Streaming credits "${s.artist}", but your catalog says "${song.artist}".` });
    if (s.isrc && !song.isrc) out.push({ level: "warn", field: "isrc", text: `Your song is live with ISRC ${s.isrc}. Add it to your catalog.` });
    else if (s.isrc && song.isrc && cleanIsrc(song.isrc) !== s.isrc) out.push({ level: "warn", field: "isrc", text: `The live release uses ISRC ${s.isrc}, not the ${song.isrc} in your catalog.` });
  }
  if (r.work) {
    const w = r.work;
    if (w.iswcs.length && !song.iswc) out.push({ level: "warn", field: "iswc", text: `MusicBrainz links this song to ISWC ${w.iswcs[0]}. Confirm it with your PRO, then add it to your catalog.` });
    else if (w.iswcs.length && song.iswc && !w.iswcs.map(normIswc).includes(normIswc(song.iswc))) out.push({ level: "warn", field: "iswc", text: `MusicBrainz lists ISWC ${w.iswcs.join(" / ")}, not the ${song.iswc} in your catalog.` });
    else if (w.iswcs.length) out.push({ level: "ok", text: `ISWC ${song.iswc} matches the public record.` });
    const ours = song.writers.map(norm);
    const missing = w.writers.filter((n) => !ours.includes(norm(n)));
    if (missing.length) out.push({ level: "warn", field: "writers", text: `MusicBrainz also credits ${missing.join(", ")} as writer${missing.length === 1 ? "" : "s"}. Check that every writer is on your split.` });
  }
  return out;
}
