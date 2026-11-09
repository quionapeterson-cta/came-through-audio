import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { emptyMetadata } from "@/lib/metadata";

const saveTrack = vi.fn(async (_m: unknown, _u: string, id?: string) => id ?? "new-id");
const listTracks = vi.fn();
vi.mock("@/lib/catalog", () => ({ saveTrack: (...a: [unknown, string, string?]) => saveTrack(...a), listTracks: (u?: string) => listTracks(u) }));
vi.mock("@/lib/artist-profile", async (orig) => ({ ...(await orig<typeof import("@/lib/artist-profile")>()), loadProfile: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/fast-track.functions", () => ({
  runStreamingFastTrack: async () => ({
    ok: true,
    kind: "discography",
    mlcActive: false,
    matches: [],
    discography: {
      artist: { id: "A", name: "Karma Came" },
      source: "spotify",
      trackCount: 3,
      withIsrc: 3,
      truncated: false,
      fetchedAt: "2026-11-09T00:00:00Z",
      releases: [
        { id: "s", title: "Bossed Out", recordType: "single", tracks: [{ title: "Bossed Out", artist: "Karma Came", isrc: "GBSMU3483169" }] },
        {
          id: "b",
          title: "BAM",
          recordType: "album",
          upc: "5057917928823",
          tracks: [
            { title: "Bossed Out", artist: "Karma Came", isrc: "GBSMU3483169", position: 3 },
            { title: "Boys After Me", artist: "Karma Came", isrc: "GBSMU2956927", position: 6 },
          ],
        },
      ],
    },
  }),
}));

const { StreamingFastTrack } = await import("@/components/StreamingFastTrack");

const mine = { ...emptyMetadata(), title: "Bossed Out", artist: "Karma Came", album: "BAM", isrc: "US-CTA-16-00003", lyrics: "my words" };

describe("StreamingFastTrack catalog prefill", () => {
  beforeEach(() => {
    saveTrack.mockClear();
    listTracks.mockResolvedValue([{ id: "t1", title: "Bossed Out", artist: "Karma Came", updatedAt: "", metadata: mine }]);
  });

  async function pull() {
    render(<StreamingFastTrack userId="u1" canCatalog />);
    fireEvent.change(screen.getByPlaceholderText("Your artist name"), { target: { value: "Karma Came" } });
    fireEvent.click(screen.getByRole("button", { name: /Pull my streaming releases/ }));
    // Bossed Out is on the single and the album: one recording, so two songs to add, not three.
    fireEvent.click(await screen.findByRole("button", { name: /Add 2 released tracks/ }));
  }

  it("asks about a song already in My Catalog instead of skipping or duplicating it", async () => {
    await pull();
    expect(await screen.findByText(/1 song looks like one already in My Catalog/)).toBeTruthy();
    expect(saveTrack).not.toHaveBeenCalled();
    expect(listTracks).toHaveBeenCalledWith("u1");
    fireEvent.click(screen.getByRole("radio", { name: "Use Spotify's" }));
    fireEvent.click(screen.getByRole("button", { name: /Confirm and save/ }));
    await waitFor(() => expect(saveTrack).toHaveBeenCalledTimes(2));
    const update = saveTrack.mock.calls.find((c) => c[2] === "t1")!;
    // The released code and the album's UPC land on the member's entry; their lyrics stay.
    expect(update[0]).toMatchObject({ isrc: "GBSMU3483169", upc: "5057917928823", album: "BAM", lyrics: "my words" });
    expect(saveTrack.mock.calls.some((c) => (c[0] as { title: string }).title === "Boys After Me" && c[2] === undefined)).toBe(true);
  });

  it("leaves the entry alone when the member keeps theirs", async () => {
    await pull();
    fireEvent.click(await screen.findByRole("button", { name: /Confirm and save/ }));
    await waitFor(() => expect(saveTrack).toHaveBeenCalledTimes(1));
    expect(saveTrack.mock.calls[0]![2]).toBeUndefined();
  });
});
