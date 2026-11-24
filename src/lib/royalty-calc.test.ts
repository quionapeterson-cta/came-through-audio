import { describe, expect, it } from "vitest";
import { emptyMetadata } from "@/lib/metadata";
import {
  PLATFORMS,
  convertBetween,
  estimateEarnings,
  songShareRows,
  yourSongShare,
} from "@/lib/royalty-calc";

describe("the financial lab", () => {
  it("moves shares between BMI's 200% scale and ASCAP/SESAC's 100% scale", () => {
    expect(convertBetween(100, "bmi", "ascap")).toBe(50);
    expect(convertBetween(25, "sesac", "bmi")).toBe(50);
    expect(convertBetween(40, "ascap", "sesac")).toBe(40);
  });
  it("reads a song's writer and publisher halves from the catalog", () => {
    const m = {
      ...emptyMetadata(),
      writers: [
        { name: "", legalName: "Ann Lee", pro: "BMI", ipi: "", percentage: "60" },
        { name: "", legalName: "Kim Roe", pro: "BMI", ipi: "", percentage: "40" },
      ],
      composers: [],
      publishers: [],
    };
    const rows = songShareRows(m);
    expect(rows.filter((r) => r.half === "Writer").map((r) => r.catalog)).toEqual([60, 40]);
    // No publisher and BMI writers: BMI pays each their publisher share, at their writer split.
    expect(rows.filter((r) => r.half === "Publisher").map((r) => r.catalog)).toEqual([60, 40]);
    expect(yourSongShare(rows, ["Ann Lee"])).toBe(60);
  });
  it("opens every streaming platform on a published rate, and per-use only at zero", () => {
    const byId = Object.fromEntries(PLATFORMS.map((p) => [p.id, p]));
    for (const id of [
      "spotify",
      "apple",
      "amazon",
      "youtube_music",
      "tidal",
      "deezer",
      "pandora",
      "youtube",
      "soundcloud",
    ])
      expect(byId[id]?.rate, id).toBeGreaterThan(0);
    // Audiomack publishes only its 50% revenue share, no per-stream figure, so it stays at 0 rather than guessing.
    expect(byId["audiomack"]?.rate).toBe(0);
    // TikTok and Meta pay per video use, not per stream, so a per-stream default would be the wrong unit.
    for (const id of ["tiktok", "meta"]) expect(byId[id]?.rate, id).toBe(0);
    for (const p of PLATFORMS) {
      expect(Number.isFinite(p.rate), p.id).toBe(true);
      if (p.rate > 0) expect(p.source, p.id).toBeTruthy();
    }
  });
  it("estimates your cut: about 80% of a stream pays the master side, 20% the song side", () => {
    const r = estimateEarnings({
      streams: { spotify: 100000 },
      rates: { spotify: 0.004 },
      masterShare: 100,
      songShare: 0,
      radioPlays: 0,
      perPlay: 0,
    });
    expect(r.platforms.find((p) => p.id === "spotify")!.total).toBeCloseTo(400);
    expect(r.yours).toBeCloseTo(320);
  });
});
