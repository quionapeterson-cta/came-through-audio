import { describe, it, expect } from "vitest";
import {
  alreadyInCatalog,
  prefillPlan,
  releaseTypeOf,
  songFromRelease,
  titleKey,
  withStreamingDetails,
} from "@/lib/fast-track-prefill";
import { emptyContributor } from "@/lib/metadata";
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

  it("leaves the same ISRC alone and asks about a same-titled song with another code", () => {
    const plan = prefillPlan({
      discography,
      matches: [unverified(release.tracks[0]!.title), unverified(release.tracks[1]!.title)],
      existing: [
        {
          id: "a",
          title: "Big Booty Bouncing",
          artist: "Karma Came",
          isrc: "US-CTA-16-00002",
          album: "BAM",
        },
        { id: "b", title: "Karma Season", artist: "Karma Came", isrc: "gx8kd2640649" },
      ],
      profile: null,
    });
    expect(plan.songs).toHaveLength(0);
    expect(plan.existingCount).toBe(1);
    // "(feat. OG PI)" is a credit, not a version: it is the same song, so the member decides.
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]!.existing.id).toBe("a");
    expect(plan.conflicts[0]!.song.isrc).toBe("GX8KD2640648");
  });

  it("treats a version as its own recording, never as the song it is a version of", () => {
    const qpwm: PulledRelease = {
      id: "q",
      title: "Quit Playing With Me Deluxe",
      recordType: "single",
      tracks: [
        { title: "Quit Playing With Me", artist: "Karma Came", isrc: "QT6HW2687935" },
        {
          title: "Quit Playing With Me - Dirty Version",
          artist: "Karma Came",
          isrc: "QT6HW2687937",
        },
        {
          title: "Quit Playing With Me - Official Acapella",
          artist: "Karma Came",
          isrc: "QT6HW2687938",
        },
      ],
    };
    const plan = prefillPlan({
      discography: { ...discography, releases: [qpwm], trackCount: 3 },
      matches: [],
      existing: [
        { id: "q1", title: "Quit Playing With Me", artist: "Karma Came", isrc: "US-CTA-26-00121" },
      ],
      profile: null,
    });
    expect(plan.conflicts.map((c) => c.song.title)).toEqual(["Quit Playing With Me"]);
    expect(plan.songs.map((s) => s.title)).toEqual([
      "Quit Playing With Me - Dirty Version",
      "Quit Playing With Me - Official Acapella",
    ]);
  });

  it("saves a recording on two releases once, on the album the catalog already names, else the album", () => {
    const single: PulledRelease = {
      id: "s",
      title: "Bossed Out",
      recordType: "single",
      tracks: [{ title: "Bossed Out", artist: "Karma Came", isrc: "GBSMU3483169" }],
    };
    const album: PulledRelease = {
      id: "al",
      title: "BAM",
      recordType: "album",
      tracks: [
        { title: "Bossed Out", artist: "Karma Came", isrc: "GBSMU3483169", position: 3 },
        { title: "24/7 Love", artist: "Karma Came", isrc: "GBSMU3060595", position: 4 },
      ],
    };
    const d = { ...discography, releases: [single, album], trackCount: 3 };
    const mine = prefillPlan({
      discography: d,
      matches: [],
      profile: null,
      existing: [{ id: "x", title: "Bossed Out", artist: "Karma Came", album: "BAM" }],
    });
    expect(mine.repeatCount).toBe(1);
    expect(mine.conflicts.map((c) => c.song.album)).toEqual(["BAM"]);
    const fresh = prefillPlan({ discography: d, matches: [], profile: null, existing: [] });
    expect(fresh.songs.map((s) => `${s.title} · ${s.album}`)).toEqual([
      "Bossed Out · BAM",
      "24/7 Love · BAM",
    ]);
  });

  it("pairs each catalog entry once, on the matching album first", () => {
    const album: PulledRelease = {
      id: "al",
      title: "BAM",
      recordType: "album",
      tracks: [{ title: "Bloodline", artist: "Karma Came", isrc: "GBSMU2963386" }],
    };
    const plan = prefillPlan({
      discography: { ...discography, releases: [album], trackCount: 1 },
      matches: [],
      profile: null,
      existing: [
        { id: "single", title: "Bloodline", artist: "Karma Came", album: "Bloodline" },
        { id: "bam", title: "Bloodline", artist: "Karma Came", album: "BAM" },
      ],
    });
    expect(plan.conflicts.map((c) => c.existing.id)).toEqual(["bam"]);
  });

  it("takes only streaming's recording details onto an entry, keeping the member's own work", () => {
    const mine = {
      ...songFromRelease(release, release.tracks[1]!, undefined, null),
      isrc: "US-CTA-16-00009",
      label: "Came Through Audio",
      lyrics: "words",
      writers: [{ ...emptyContributor(), legalName: "Qui-Ona Peterson", role: "Author/Composer" }],
    };
    const pulled = { ...songFromRelease(release, release.tracks[1]!, undefined, null), label: "" };
    const out = withStreamingDetails(mine, pulled);
    expect(out.isrc).toBe("GX8KD2640649");
    expect(out.upc).toBe("123456789012");
    expect(out.lyrics).toBe("words");
    expect(out.writers[0]!.legalName).toBe("Qui-Ona Peterson");
    // Spotify no longer sends a label: a blank never wipes the entry's own.
    expect(out.label).toBe("Came Through Audio");
  });

  it("matches on ISRC only for 'already here'", () => {
    expect(
      alreadyInCatalog({ isrc: "gx8kd2640648" }, [
        { title: "Big Booty Bouncing", artist: "Karma Came", isrc: "GX8KD2640648" },
      ]),
    ).toBe(true);
    expect(alreadyInCatalog({ isrc: "" }, [{ title: "Karma Season", artist: "Karma Came" }])).toBe(
      false,
    );
  });

  it("ignores feat. credits, case and punctuation in titles, never a version tag", () => {
    expect(titleKey("Be There In A Minute")).toBe(titleKey("Be There in a Minute"));
    expect(titleKey("Beauty King (feat. Digga)")).toBe(titleKey("Beauty King"));
    expect(titleKey("Therapy - Official Clean Version")).not.toBe(titleKey("Therapy"));
  });

  it("reads release types and leaves an unknown one unanswered", () => {
    expect(releaseTypeOf("album")).toBe("Album");
    expect(releaseTypeOf("single")).toBe("Single");
    expect(releaseTypeOf("compile")).toBe("Compilation");
    expect(releaseTypeOf(undefined)).toBe("");
    expect(releaseTypeOf("mixtape")).toBe("");
  });
});
