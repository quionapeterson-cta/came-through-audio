import { describe, expect, it } from "vitest";
import { agencyMetadata, agencyVersion, fillPlan, finishItems, writerShares } from "@/lib/agency-fill";
import type { ListResult, ListWork } from "@/lib/agency-lists";
import type { CatalogTrack } from "@/lib/catalog";
import { emptyMetadata } from "@/lib/metadata";

const work = (o: Partial<ListWork> = {}): ListWork => ({ title: "Bloodline", iswc: "", isrc: "", workId: "1", writers: [], ...o });
const track = (id: string, title: string, metadata: Partial<ReturnType<typeof emptyMetadata>> = {}): CatalogTrack => ({
  id, title, artist: "Karma Came", updatedAt: "2026-11-01",
  metadata: { ...emptyMetadata(), title, artist: "Karma Came", ...metadata },
});
const result = (o: Partial<ListResult> = {}): ListResult => ({ matched: [], differences: [], notListed: [], extra: [], works: 0, ...o });

describe("writer shares on a list", () => {
  it("brings a 200% scale back to 100%", () => {
    expect(writerShares([{ name: "A", share: 100 }, { name: "B", share: 100 }])).toEqual([50, 50]);
  });

  it("rounds to a total of exactly 100, so the member's next save passes validation", () => {
    const shares = writerShares([{ name: "A", share: 33.33 }, { name: "B", share: 33.33 }, { name: "C", share: 33.33 }]);
    expect(shares.reduce((n, x) => n + x, 0)).toBe(100);
  });

  it("leaves a share scale alone when it already adds up, and blanks stay blank", () => {
    expect(writerShares([{ name: "A", share: 75 }, { name: "B", share: 25 }])).toEqual([75, 25]);
    expect(writerShares([{ name: "A" }])).toEqual([0]);
  });
});

describe("starting an entry from a list work", () => {
  it("carries the title, codes, writer names, IPI and shares, and leaves the rest blank", () => {
    const m = agencyMetadata(work({ isrc: "USCTA2600111", iswc: "T1234567890", writers: [{ name: "Qui-Ona Peterson", ipi: "123456789", pro: "BMI", share: 100 }] }), "Karma Came");
    expect(m.title).toBe("Bloodline");
    expect(m.artist).toBe("Karma Came");
    expect(m.isrc).toBe("USCTA2600111");
    expect(m.iswc).toBe("T1234567890");
    expect(m.writers[0]).toMatchObject({ legalName: "Qui-Ona Peterson", role: "Author/Composer", ipi: "123456789", pro: "BMI", percentage: "100" });
    expect(m.album).toBe("");
    expect(m.releaseType).toBe("");
  });

  it("keeps a writer row when the list has no writers, so the form still has a place to type one", () => {
    expect(agencyMetadata(work(), "Karma Came").writers).toHaveLength(1);
  });

  it("names what the member still has to add", () => {
    expect(finishItems(agencyMetadata(work(), "Karma Came"))).toEqual(["album or single title", "release type", "duration", "genre", "release date", "writer names"]);
  });
});

describe("planning a fill", () => {
  it("adds the works the catalog doesn't have and offers the catalogued ones as duplicates", () => {
    const existing = track("t1", "Bloodline", { album: "BAM", isrc: "USCTA1600001" });
    const other = track("t2", "Good Girls");
    const plan = fillPlan(result({
      extra: [work({ title: "All Your Life", workId: "9" })],
      matched: [{ trackId: "t1", title: "Bloodline", work: work({ writers: [{ name: "Qui-Ona Peterson", share: 100 }] }), issues: [] }],
      differences: [{ trackId: "t2", title: "Good Girls", work: work({ title: "Good Girls", workId: "7", writers: [{ name: "Qui-Ona Peterson", share: 100 }] }), issues: ["share"] }],
    }), [existing, other], "Karma Came");
    expect(plan.creates.map((c) => c.metadata.title)).toEqual(["All Your Life"]);
    expect(plan.duplicates.map((d) => d.track.id)).toEqual(["t1", "t2"]);
  });

  it("treats a work catalogued after the upload as a duplicate, not a second copy", () => {
    const plan = fillPlan(result({ extra: [work({ title: "Bloodline", workId: "9", writers: [{ name: "Qui-Ona Peterson", share: 100 }] })] }), [track("t1", "Bloodline")], "Karma Came");
    expect(plan.creates).toHaveLength(0);
    expect(plan.duplicates.map((d) => d.track.id)).toEqual(["t1"]);
  });

  it("leaves a song the list already matches exactly out of the dialog", () => {
    const plan = fillPlan(result({ extra: [work({ title: "Bloodline", workId: "9" })] }), [track("t1", "Bloodline")], "Karma Came");
    expect(plan.creates).toHaveLength(0);
    expect(plan.duplicates).toHaveLength(0);
  });

  it("shows the agency's codes, and what differs, before the member chooses", () => {
    const plan = fillPlan(result({ extra: [work({ title: "Bloodline", isrc: "USCTA1600001", iswc: "T1234567890" })] }), [track("t1", "Bloodline")], "Karma Came");
    expect(plan.duplicates[0]!.issues).toEqual([
      "The agency has ISRC USCTA1600001, your catalog has none",
      "The agency has ISWC T1234567890, your catalog has none",
    ]);
    expect(plan.duplicates[0]!.changes).toEqual([
      { field: "ISRC", catalog: "none", agency: "USCTA1600001" },
      { field: "ISWC", catalog: "none", agency: "T1234567890" },
    ]);
  });

  it("doesn't call a same-title work a duplicate of a song the writers say it isn't", () => {
    const plan = fillPlan(result({
      matched: [{ trackId: "t1", title: "Midnight", work: work({ title: "Midnight", workId: "1", writers: [{ name: "Ann Lee", share: 50 }] }), issues: [] }],
      extra: [work({ title: "Midnight", workId: "2", writers: [{ name: "Someone Else", share: 100 }] })],
    }), [track("t1", "Midnight", { writers: [{ name: "", legalName: "Ann Lee", role: "Author/Composer", pro: "", ipi: "", percentage: "100" }] })], "Karma Came");
    expect(plan.creates.map((c) => c.work.workId)).toEqual(["2"]);
    expect(plan.duplicates.map((d) => d.track.id)).toEqual(["t1"]);
    expect(plan.duplicates[0]!.work.workId).toBe("1");
  });

  it("keeps only codes the catalog can validate, so the next save isn't blocked", () => {
    const m = agencyMetadata(work({ isrc: "NOT-A-CODE", iswc: "bogus" }), "Karma Came");
    expect(m.isrc).toBe("");
    expect(m.iswc).toBe("");
  });

  it("puts the agency's writers and codes on a duplicate without losing the catalog's release details", () => {
    const existing = track("t1", "Bloodline", { album: "BAM", releaseType: "Album", trackNumber: "1" });
    const m = agencyVersion(existing.metadata, work({ isrc: "USCTA1600001", writers: [{ name: "Qui-Ona Peterson", share: 100 }] }), "Karma Came");
    expect(m.album).toBe("BAM");
    expect(m.releaseType).toBe("Album");
    expect(m.trackNumber).toBe("1");
    expect(m.isrc).toBe("USCTA1600001");
    expect(m.writers[0]!.legalName).toBe("Qui-Ona Peterson");
  });
});
