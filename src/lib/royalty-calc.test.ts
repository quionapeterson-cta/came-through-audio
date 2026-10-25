import { describe, expect, it } from "vitest";
import { emptyMetadata } from "@/lib/metadata";
import { convertBetween, estimateEarnings, songShareRows, yourSongShare } from "@/lib/royalty-calc";

describe("royalty utility suite", () => {
  it("moves shares between BMI's 200% scale and ASCAP/SESAC's 100% scale", () => {
    expect(convertBetween(100, "bmi", "ascap")).toBe(50);
    expect(convertBetween(25, "sesac", "bmi")).toBe(50);
    expect(convertBetween(40, "ascap", "sesac")).toBe(40);
  });
  it("reads a song's writer and publisher halves from the catalog", () => {
    const m = { ...emptyMetadata(), writers: [{ name: "", legalName: "Ann Lee", pro: "BMI", ipi: "", percentage: "60" }, { name: "", legalName: "Kim Roe", pro: "BMI", ipi: "", percentage: "40" }], composers: [], publishers: [] };
    const rows = songShareRows(m);
    expect(rows.filter((r) => r.half === "Writer").map((r) => r.catalog)).toEqual([60, 40]);
    // No publisher and BMI writers: BMI pays each their publisher share, at their writer split.
    expect(rows.filter((r) => r.half === "Publisher").map((r) => r.catalog)).toEqual([60, 40]);
    expect(yourSongShare(rows, ["Ann Lee"])).toBe(60);
  });
  it("estimates your cut: about 80% of a stream pays the master side, 20% the song side", () => {
    const r = estimateEarnings({ streams: { spotify: 100000 }, rates: { spotify: 0.004 }, masterShare: 100, songShare: 0, radioPlays: 0, perPlay: 0 });
    expect(r.platforms.find((p) => p.id === "spotify")!.total).toBeCloseTo(400);
    expect(r.yours).toBeCloseTo(320);
  });
});
