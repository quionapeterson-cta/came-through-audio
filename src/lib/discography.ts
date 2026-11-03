/**
 * Streaming Fast-Track, recording side (PLAN-royalty-health-hub-v2 §4): pull an artist's released tracks straight from
 * Deezer, which needs no account, no key and no approval. Gives titles, artists, ISRCs, UPCs, release dates and artwork.
 *
 * Deezer allows a limited number of requests per window, so every call goes through one shared gate, retries a busy
 * response with backoff, and the finished discography is cached per artist for a few hours. The cache is per server
 * instance (best effort), which is all it needs to be: a miss just costs a few requests.
 *
 * The composition half lives in ./composition.ts. Nothing here can say whether a work is registered — that is The MLC's
 * job, and it stays unverified until that access exists.
 */
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export const DEEZER_API = "https://api.deezer.com";

/** A message that is safe to show the user as-is. */
export class FastTrackError extends Error {}

const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]|\s-\s.*$|feat\..*$|ft\..*$/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");

export type StreamingPlatform = "deezer" | "spotify" | "apple" | "youtube" | "other";
export type StreamKind = "artist" | "album" | "track";
export type StreamRef = { platform: StreamingPlatform; kind: StreamKind; id?: string | undefined };

const HOSTS: [RegExp, StreamingPlatform][] = [
  [/(?:^|\.)deezer\.com$/i, "deezer"],
  [/(?:^|\.)spotify\.com$/i, "spotify"],
  [/(?:^|\.)music\.apple\.com$/i, "apple"],
  [/(?:^|\.)(?:youtube\.com|youtu\.be)$/i, "youtube"],
];
const KINDS: StreamKind[] = ["artist", "album", "track"];

/**
 * What kind of link was pasted. Only Deezer links can be opened directly: Spotify's app links need a Spotify developer
 * key to resolve, and its oEmbed endpoint answers for tracks but not artists, so a Spotify link always needs the
 * artist's name typed in beside it. Guessing which artist a link points at would be worse than asking.
 */
export function parseStreamingLink(raw: string): StreamRef | null {
  const text = raw.trim();
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const platform = HOSTS.find(([re]) => re.test(host))?.[1];
  if (!platform) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  // Spotify puts a locale in front ("/intl-de/artist/…"); Apple puts a country ("/us/album/name/123").
  const at = segments.findIndex((s) => (KINDS as string[]).includes(s));
  if (at < 0) return { platform, kind: "artist" };
  const next = segments[at + 1];
  const id = next && /^[A-Za-z0-9]+$/.test(next) ? next : undefined;
  return { platform, kind: KINDS.find((k) => k === segments[at])!, id };
}

export type PulledTrack = {
  title: string;
  artist: string;
  isrc?: string | undefined;
  duration?: number | undefined;
  position?: number | undefined;
  disc?: number | undefined;
  link?: string | undefined;
  deezerId?: number | undefined;
};

export type PulledRelease = {
  id: number;
  title: string;
  upc?: string | undefined;
  label?: string | undefined;
  releaseDate?: string | undefined;
  cover?: string | undefined;
  recordType?: string | undefined;
  tracks: PulledTrack[];
};

export type Discography = {
  artist: {
    id: number;
    name: string;
    link?: string | undefined;
    picture?: string | undefined;
    releaseCount?: number | undefined;
  };
  releases: PulledRelease[];
  trackCount: number;
  /** How many of the tracks carry an ISRC — the identifier every later check matches on. */
  withIsrc: number;
  /** True when the artist has more releases than one pull reads. */
  truncated: boolean;
  source: "deezer";
  fetchedAt: string;
};

export type PullInput = { link?: string | undefined; name?: string | undefined };

type Sleep = (ms: number) => Promise<void>;
const defaultSleep: Sleep = (ms) => new Promise((r) => setTimeout(r, ms));
type Gate = () => Promise<void>;

type Limits = { retries: number; maxWaitMs: number; sleep: Sleep };

export type PullOptions = {
  fetcher?: Fetcher | undefined;
  /** Releases read per pull (newest first). */
  maxReleases?: number | undefined;
  maxTracks?: number | undefined;
  /** Minimum gap between requests, so one pull never trips Deezer's per-window limit. */
  minIntervalMs?: number | undefined;
  ttlMs?: number | undefined;
  cache?: Map<string, { at: number; value: Discography }> | undefined;
  /** Resolved artist ids, so a repeated pull costs no requests at all. */
  artistCache?: Map<string, { at: number; value: DzArtist }> | undefined;
  now?: (() => number) | undefined;
  sleep?: Sleep | undefined;
  retries?: number | undefined;
  maxWaitMs?: number | undefined;
};

const cache = new Map<string, { at: number; value: Discography }>();
const artists = new Map<string, { at: number; value: DzArtist }>();

/** One shared request gate for the whole instance: `intervalMs` between requests, whatever asks for one. */
function makeGate(intervalMs: number, now: () => number, sleep: Sleep): Gate {
  let next = 0;
  return async () => {
    const wait = next - now();
    next = Math.max(next, now()) + intervalMs;
    if (wait > 0) await sleep(wait);
  };
}

const retryAfter = (res: Response): number | undefined => {
  const raw = res.headers.get("retry-after");
  if (!raw) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
};

async function getJson<T>(url: string, fetcher: Fetcher, gate: Gate, limits: Limits): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    await gate();
    let res: Response | undefined;
    try {
      res = await fetcher(url);
    } catch {
      res = undefined;
    }
    if (!res) {
      if (attempt >= limits.retries)
        throw new FastTrackError("Couldn't reach Deezer. Check your connection and try again.");
      await limits.sleep(300 * 2 ** attempt);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= limits.retries)
        throw new FastTrackError("Deezer is busy right now. Try again in a moment.");
      await limits.sleep(Math.min(retryAfter(res) ?? 400 * 2 ** attempt, limits.maxWaitMs));
      continue;
    }
    if (!res.ok) throw new FastTrackError("Deezer didn't recognise that link or artist.");
    let body: T & { error?: unknown };
    try {
      body = (await res.json()) as T & { error?: unknown };
    } catch {
      throw new FastTrackError("Deezer sent something we couldn't read. Try again.");
    }
    if (body && typeof body === "object" && "error" in body && body.error)
      throw new FastTrackError("Deezer couldn't answer that request.");
    return body;
  }
}

export type DzArtist = {
  id?: number;
  name?: string;
  link?: string;
  picture_medium?: string;
  nb_album?: number;
};
type DzAlbum = {
  id?: number;
  title?: string;
  cover_medium?: string;
  cover_big?: string;
  release_date?: string;
  record_type?: string;
  upc?: string;
  label?: string;
  artist?: DzArtist;
  next?: string;
};
type DzTrack = {
  id?: number;
  title?: string;
  isrc?: string;
  duration?: number;
  track_position?: number;
  disk_number?: number;
  link?: string;
  artist?: DzArtist;
};

const opt = <K extends string, V>(key: K, value: V | undefined) =>
  (value === undefined ? {} : { [key]: value }) as Record<K, V>;

/** We read the artist's own registry entry when the link points at one of their releases. */
async function resolveArtist(
  input: PullInput,
  get: (url: string) => Promise<unknown>,
): Promise<DzArtist> {
  const ref = input.link ? parseStreamingLink(input.link) : null;
  if (ref?.platform === "deezer" && ref.id) {
    if (ref.kind === "artist") {
      const artist = (await get(`${DEEZER_API}/artist/${ref.id}`)) as DzArtist;
      if (artist?.id) return artist;
    }
    if (ref.kind === "album") {
      const album = (await get(`${DEEZER_API}/album/${ref.id}`)) as { artist?: DzArtist };
      if (album?.artist?.id) return album.artist;
    }
    if (ref.kind === "track") {
      const track = (await get(`${DEEZER_API}/track/${ref.id}`)) as { artist?: DzArtist };
      if (track?.artist?.id) return track.artist;
    }
  }

  const name = (input.name ?? "").trim();
  if (!name) {
    throw new FastTrackError(
      ref && ref.platform !== "deezer"
        ? "A Spotify link can't be opened without a Spotify developer key. Add your artist name and we'll find your releases on Deezer, which needs no key."
        : "Paste your Deezer artist link, or type your artist name.",
    );
  }
  const found = (await get(
    `${DEEZER_API}/search/artist?q=${encodeURIComponent(name)}&limit=10`,
  )) as { data?: DzArtist[] };
  const list = (found.data ?? []).filter((a): a is DzArtist & { id: number } => !!a?.id);
  if (!list.length)
    throw new FastTrackError(
      `No artist called "${name}" on Deezer. Check the spelling, or paste your Deezer artist link.`,
    );
  return (
    list.find((a) => norm(a.name ?? "") === norm(name)) ??
    [...list].sort((a, b) => (b.nb_album ?? 0) - (a.nb_album ?? 0))[0]!
  );
}

async function listReleases(
  artistId: number,
  max: number,
  get: (url: string) => Promise<unknown>,
): Promise<DzAlbum[]> {
  const seen = new Set<number>();
  const out: DzAlbum[] = [];
  let url: string | undefined = `${DEEZER_API}/artist/${artistId}/albums?limit=100`;
  for (let page = 0; url && page < 6 && out.length < max; page++) {
    const body = (await get(url)) as { data?: DzAlbum[]; next?: string };
    for (const album of body.data ?? []) {
      if (!album?.id || seen.has(album.id)) continue;
      seen.add(album.id);
      out.push(album);
    }
    url = body.next;
  }
  return out;
}

/** Keeps the fan-out polite: a few albums at a time rather than every album at once. */
async function inBatches<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

/**
 * Everything an artist has released, from Deezer alone.
 * Throws FastTrackError with a message that can be shown as-is.
 */
export async function pullDiscography(
  input: PullInput,
  options: PullOptions = {},
): Promise<Discography> {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const store = options.cache ?? cache;
  const ttl = options.ttlMs ?? 6 * 60 * 60 * 1000;
  const maxReleases = Math.max(1, options.maxReleases ?? 12);
  const maxTracks = Math.max(1, options.maxTracks ?? 250);
  const artistStore = options.artistCache ?? artists;
  const gate = makeGate(options.minIntervalMs ?? 120, now, sleep);
  const limits: Limits = {
    retries: options.retries ?? 2,
    maxWaitMs: options.maxWaitMs ?? 4000,
    sleep,
  };
  const get = <T>(url: string) => getJson<T>(url, fetcher, gate, limits);

  // Same artist again (or the same pasted name): reuse the resolved id instead of asking Deezer who it is.
  const artistKey = input.link?.trim()
    ? `link:${input.link.trim().toLowerCase()}`
    : `name:${norm(input.name ?? "")}`;
  const seen = artistStore.get(artistKey);
  const cachedArtist = seen && now() - seen.at < ttl ? seen.value : undefined;
  const artist = cachedArtist ?? (await resolveArtist(input, get));
  if (!cachedArtist) artistStore.set(artistKey, { at: now(), value: artist });
  if (!artist.id) throw new FastTrackError("That artist has no Deezer profile to read.");

  const key = `deezer:${artist.id}:${maxReleases}:${maxTracks}`;
  const hit = store.get(key);
  if (hit && now() - hit.at < ttl) return hit.value;

  const albums = await listReleases(artist.id, maxReleases, get);
  if (!albums.length) {
    throw new FastTrackError(
      `${artist.name ?? "That artist"} has no releases on Deezer yet. Once your distributor delivers them, they'll be here.`,
    );
  }

  const releases = await inBatches(albums, 3, async (album): Promise<PulledRelease> => {
    const [detail, tracks] = await Promise.all([
      get<DzAlbum>(`${DEEZER_API}/album/${album.id}`),
      get<{ data?: DzTrack[] }>(`${DEEZER_API}/album/${album.id}/tracks?limit=100`),
    ]);
    return {
      id: album.id!,
      title: detail.title ?? album.title ?? "Untitled",
      ...opt("upc", detail.upc),
      ...opt("label", detail.label),
      ...opt("releaseDate", detail.release_date ?? album.release_date),
      ...opt(
        "cover",
        detail.cover_big ?? album.cover_big ?? detail.cover_medium ?? album.cover_medium,
      ),
      ...opt("recordType", detail.record_type ?? album.record_type),
      tracks: (tracks.data ?? [])
        .filter((t) => !!t.title)
        .map((t) => ({
          title: t.title!,
          artist: t.artist?.name ?? artist.name ?? "",
          ...opt("isrc", t.isrc),
          ...opt("duration", t.duration),
          ...opt("position", t.track_position),
          ...opt("disc", t.disk_number),
          ...opt("link", t.link),
          ...opt("deezerId", t.id),
        })),
    };
  });

  releases.sort(
    (a, b) =>
      (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "") || a.title.localeCompare(b.title),
  );

  let taken = 0;
  let truncated = false;
  const kept: PulledRelease[] = [];
  for (const release of releases) {
    if (taken >= maxTracks) {
      truncated = true;
      break;
    }
    const room = maxTracks - taken;
    if (release.tracks.length > room) truncated = true;
    const tracks = release.tracks.slice(0, room);
    taken += tracks.length;
    kept.push({ ...release, tracks });
  }

  const value: Discography = {
    artist: {
      id: artist.id,
      name: artist.name ?? "Unknown artist",
      ...opt("link", artist.link),
      ...opt("picture", artist.picture_medium),
      ...opt("releaseCount", artist.nb_album),
    },
    releases: kept,
    trackCount: taken,
    withIsrc: kept.reduce((n, r) => n + r.tracks.filter((t) => t.isrc).length, 0),
    truncated,
    source: "deezer",
    fetchedAt: new Date(now()).toISOString(),
  };
  store.set(key, { at: now(), value });
  return value;
}

/** Clears the instance cache. Only used by tests. */
export const clearDiscographyCache = () => cache.clear();
