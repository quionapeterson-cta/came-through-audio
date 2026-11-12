import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyMetadata } from "@/lib/metadata";

/**
 * A release has one cover, so an EP or album takes a single upload (founder, 2026-11-11): the file is stored once, copied
 * into every other song's own folder inside the bucket, and written to each row. These tests hold that shape, because a
 * second upload per song is exactly what the feature exists to avoid.
 */
const calls = vi.hoisted(() => ({
  uploads: [] as string[],
  copies: [] as [string, string][],
  updates: [] as { id: string; artPath: string; coverThumb: string }[],
  removes: [] as string[],
  // Two ways a song can refuse the cover, so a partly-covered release can be played through.
  failCopyFor: new Set<string>(),
  refuseSaveFor: new Set<string>(),
  // Paths that already hold an object, the way a cover set before (or an interrupted run) leaves one behind.
  existing: new Set<string>(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: async (path: string) => {
          calls.uploads.push(path);
          return { error: null };
        },
        copy: async (from: string, to: string) => {
          calls.copies.push([from, to]);
          // `to` is <user>/<track id>/artwork.<ext>, so a test refuses one song's copy by its id.
          const id = to.split("/")[1] ?? "";
          if (calls.failCopyFor.has(id)) return { error: { message: "the copy was refused" } };
          // Like the real API: a destination that is already there is refused, not overwritten.
          if (calls.existing.has(to)) return { error: { message: "The resource already exists" } };
          return { error: null };
        },
        remove: async (paths: string[]) => {
          calls.removes.push(...paths);
          paths.forEach((p) => calls.existing.delete(p));
          return { error: null };
        },
      }),
    },
    from: () => ({
      update: (row: { details?: { artPath?: string; coverThumb?: string } }) => ({
        eq: (_column: string, id: string) => ({
          select: () => ({
            single: async () => {
              if (calls.refuseSaveFor.has(id)) return { data: null, error: { message: "the database refused it" } };
              // The artwork lives in the song's own details, which is where the catalog stores every metadata field.
              calls.updates.push({ id, artPath: String(row.details?.artPath ?? ""), coverThumb: String(row.details?.coverThumb ?? "") });
              return { data: { id }, error: null };
            },
          }),
        }),
      }),
    }),
  },
}));

import { setReleaseArtwork, type CatalogTrack } from "@/lib/catalog";

const song = (id: string): CatalogTrack => ({
  id,
  title: id,
  artist: "Karma Came",
  updatedAt: "",
  metadata: { ...emptyMetadata(), title: id, artist: "Karma Came", album: "Bloom" },
});

const cover = () => new File(["x"], "cover.jpg", { type: "image/jpeg" });

describe("setReleaseArtwork", () => {
  beforeEach(() => {
    calls.uploads.length = 0;
    calls.copies.length = 0;
    calls.updates.length = 0;
    calls.failCopyFor.clear();
    calls.refuseSaveFor.clear();
    calls.existing.clear();
    calls.removes.length = 0;
  });

  it("uploads the cover once and copies it into every other song's folder", async () => {
    const tracks = [song("a"), song("b"), song("c")];
    const { songs, covers } = await setReleaseArtwork(tracks, "user-1", cover());

    expect(songs).toBe(3);
    expect(calls.uploads).toEqual(["user-1/a/artwork.jpg"]);
    expect(calls.copies).toEqual([
      ["user-1/a/artwork.jpg", "user-1/b/artwork.jpg"],
      ["user-1/a/artwork.jpg", "user-1/c/artwork.jpg"],
    ]);
    // Every row points at its own copy, so deleting one song never takes another's cover with it.
    expect(covers).toEqual([
      { id: "a", artPath: "user-1/a/artwork.jpg" },
      { id: "b", artPath: "user-1/b/artwork.jpg" },
      { id: "c", artPath: "user-1/c/artwork.jpg" },
    ]);
    expect(calls.updates.map((u) => u.id)).toEqual(["a", "b", "c"]);
    expect(calls.updates.every((u) => u.artPath.endsWith("/artwork.jpg"))).toBe(true);
  });

  it("carries the small tile to every song too, so the release header shows the cover", async () => {
    await setReleaseArtwork([song("a"), song("b")], "user-1", cover(), "data:image/jpeg;base64,tile");
    expect(calls.updates.every((u) => u.coverThumb === "data:image/jpeg;base64,tile")).toBe(true);
  });

  it("keeps the png it was given", async () => {
    await setReleaseArtwork([song("a")], "user-1", new File(["x"], "cover.png", { type: "image/png" }));
    expect(calls.uploads).toEqual(["user-1/a/artwork.png"]);
  });

  it("refuses anything that isn't a JPEG or PNG, before touching storage", async () => {
    await expect(
      setReleaseArtwork([song("a")], "user-1", new File(["x"], "cover.gif", { type: "image/gif" })),
    ).rejects.toThrow(/JPEG or PNG/);
    expect(calls.uploads).toEqual([]);
  });

  it("says there is nothing to cover when the release is empty", async () => {
    await expect(setReleaseArtwork([], "user-1", cover())).rejects.toThrow(/no songs/);
  });

  it("keeps the songs whose cover landed when one copy is refused, and names the one it missed", async () => {
    calls.failCopyFor.add("b");
    const { songs, covers, failed } = await setReleaseArtwork([song("a"), song("b"), song("c")], "user-1", cover());

    // b's folder was never written, so its row is left alone instead of pointing at a cover it doesn't have.
    expect(songs).toBe(2);
    expect(covers.map((c) => c.id)).toEqual(["a", "c"]);
    expect(calls.updates.map((u) => u.id)).toEqual(["a", "c"]);
    expect(failed).toEqual(["b (the copy was refused)"]);
  });

  it("reports a refused row instead of losing the rest of the release", async () => {
    calls.refuseSaveFor.add("a");
    const { songs, failed } = await setReleaseArtwork([song("a"), song("b")], "user-1", cover());

    expect(songs).toBe(1);
    expect(failed).toEqual(["a (the database refused it)"]);
    expect(calls.updates.map((u) => u.id)).toEqual(["b"]);
  });

  it("replaces a song whose folder already holds this cover instead of refusing it", async () => {
    // The reported bug: a cover set before leaves artwork.jpg in the folder, and copy() refuses to overwrite it, so
    // every song but the first failed with "The resource already exists" while the release looked half-covered.
    calls.existing.add("user-1/b/artwork.jpg");
    const { songs, covers, failed } = await setReleaseArtwork([song("a"), song("b")], "user-1", cover());

    expect(failed).toEqual([]);
    expect(songs).toBe(2);
    expect(covers.map((c) => c.id)).toEqual(["a", "b"]);
    // The stale object was cleared first, then the copy was tried again and went through.
    expect(calls.removes).toContain("user-1/b/artwork.jpg");
    expect(calls.copies.filter(([, to]) => to === "user-1/b/artwork.jpg")).toHaveLength(2);
  });

  it("clears the other format's copy so a replaced cover leaves nothing behind", async () => {
    await setReleaseArtwork([song("a"), song("b")], "user-1", cover());
    expect(calls.removes).toEqual(["user-1/a/artwork.png", "user-1/b/artwork.png"]);
  });

  it("still fails outright when no song takes the cover", async () => {
    calls.refuseSaveFor.add("a");
    calls.failCopyFor.add("b");
    await expect(setReleaseArtwork([song("a"), song("b")], "user-1", cover())).rejects.toThrow(/didn't reach any song/);
  });
});
