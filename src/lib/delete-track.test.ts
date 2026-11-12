import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Deleting a song is gated by a restrictive policy (Catalog Plus), and the API answers a refused delete with zero rows
 * and no error. The founder's deletes of the duplicate copies all "worked" and none of them happened (2026-11-12), so
 * these tests hold the difference: a delete that removes nothing has to fail out loud, and it must not take the files.
 */
const calls = vi.hoisted(() => ({
  removed: [] as string[],
  storageTouched: 0,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "owner-1" } } }) },
    from: () => ({
      delete: () => ({
        eq: (_column: string, id: string) => ({
          select: async () => ({ data: calls.removed.map((r) => ({ ...(r === id ? { id } : {}) })), error: null }),
        }),
      }),
    }),
    storage: {
      from: () => ({
        list: async () => {
          calls.storageTouched += 1;
          return { data: [] as { name: string }[], error: null };
        },
        remove: async () => ({ error: null }),
      }),
    },
  },
}));

const { deleteTrack } = await import("@/lib/catalog");

describe("deleteTrack", () => {
  beforeEach(() => {
    calls.removed = [];
    calls.storageTouched = 0;
  });

  it("says so when the account's plan blocks the delete, instead of reporting a song gone", async () => {
    await expect(deleteTrack("song-1", "owner-1")).rejects.toThrow(/still in your catalog/);
    expect(calls.storageTouched).toBe(0);
  });

  it("goes through when the row is actually removed", async () => {
    calls.removed = ["song-1"];
    await expect(deleteTrack("song-1", "owner-1")).resolves.toBeUndefined();
    expect(calls.storageTouched).toBe(1);
  });
});
