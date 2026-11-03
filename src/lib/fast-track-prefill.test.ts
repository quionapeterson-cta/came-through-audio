import { describe, it, expect } from "vitest";
import {
  alreadyInCatalog,
  prefillPlan,
  releaseTypeOf,
  songFromRelease,
} from "@/lib/fast-track-prefill";
import type { CompositionMatch } from "@/lib/composition";
import type { Discography, PulledRelease } from "@/lib/discography";

const release: PulledRelease = {
  id: 1,
  title: "Came Through",
  upc: "123456789012",
  label: "Karma Came",
  releaseDate: "2026-03-03",
  recordType: "ep",
  tracks: [
    {
      title: "Big Booty Bouncing (feat. OG PI)",
      artist: "Karma Came",
      isrc: "GX8KD2640648",
      duration: 192,
      position: 1,
    },
    {
      title: "Karma Season",
      artist: "Karma Came",
      isrc: "GX8KD2640649",
      duration: 205,
      position: 2,
    },
  ],
};

const discography: Discography = {
  artist: { id: 7, name: "Karma Came" },
  releases: [release],
  trackCount: 2,
  withIsrc: 2,
  truncated: false,
  source: "deezer",
  fetchedAt: "2026-11-03T00:00:00.000Z",
};

const unverified = (title: string): CompositionMatch => ({
  title,
  artist: "Karma Came",
  status: "unverified",
  source: "none",
  note: "Not yet verified.",
});

const matched: CompositionMatch = {
  title: "Big Booty Bouncing (feat. OG PI)",
  artist: "Karma Came",
  isrc: "GX8KD2640648",
  status: "matched",
  source: "mlc",
  note: "On file at The MLC.",
  work: {
    workId: "MLC123",
    iswc: "T1234567890",
    writers: [{ name: "Quiona Peterson", pro: "BMI", ipi: "123456789" }],
    publishers: [{ name: "Karma Came Publishing", ipi: "987654321" }],
  },
};

describe("fast-track prefill", () => {
  it("saves a released recording's own details exactly, composition only when a work matched", () => {
    const song = songFromRelease(release, release.tracks[0]!, unverified("x"), null);
    expect(song.title).toBe("Big Booty Bouncing (feat. OG PI)");
    expect(song.artist).toBe("Karma Came");
    expect(song.album).toBe("Came Through");
    expect(song.trackNumber).toBe("1");
    expect(song.trackTotal).toBe("2");
    expect(song.duration).toBe("03:12");
    expect(song.isrc).toBe("GX8KD2640648");
    expect(song.upc).toBe("123456789012");
    expect(song.releaseDate).toBe("2026-03-03");
    expect(song.label).toBe("Karma Came");
    expect(song.releaseType).toBe("EP");
    expect(song.unreleased).toBe(false);
    // Unverified is not registered: no writer, publisher or ISWC is invented.
    expect(song.iswc).toBe("");
    expect(song.writers.filter((w) => w.legalName || w.name)).toHaveLength(0);
    expect(song.publishers.filter((p) => p.name)).toHaveLength(0);
  });

  it("takes writers, publishers and the ISWC from a work on file, and fills blanks from the profile", () => {
    const profile = { label: "", contactEmail: "hello@example.com" };
    const song = songFromRelease(release, release.tracks[0]!, matched, profile);
    expect(song.iswc).toBe("T1234567890");
    expect(song.writers[0]).toMatchObject({
      legalName: "Quiona Peterson",
      pro: "BMI",
      ipi: "123456789",
      role: "Author/Composer",
    });
    expect(song.publishers[0]).toMatchObject({ name: "Karma Came Publishing", ipi: "987654321" });
    expect(song.contactEmail).toBe("hello@example.com");
    // The release's own label wins over the profile's: only blanks are filled.
    expect(song.label).toBe("Karma Came");
  });

  it("keeps what the catalog already has", () => {
    const plan = prefillPlan({
      discography,
      matches: [unverified(release.tracks[0]!.title), unverified(release.tracks[1]!.title)],
      existing: [{ title: "Big Booty Bouncing", artist: "Karma Came" }],
      profile: null,
    });
    expect(plan.songs.map((s) => s.title)).toEqual(["Karma Season"]);
    expect(plan.existingCount).toBe(1);
  });

  it("matches on ISRC before names, so a retitled song is still left alone", () => {
    expect(
      alreadyInCatalog({ title: "Some Remix", artist: "Karma Came", isrc: "gx8kd2640648" }, [
        { title: "Big Booty Bouncing", artist: "Karma Came", isrc: "GX8KD2640648" },
      ]),
    ).toBe(true);
    expect(
      alreadyInCatalog({ title: "Karma Season", artist: "Someone Else", isrc: "" }, [
        { title: "Karma Season", artist: "Karma Came" },
      ]),
    ).toBe(false);
  });

  it("reads release types and leaves an unknown one unanswered", () => {
    expect(releaseTypeOf("album")).toBe("Album");
    expect(releaseTypeOf("single")).toBe("Single");
    expect(releaseTypeOf("compile")).toBe("Compilation");
    expect(releaseTypeOf(undefined)).toBe("");
    expect(releaseTypeOf("mixtape")).toBe("");
  });
});
