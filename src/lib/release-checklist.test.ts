import { describe, expect, it } from "vitest";
import { emptyMetadata } from "@/lib/metadata";
import { trackReport } from "@/lib/health";
import { catalogHealth, encouragement, songChecklist } from "@/lib/health-checklist";
import { emptyStatus } from "@/lib/health-songs";
import { countryByCode } from "@/lib/repertoires";
import { isUnreleased, RELEASE_TICK } from "@/lib/release-checklist";

const us = countryByCode("US")!;
const track = (id: string, extra = {}) => ({ id, title: id, artist: "Q", updatedAt: "", metadata: { ...emptyMetadata(), title: id, artist: "Q", isrc: "USCTA2600001",
  upc: "", duration: "3:10", primaryGenre: "Hip-Hop/Rap", samples: "No" as const, writtenFor: "No" as const, lyrics: "la la", audioPath: "u/a.mp3", artPath: "u/a.jpg",
  writers: [{ name: "", legalName: "Ann Lee", role: "Author/Composer", pro: "BMI", ipi: "00123456789", percentage: "100" }],
  publishers: [{ name: "Lee Songs", pro: "BMI", ipi: "00987654321", percentage: "100" }], ...extra } });

describe("pre-distribution (release checklist)", () => {
  it("knows a song isn't out from a future date or the box", () => {
    expect(isUnreleased({ releaseDate: "2099-01-01", unreleased: false })).toBe(true);
    expect(isUnreleased({ releaseDate: "", unreleased: true })).toBe(true);
    expect(isUnreleased({ releaseDate: "2020-01-01", unreleased: true })).toBe(false);
    expect(isUnreleased({ releaseDate: "", unreleased: false })).toBe(false);
  });

  it("reads an unreleased song against what to have ready, with SoundExchange waiting", () => {
    const t = track("Soon", { releaseDate: "2099-01-01" });
    const c = songChecklist(trackReport(t, us, []), us);
    expect(c.prerelease).toBe(true);
    const release = c.steps.filter((s) => s.stage === "release");
    expect(release.map((s) => [s.id, s.done])).toEqual([
      ["release:writers", true], ["release:splits", true], ["release:splitSheet", false], ["release:pro", true], ["release:isrc", true],
      ["release:upc", false], ["release:master", true], ["release:art", true], ["release:ai", false],
    ]);
    const sx = c.steps.find((s) => s.id === "register:digital");
    expect(sx).toMatchObject({ optional: true, done: false });
    // 6 of 8 required release items + 0 of 2 registrations (BMI, MLC) = 6 / 10.
    expect(c.pct).toBe(60);
    expect(encouragement(c)).toContain("60% ready to distribute");
    const ticked = songChecklist(trackReport(t, us, []), us, { ...emptyStatus("Soon"), steps: { [RELEASE_TICK.split]: "x", [RELEASE_TICK.upc]: "x", "registered:bmi": "x", "registered:mlc": "x" } });
    expect(ticked.pct).toBe(100);
  });

  it("keeps unreleased songs out of the catalog score, on their own line", () => {
    const h = catalogHealth([track("Out"), track("Soon", { releaseDate: "2099-01-01" })], us, [], []);
    expect(h.released).toBe(1);
    expect(h.prerelease).toEqual({ count: 1, pct: 60 });
    expect(h.songs.find((s) => s.track.id === "Out")?.prerelease).toBe(false);
  });
});
