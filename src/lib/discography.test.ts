import { describe, expect, it } from "vitest";
import { FastTrackError, parseStreamingLink, pullDiscography } from "./discography";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const ARTIST = {
  id: 4338602,
  name: "Burna Boy",
  link: "https://www.deezer.com/artist/4338602",
  picture_medium: "pic.jpg",
  nb_album: 92,
};

type Call = { url: string };

/** A Deezer that answers like the real one for one artist with two releases. */
function makeFetcher(extra?: (url: string, calls: Call[]) => Response | undefined) {
  const calls: Call[] = [];
  const fetcher = async (url: string): Promise<Response> => {
    calls.push({ url });
    const custom = extra?.(url, calls);
    if (custom) return custom;
    if (url.includes("/artist/4338602/albums")) {
      return json({
        data: [
          { id: 2, title: "Older", release_date: "2019-01-01", record_type: "album" },
          { id: 1, title: "Newer", release_date: "2025-07-10", record_type: "album" },
        ],
      });
    }
    if (url.includes("/artist/4338602")) return json(ARTIST);
    if (url.includes("/album/1/tracks")) {
      return json({
        data: [
          {
            id: 10,
            title: "No Panic",
            isrc: "USAT22503785",
            duration: 159,
            track_position: 1,
            disk_number: 1,
            artist: { id: 4338602, name: "Burna Boy" },
          },
          { id: 11, title: "Interlude" },
        ],
      });
    }
    if (url.includes("/album/2/tracks"))
      return json({
        data: [{ id: 20, title: "Old Song", isrc: "USAT21900001", artist: { name: "Burna Boy" } }],
      });
    if (url.includes("/album/1"))
      return json({
        id: 1,
        title: "Newer",
        upc: "UPC-1",
        label: "Atlantic",
        release_date: "2025-07-10",
        record_type: "album",
        cover_big: "big.jpg",
      });
    if (url.includes("/album/2"))
      return json({
        id: 2,
        title: "Older",
        upc: "UPC-2",
        release_date: "2019-01-01",
        record_type: "album",
      });
    return json({ error: { message: "not found" } }, 404);
  };
  return { fetcher, calls };
}

/** Fresh caches per test, so no test can ride on another's cached artist. */
const options = () => ({
  sleep: async () => {},
  minIntervalMs: 0,
  cache: new Map(),
  artistCache: new Map(),
});

describe("parseStreamingLink", () => {
  it("reads Deezer artist, album and track links", () => {
    expect(parseStreamingLink("https://www.deezer.com/artist/4338602")).toMatchObject({
      platform: "deezer",
      kind: "artist",
      id: "4338602",
    });
    expect(parseStreamingLink("deezer.com/album/784874611")).toMatchObject({
      platform: "deezer",
      kind: "album",
      id: "784874611",
    });
    expect(parseStreamingLink("https://www.deezer.com/track/3450512331")).toMatchObject({
      platform: "deezer",
      kind: "track",
    });
  });

  it("recognises Spotify links, including with a locale in front", () => {
    expect(
      parseStreamingLink("https://open.spotify.com/artist/3O34oWjX5SvE83zDh2gwVK"),
    ).toMatchObject({ platform: "spotify", kind: "artist" });
    expect(
      parseStreamingLink("https://open.spotify.com/intl-de/album/1ATL5GLyefJaxhQzSPVrLX"),
    ).toMatchObject({ platform: "spotify", kind: "album" });
  });

  it("returns null for a plain name or nonsense", () => {
    expect(parseStreamingLink("Burna Boy")).toBeNull();
    expect(parseStreamingLink("")).toBeNull();
    expect(parseStreamingLink("not a url at all")).toBeNull();
  });
});

describe("pullDiscography", () => {
  it("pulls releases with ISRC, UPC, artwork and newest first", async () => {
    const { fetcher } = makeFetcher();
    const d = await pullDiscography(
      { link: "https://www.deezer.com/artist/4338602" },
      { ...options(), fetcher },
    );

    expect(d.artist).toMatchObject({ id: 4338602, name: "Burna Boy" });
    expect(d.releases.map((r) => r.title)).toEqual(["Newer", "Older"]);
    expect(d.releases[0]!.upc).toBe("UPC-1");
    expect(d.releases[0]!.label).toBe("Atlantic");
    expect(d.releases[0]!.cover).toBe("big.jpg");
    expect(d.releases[0]!.tracks[0]!.isrc).toBe("USAT22503785");
    expect(d.trackCount).toBe(3);
    expect(d.withIsrc).toBe(2);
    expect(d.truncated).toBe(false);
  });

  it("finds the artist by name and prefers an exact name match", async () => {
    const { fetcher } = makeFetcher((url) => {
      if (url.includes("/search/artist")) {
        return json({
          data: [{ id: 9, name: "Burna Boy Tribute Band", nb_album: 500 }, ARTIST],
        });
      }
      return undefined;
    });
    const d = await pullDiscography({ name: "Burna Boy" }, { ...options(), fetcher });
    expect(d.artist.id).toBe(4338602);
  });

  it("caches a finished pull instead of reading Deezer again", async () => {
    const { fetcher, calls } = makeFetcher();
    const cache = new Map();
    const opts = { ...options(), fetcher, cache };
    await pullDiscography({ link: "https://www.deezer.com/artist/4338602" }, opts);
    const afterFirst = calls.length;
    await pullDiscography({ link: "https://www.deezer.com/artist/4338602" }, opts);
    expect(calls.length).toBe(afterFirst);
  });

  it("waits out a busy response and retries", async () => {
    let artistHits = 0;
    const { fetcher } = makeFetcher((url) => {
      if (url.endsWith("/artist/4338602")) {
        artistHits++;
        if (artistHits === 1)
          return new Response(null, { status: 429, headers: { "retry-after": "0" } });
      }
      return undefined;
    });
    const d = await pullDiscography(
      { link: "https://www.deezer.com/artist/4338602" },
      { ...options(), fetcher },
    );
    expect(artistHits).toBe(2);
    expect(d.trackCount).toBe(3);
  });

  it("refuses a Spotify link with no name rather than guessing the artist", async () => {
    const { fetcher, calls } = makeFetcher();
    await expect(
      pullDiscography(
        { link: "https://open.spotify.com/artist/3O34oWjX5SvE83zDh2gwVK" },
        { ...options(), fetcher },
      ),
    ).rejects.toBeInstanceOf(FastTrackError);
    await expect(
      pullDiscography(
        { link: "https://open.spotify.com/artist/3O34oWjX5SvE83zDh2gwVK" },
        { ...options(), fetcher },
      ),
    ).rejects.toThrow(/artist name/i);
    expect(calls.length).toBe(0);
  });

  it("stops at the track cap and says so", async () => {
    const { fetcher } = makeFetcher();
    const d = await pullDiscography(
      { link: "https://www.deezer.com/artist/4338602" },
      { ...options(), fetcher, maxTracks: 1 },
    );
    expect(d.releases).toHaveLength(1);
    expect(d.trackCount).toBe(1);
    expect(d.truncated).toBe(true);
  });
});
