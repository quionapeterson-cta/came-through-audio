import { beforeEach, describe, expect, it } from "vitest";
import { FastTrackError } from "./discography";
import {
  SpotifyNotConfigured,
  clearSpotifyToken,
  spotifyArtistName,
  spotifyConfigured,
  spotifyDiscography,
  spotifyToken,
} from "./spotify.server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const ARTIST = { id: "A1", name: "Burna Boy", images: [{ url: "artist.jpg" }] };

/** A Spotify that answers like the real one for one artist with two releases. */
function makeFetcher(extra?: (url: string) => Response | undefined) {
  const calls: string[] = [];
  const fetcher = async (url: string): Promise<Response> => {
    calls.push(url);
    const custom = extra?.(url);
    if (custom) return custom;
    if (url.includes("/artists/A1/albums"))
      return json({
        total: 2,
        items: [
          { id: "AL2", name: "Older", release_date: "2019-01-01", album_type: "album" },
          { id: "AL1", name: "Newer", release_date: "2025-07-10", album_type: "album" },
        ],
      });
    if (url.includes("/artists/A1")) return json(ARTIST);
    if (url.includes("/albums/AL1"))
      return json({
        id: "AL1",
        name: "Newer",
        release_date: "2025-07-10",
        album_type: "album",
        label: "Atlantic",
        total_tracks: 2,
        images: [{ url: "cover.jpg" }],
        external_ids: { upc: "UPC-1" },
        artists: [ARTIST],
        tracks: {
          items: [
            { id: "T1", name: "No Panic", track_number: 1, disc_number: 1 },
            { id: "T2", name: "Interlude", track_number: 2, disc_number: 1 },
          ],
        },
      });
    if (url.includes("/albums/AL2"))
      return json({
        id: "AL2",
        name: "Older",
        release_date: "2019-01-01",
        album_type: "album",
        total_tracks: 1,
        artists: [ARTIST],
        tracks: { items: [{ id: "T3", name: "Old Song", track_number: 1 }] },
      });
    if (url.includes("/tracks?ids="))
      return json({
        tracks: [
          {
            id: "T1",
            name: "No Panic",
            duration_ms: 159000,
            external_ids: { isrc: "USAT22503785" },
            external_urls: { spotify: "https://open.spotify.com/track/T1" },
          },
          { id: "T2", name: "Interlude", duration_ms: 60000 },
          { id: "T3", name: "Old Song", external_ids: { isrc: "USAT21900001" } },
        ],
      });
    const one = url.match(/\/tracks\/(T\d)\?/)?.[1];
    if (one) return json({ id: one, name: `Track ${one}`, external_ids: { isrc: `ISRC-${one}` } });
    return json({ error: { status: 404 } }, 404);
  };
  return { fetcher, calls };
}

describe("spotifyDiscography", () => {
  it("builds the same shape as Deezer: newest first, ISRCs, UPC, label, artwork", async () => {
    const { fetcher } = makeFetcher();
    const d = await spotifyDiscography({ kind: "artist", id: "A1" }, { token: "t", fetcher });

    expect(d.source).toBe("spotify");
    expect(d.artist).toMatchObject({
      id: "A1",
      name: "Burna Boy",
      picture: "artist.jpg",
      releaseCount: 2,
    });
    expect(d.releases.map((r) => r.title)).toEqual(["Newer", "Older"]);
    expect(d.releases[0]).toMatchObject({
      upc: "UPC-1",
      label: "Atlantic",
      cover: "cover.jpg",
      recordType: "album",
    });
    expect(d.releases[0]!.tracks[0]).toMatchObject({
      title: "No Panic",
      isrc: "USAT22503785",
      duration: 159,
      position: 1,
    });
    expect(d.trackCount).toBe(3);
    expect(d.withIsrc).toBe(2);
    expect(d.truncated).toBe(false);
  });

  it("reads one album from an album link, without listing the artist's other releases", async () => {
    const { fetcher, calls } = makeFetcher();
    const d = await spotifyDiscography({ kind: "album", id: "AL1" }, { token: "t", fetcher });
    expect(d.releases).toHaveLength(1);
    expect(d.releases[0]!.title).toBe("Newer");
    expect(calls.some((u) => u.includes("/artists/A1/albums"))).toBe(false);
  });

  it("stops at the track cap and says so", async () => {
    const { fetcher } = makeFetcher();
    const d = await spotifyDiscography(
      { kind: "artist", id: "A1" },
      { token: "t", fetcher, maxTracks: 1 },
    );
    expect(d.trackCount).toBe(1);
    expect(d.truncated).toBe(true);
  });

  it("reads tracks one at a time when Spotify refuses the batch, as it does for Development Mode apps", async () => {
    for (const status of [400, 403]) {
      const { fetcher, calls } = makeFetcher((url) =>
        url.includes("/tracks?ids=") ? json({ error: { status } }, status) : undefined,
      );
      const d = await spotifyDiscography({ kind: "artist", id: "A1" }, { token: "t", fetcher });
      expect(d.trackCount).toBe(3);
      expect(d.withIsrc).toBe(3);
      expect(d.releases[0]!.tracks[0]).toMatchObject({ title: "Track T1", isrc: "ISRC-T1" });
      // Refused once, then never asked again for the second album.
      expect(calls.filter((u) => u.includes("/tracks?ids="))).toHaveLength(1);
    }
  });

  it("reads tracks one at a time when the batch endpoint is busy, not just when it is refused", async () => {
    const { fetcher } = makeFetcher((url) =>
      url.includes("/tracks?ids=") ? json({ error: { status: 429 } }, 429) : undefined,
    );
    const d = await spotifyDiscography(
      { kind: "artist", id: "A1" },
      { token: "t", fetcher, retries: 0 },
    );
    expect(d.trackCount).toBe(3);
    expect(d.withIsrc).toBe(3);
  });

  it("still stops on a rejected key when it is the batch that is rejected", async () => {
    const { fetcher } = makeFetcher((url) =>
      url.includes("/tracks?ids=") ? json({ error: { status: 401 } }, 401) : undefined,
    );
    await expect(
      spotifyDiscography({ kind: "artist", id: "A1" }, { token: "t", fetcher }),
    ).rejects.toThrow(/client ID and client secret/i);
  });

  it("lists albums ten to a page, which every app mode accepts", async () => {
    const { fetcher, calls } = makeFetcher();
    await spotifyDiscography({ kind: "artist", id: "A1" }, { token: "t", fetcher });
    expect(calls.find((u) => u.includes("/artists/A1/albums"))).toContain("limit=10");
  });

  it("turns a rejected key into a sentence about the key, not about the artist", async () => {
    const { fetcher } = makeFetcher((url) =>
      url.includes("/artists/A1") ? json({}, 401) : undefined,
    );
    await expect(
      spotifyDiscography({ kind: "artist", id: "A1" }, { token: "t", fetcher }),
    ).rejects.toThrow(/client ID and client secret/i);
    await expect(
      spotifyDiscography({ kind: "artist", id: "A1" }, { token: "t", fetcher }),
    ).rejects.toBeInstanceOf(FastTrackError);
  });
});

describe("spotifyArtistName", () => {
  const named = (title: string) =>
    new Response(JSON.stringify({ title }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  it("reads the artist's name from a link with no credentials at all", async () => {
    let seen = "";
    const name = await spotifyArtistName(
      "https://open.spotify.com/artist/2f8LjB4H36k7JqeyXKuyVR?si=2EQRMk7RT9eQHuEUbvHheQ",
      async (url) => {
        seen = url;
        return named("Karma Came");
      },
    );
    expect(name).toBe("Karma Came");
    expect(seen.startsWith("https://open.spotify.com/oembed?url=")).toBe(true);
    // The whole link goes in the query, escaped, so Spotify sees the artist page rather than a bare id.
    expect(seen).toContain(encodeURIComponent("https://open.spotify.com/artist/2f8LjB4H36k7JqeyXKuyVR?si=2EQRMk7RT9eQHuEUbvHheQ"));
  });

  it("answers undefined rather than throwing when the embed service can't help", async () => {
    const notFound = async () => new Response("", { status: 404 });
    const offline = async () => {
      throw new Error("offline");
    };
    expect(await spotifyArtistName("https://open.spotify.com/artist/X", notFound)).toBeUndefined();
    expect(await spotifyArtistName("https://open.spotify.com/artist/X", offline)).toBeUndefined();
    expect(await spotifyArtistName("https://open.spotify.com/artist/X", async () => named("  "))).toBeUndefined();
  });
});

describe("spotifyToken", () => {
  beforeEach(() => {
    clearSpotifyToken();
    delete process.env["SPOTIFY_CLIENT_ID"];
    delete process.env["SPOTIFY_CLIENT_SECRET"];
  });

  it("says it isn't configured rather than failing vaguely", async () => {
    expect(spotifyConfigured()).toBe(false);
    await expect(spotifyToken(async () => json({}))).rejects.toBeInstanceOf(SpotifyNotConfigured);
  });

  it("asks for a client-credentials token once, then reuses it", async () => {
    process.env["SPOTIFY_CLIENT_ID"] = "id-123";
    process.env["SPOTIFY_CLIENT_SECRET"] = "secret-456";
    const seen: string[] = [];
    const fetcher = async (url: string, init?: RequestInit): Promise<Response> => {
      seen.push(url);
      expect(init?.body).toBe("grant_type=client_credentials");
      expect(String((init?.headers as Record<string, string>)["authorization"])).toBe(
        `Basic ${btoa("id-123:secret-456")}`,
      );
      return json({ access_token: "tok", expires_in: 3600 });
    };
    expect(spotifyConfigured()).toBe(true);
    expect(await spotifyToken(fetcher)).toBe("tok");
    expect(await spotifyToken(fetcher)).toBe("tok");
    expect(seen).toHaveLength(1);
  });
});
