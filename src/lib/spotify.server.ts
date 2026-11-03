import {
  FastTrackError,
  type Discography,
  type PulledRelease,
  type PulledTrack,
  type StreamKind,
} from "./discography";

/**
 * Streaming Fast-Track, Spotify side: resolve a pasted Spotify artist, album or track link directly, using the Client
 * Credentials flow. The app calls Spotify as itself — the artist never logs in with Spotify — so the five-user
 * Development Mode limit does not apply here; the shared rate limit does.
 *
 * Credentials, server side only (Lovable → Cloud → Secrets today, Worker secrets after the December move):
 *   SPOTIFY_CLIENT_ID
 *   SPOTIFY_CLIENT_SECRET
 *
 * Spotify answers artists with albums but gives ISRCs only per track, so tracks are read in batches of 50 — the Web API
 * maximum — rather than one request each. Everything returned here matches the Deezer shape, so matching, the MLC check
 * and the UI need no branch of their own.
 */
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export const SPOTIFY_API = "https://api.spotify.com/v1";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
/** A client-credentials token lasts an hour; refresh a minute early so a request never races the expiry. */
const TOKEN_TTL_MS = 55 * 60 * 1000;

/** No credentials on this server: the caller should fall back to a Deezer name search instead of failing the page. */
export class SpotifyNotConfigured extends Error {}

export function spotifyConfigured(): boolean {
  return !!(process.env["SPOTIFY_CLIENT_ID"] && process.env["SPOTIFY_CLIENT_SECRET"]);
}

let cached: { token: string; at: number } | undefined;

/** Drops the cached token. Used by tests, and when a key is rotated. */
export function clearSpotifyToken() {
  cached = undefined;
}

/** The app's own access token, cached for its lifetime. Throws SpotifyNotConfigured when the keys are absent. */
export async function spotifyToken(fetcher: Fetcher = fetch): Promise<string> {
  const id = process.env["SPOTIFY_CLIENT_ID"];
  const secret = process.env["SPOTIFY_CLIENT_SECRET"];
  if (!id || !secret) throw new SpotifyNotConfigured("Spotify isn't configured on the server.");
  if (cached && Date.now() - cached.at < TOKEN_TTL_MS) return cached.token;

  const res = await fetcher(TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${btoa(`${id}:${secret}`)}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    console.error(`Spotify token request failed [${res.status}]`);
    throw new FastTrackError(
      res.status === 400 || res.status === 401
        ? "Spotify rejected the app's key. Check the client ID and client secret."
        : `Spotify wouldn't issue a token (${res.status}). Try again in a moment.`,
    );
  }
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: unknown;
  };
  const token = typeof body.access_token === "string" ? body.access_token : undefined;
  if (!token) throw new FastTrackError("Spotify's token response was unreadable.");
  cached = { token, at: Date.now() };
  return token;
}

type SpImage = { url?: string };
type SpArtist = {
  id?: string;
  name?: string;
  images?: SpImage[];
  followers?: { total?: number };
};
type SpTrackRef = {
  id?: string;
  name?: string;
  track_number?: number;
  disc_number?: number;
  artists?: SpArtist[];
};
type SpTrack = SpTrackRef & {
  duration_ms?: number;
  external_ids?: { isrc?: string };
  external_urls?: { spotify?: string };
};
type SpAlbum = {
  id?: string;
  name?: string;
  album_type?: string;
  release_date?: string;
  label?: string;
  total_tracks?: number;
  images?: SpImage[];
  external_ids?: { upc?: string };
  artists?: SpArtist[];
  tracks?: { items?: SpTrackRef[] };
};

type AlbumsPage = { items?: SpAlbum[]; next?: string; total?: number };

const newestFirst = (a: SpAlbum, b: SpAlbum) =>
  (b.release_date ?? "").localeCompare(a.release_date ?? "");

const nameOf = (artists: SpArtist[] | undefined, fallback: string) =>
  artists?.find((a) => a.name)?.name ?? fallback;

export type SpotifyOptions = {
  /** From spotifyToken(). Passed in so this module never reads secrets itself. */
  token: string;
  fetcher?: Fetcher | undefined;
  maxReleases?: number | undefined;
  maxTracks?: number | undefined;
  retries?: number | undefined;
  sleep?: ((ms: number) => Promise<void>) | undefined;
};

/**
 * A pasted Spotify link, read into the same Discography Deezer produces. Throws FastTrackError with wording that can
 * be shown to the artist as-is; 401 means the key is wrong, not that their catalog is missing.
 */
export async function spotifyDiscography(
  ref: { kind: StreamKind; id: string },
  options: SpotifyOptions,
): Promise<Discography> {
  const fetcher = options.fetcher ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const retries = options.retries ?? 2;
  const maxReleases = Math.max(1, options.maxReleases ?? 12);
  const maxTracks = Math.max(1, options.maxTracks ?? 250);

  const call = async <T>(url: string): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      let res: Response | undefined;
      try {
        res = await fetcher(url, { headers: { authorization: `Bearer ${options.token}` } });
      } catch {
        res = undefined;
      }
      if (!res) {
        if (attempt >= retries)
          throw new FastTrackError("Couldn't reach Spotify. Check your connection and try again.");
        await sleep(300 * 2 ** attempt);
        continue;
      }
      if (res.status === 429 || res.status >= 500) {
        if (attempt >= retries)
          throw new FastTrackError("Spotify is busy right now. Try again in a moment.");
        const after = Number(res.headers.get("retry-after"));
        await sleep(
          Number.isFinite(after) && after > 0 ? Math.min(after * 1000, 4000) : 400 * 2 ** attempt,
        );
        continue;
      }
      if (res.status === 401)
        throw new FastTrackError(
          "Spotify rejected the app's key. Check the client ID and client secret.",
        );
      if (res.status === 403 || res.status === 404)
        throw new FastTrackError("Spotify didn't recognise that link or artist.");
      if (!res.ok)
        throw new FastTrackError(`Spotify answered ${res.status}. Try again in a moment.`);
      try {
        return (await res.json()) as T;
      } catch {
        throw new FastTrackError("Spotify sent something we couldn't read. Try again.");
      }
    }
  };

  /** An artist's albums and singles, newest first. `total` is every release, not just the ones we read. */
  const albumsFor = async (artistId: string) => {
    const found: SpAlbum[] = [];
    let total: number | undefined;
    let url: string | undefined =
      `${SPOTIFY_API}/artists/${artistId}/albums?include_groups=album,single&limit=50&market=US`;
    for (let page = 0; url && page < 4 && found.length < maxReleases; page++) {
      const body: AlbumsPage = await call<AlbumsPage>(url);
      total = body.total ?? total;
      for (const album of body.items ?? [])
        if (album?.id && !found.some((a) => a.id === album.id)) found.push(album);
      url = body.next;
    }
    return { albums: found.sort(newestFirst).slice(0, maxReleases), total };
  };

  let artist: SpArtist;
  let albums: SpAlbum[];
  let total: number | undefined;
  let firstFull: SpAlbum | undefined;

  if (ref.kind === "artist") {
    artist = await call<SpArtist>(`${SPOTIFY_API}/artists/${ref.id}`);
    const found = await albumsFor(ref.id);
    albums = found.albums;
    total = found.total;
  } else if (ref.kind === "album") {
    const album = await call<SpAlbum>(`${SPOTIFY_API}/albums/${ref.id}?market=US`);
    firstFull = album;
    artist = album.artists?.[0] ?? {};
    albums = [album];
    total = 1;
  } else {
    const track = await call<SpTrack>(`${SPOTIFY_API}/tracks/${ref.id}?market=US`);
    const artistId = track.artists?.find((a) => a.id)?.id;
    if (!artistId) throw new FastTrackError("That Spotify track has no artist to read.");
    artist = await call<SpArtist>(`${SPOTIFY_API}/artists/${artistId}`);
    const found = await albumsFor(artistId);
    albums = found.albums;
    total = found.total;
  }

  if (!albums.length)
    throw new FastTrackError(
      `${artist.name ?? "That artist"} has no releases on Spotify yet. Once your distributor delivers them, they'll be here.`,
    );

  const releases: PulledRelease[] = [];
  let trackCount = 0;
  let withIsrc = 0;
  let truncated = false;

  for (const item of albums) {
    if (trackCount >= maxTracks) {
      truncated = true;
      break;
    }
    // An album link arrives already fetched, so it never costs a second request.
    const full: SpAlbum =
      firstFull && item.id && item.id === firstFull.id
        ? firstFull
        : await call<SpAlbum>(`${SPOTIFY_API}/albums/${item.id}?market=US`);

    // Album objects carry the first page of tracks; anything longer has to be paged.
    const refs: SpTrackRef[] = [...(full.tracks?.items ?? [])];
    for (
      let offset = refs.length;
      refs.length < (full.total_tracks ?? refs.length) && offset < 300;
      offset += 50
    ) {
      const page = await call<{ items?: SpTrackRef[] }>(
        `${SPOTIFY_API}/albums/${full.id}/tracks?limit=50&offset=${offset}&market=US`,
      );
      const items = page.items ?? [];
      if (!items.length) break;
      refs.push(...items);
    }

    const ids = refs.map((r) => r.id).filter((id): id is string => !!id);
    const details = new Map<string, SpTrack>();
    for (let i = 0; i < ids.length; i += 50) {
      const body = await call<{ tracks?: (SpTrack | null)[] }>(
        `${SPOTIFY_API}/tracks?ids=${ids.slice(i, i + 50).join(",")}&market=US`,
      );
      for (const t of body.tracks ?? []) if (t?.id) details.set(t.id, t);
    }

    const tracks: PulledTrack[] = [];
    for (const r of refs) {
      if (trackCount >= maxTracks) {
        truncated = true;
        break;
      }
      const detail = r.id ? details.get(r.id) : undefined;
      const isrc = detail?.external_ids?.isrc;
      if (isrc) withIsrc++;
      tracks.push({
        title: detail?.name ?? r.name ?? "Untitled",
        artist: nameOf(detail?.artists ?? r.artists, artist.name ?? "Unknown artist"),
        ...(isrc ? { isrc } : {}),
        ...(detail?.duration_ms ? { duration: Math.round(detail.duration_ms / 1000) } : {}),
        ...(r.track_number ? { position: r.track_number } : {}),
        ...(r.disc_number ? { disc: r.disc_number } : {}),
        ...(detail?.external_urls?.spotify ? { link: detail.external_urls.spotify } : {}),
      });
      trackCount++;
    }

    releases.push({
      id: full.id ?? item.id ?? "",
      title: full.name ?? item.name ?? "Untitled release",
      ...(full.external_ids?.upc ? { upc: full.external_ids.upc } : {}),
      ...(full.label && full.label !== "N/A" ? { label: full.label } : {}),
      ...(full.release_date ? { releaseDate: full.release_date } : {}),
      ...(full.images?.[0]?.url ? { cover: full.images[0].url } : {}),
      ...(full.album_type ? { recordType: full.album_type } : {}),
      tracks,
    });
  }

  if (trackCount >= maxTracks) truncated = true;

  return {
    artist: {
      id: artist.id ?? ref.id,
      name: artist.name ?? "Unknown artist",
      ...(artist.id ? { link: `https://open.spotify.com/artist/${artist.id}` } : {}),
      ...(artist.images?.[0]?.url ? { picture: artist.images[0].url } : {}),
      ...(total ? { releaseCount: total } : {}),
    },
    releases,
    trackCount,
    withIsrc,
    truncated,
    source: "spotify",
    fetchedAt: new Date().toISOString(),
  };
}
