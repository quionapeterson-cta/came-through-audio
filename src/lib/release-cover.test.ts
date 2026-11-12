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
          return { error: null };
        },
      }),
    },
    from: () => ({
      update: (row: { details?: { artPath?: string; coverThumb?: string } }) => ({
        eq: (_column: string, id: string) => ({
          select: () => ({
            single: async () => {
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
});
