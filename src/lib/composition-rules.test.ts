import { describe, it, expect } from "vitest";
import { compareList, titleKey, type ListWork } from "@/lib/agency-lists";
import { STORED_READER, actionFor, buildDifferenceRows, fieldFor, repertoireUrl, type StoredLists } from "@/lib/discrepancy-treatments";
import { emptyMetadata } from "@/lib/metadata";

/**
 * A PRO and The MLC register the composition, never the recording (founder, 2026-11-14): no ISRC, no artist, no version,
 * and never a word about a distributor. These are the rules, pinned.
 */
const writers = [
  { name: "", legalName: "Ann Lee", role: "Author/Composer", pro: "BMI", ipi: "00123456789", percentage: "50" },
  { name: "", legalName: "Bo Ray", role: "Composer", pro: "BMI", ipi: "0012345678", percentage: "50" },
];
const track = (id: string, title: string, extra = {}) => ({
  id, title, artist: "Karma Came", updatedAt: "",
  metadata: { ...emptyMetadata(), title, artist: "Karma Came", writers, composers: [], publishers: [], ...extra },
});
const work = (extra: Record<string, unknown>): ListWork => ({ title: "", iswc: "", isrc: "", workId: "", writers: [], ...extra }) as ListWork;
const stored = (society: string, differences: unknown[], matched: unknown[] = []): StoredLists =>
  ({ byId: { [society]: { file: `${society}.csv`, reader: STORED_READER, result: { matched, clashes: [], notListed: [], extra: [], works: differences.length + matched.length, differences } } } }) as unknown as StoredLists;
const BMI = [{ id: "bmi", name: "BMI" }];
const MLC = [{ id: "mlc", name: "The MLC" }];

describe("composition rules", () => {
  it("never asks a BMI song for an ISRC or an artist, and never sends it to a distributor", () => {
    const listed = [work({ title: "Bloodline", writers: [{ name: "Ann Lee", share: 50 }, { name: "Bo Ray", share: 50 }] })];
    const r = compareList(listed, [track("a", "Bloodline")], "composition", "BMI");
    const said = [...r.matched, ...r.differences].flatMap((m) => m.issues).join(" ");
    expect(said).not.toMatch(/ISRC/);
    expect(said).not.toMatch(/distributor/i);
    expect(r.differences).toHaveLength(0);
  });

  it("drops the alternate-title card once that name is saved on the song", () => {
    // The saved comparison still says the two names differ; the catalog now carries the agency's name as an alternate
    // title, which is what the card asked for, so the card is done (founder, 2026-11-15).
    const issue = 'The agency registers this work as "TWENTY FOUR SEVEN", your catalog says "24/7 Love" — a work is found by its registered title, so the two names have to match or yours has to be saved as an alternate title';
    const listed = [{ trackId: "a", title: "24/7 Love", work: work({ title: "TWENTY FOUR SEVEN" }), issues: [issue] }];
    const before = buildDifferenceRows({ tracks: [track("a", "24/7 Love")], societies: BMI, stored: stored("bmi", listed) });
    expect(before[0]!.kind).toBe("alternate-title");
    const after = buildDifferenceRows({ tracks: [track("a", "24/7 Love", { alternateTitles: ["TWENTY FOUR SEVEN"] })], societies: BMI, stored: stored("bmi", listed) });
    expect(after).toHaveLength(0);
  });

  it("draws a BMI card with the work's own fields and the public work-title search", () => {
    const rows = buildDifferenceRows({
      tracks: [track("a", "Bloodline")],
      societies: BMI,
      stored: stored("bmi", [{ trackId: "a", title: "Bloodline", work: work({ title: "Bloodline", iswc: "T1234567890" }), issues: ["The agency has ISWC T1234567890, your catalog has none"] }]),
    });
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.claims[0]!.isrc).toBe("");
    expect(row.agencyCodes).toEqual([]);
    expect(row.versions).toEqual({ catalog: "", agency: "" });
    expect(row.artists).toEqual({ catalog: "", agency: "" });
    // One check, by the writer's name, because that is what a PRO's repertoire searches (founder, 2026-11-15).
    expect(row.copy!.primary).toEqual({ label: "Copy Writer Name & Check BMI ↗", value: "Bloodline", what: "writer name" });
    expect(row.treatment.action).toBe("review");
    expect(actionFor(row)).toBe("review");
    expect(row.treatment.primary).not.toMatch(/ISRC|distributor/i);
    expect(row.treatment.detail).not.toMatch(/distributor/i);
    expect(repertoireUrl("bmi")).toBe("https://repertoire.bmi.com/");
    // The ISWC is what disagrees, so the fix opens that field.
    expect(fieldFor(row)).toBe("iswc");
    expect(row.treatment.secondary).toBe("Fix in My Catalog");
    // Two checks on one work — a title search and an ISWC search — were the duplicate the founder kept seeing.
    expect(row.copy!.secondary).toBeUndefined();
  });

  it("copies the writer's name for The MLC, whose public search is by writer", () => {
    const rows = buildDifferenceRows({
      tracks: [track("a", "Midnight")],
      societies: MLC,
      stored: stored("mlc", [{ trackId: "a", title: "Midnight", work: work({ title: "Midnight", iswc: "", writers: [{ name: "Ann Lee", share: 100 }] }), issues: ["Bo Ray isn't on the agency's registration"] }]),
    });
    const row = rows[0]!;
    expect(row.copy!.primary.label).toBe("Copy Writer Name & Check The MLC ↗");
    expect(row.copy!.primary.value).toBe("Bo Ray");
    expect(row.claims[0]!.writers).toEqual(["Ann Lee"]);
    expect(row.treatment.action).toBe("review");
    expect(fieldFor(row)).toBe("writers");
  });

  it("reads a number written as words as the same title", () => {
    expect(titleKey("24/7 Love")).toBe(titleKey("TWENTY FOUR SEVEN LOVE"));
    // "&" is read as the word it stands for: "Am & Pm" is "Am and Pm", never a different title.
    expect(titleKey("Am & Pm")).toBe(titleKey("Am and Pm"));
    const listed = [work({ title: "TWENTY FOUR SEVEN LOVE", iswc: "T1234567890", writers: [{ name: "Ann Lee", share: 100 }] })];
    const r = compareList(listed, [track("a", "24/7 Love", { writers: [{ name: "", legalName: "Ann Lee", role: "Author/Composer", pro: "BMI", ipi: "", percentage: "100" }], iswc: "T1234567890" })], "composition", "BMI");
    expect(r.differences).toHaveLength(0);
    expect(r.matched).toHaveLength(1);
  });

  it("treats a clean and a dirty version as one composition, at BMI", () => {
    const listed = [work({ title: "Am Pm", iswc: "T1234567890", writers: [{ name: "Ann Lee", share: 100 }] })];
    const hero = { writers: [{ name: "", legalName: "Ann Lee", role: "Author/Composer", pro: "BMI", ipi: "", percentage: "100" }], iswc: "T1234567890" };
    const r = compareList(listed, [track("clean", "Am Pm (Clean Version)", hero), track("dirty", "Am Pm (Dirty Version)", hero)], "composition", "BMI");
    // One composition, both versions of it: no second work is invented, and no version is raised as a difference.
    expect(r.extra).toHaveLength(0);
    expect(r.differences.flatMap((d) => d.issues).join(" ")).not.toMatch(/version/i);
    expect(new Set([...r.matched, ...r.differences].map((m) => m.work?.workId ?? "one")).size).toBe(1);
  });

  it("keeps two SoundExchange recordings of one title apart, each with its own code", () => {
    const listed = [
      work({ title: "Am Pm (Clean Version)", isrc: "USCTA2600001", artist: "Karma Came" }),
      work({ title: "Am Pm (Dirty Version)", isrc: "USCTA2600002", artist: "Karma Came" }),
    ];
    const r = compareList(listed, [
      track("clean", "Am Pm (Clean Version)", { isrc: "USCTA2600001", version: "Clean Version" }),
      track("dirty", "Am Pm (Dirty Version)", { isrc: "USCTA2600002", version: "Dirty Version" }),
    ], "recording", "SoundExchange");
    expect(r.extra).toHaveLength(0);
    const rows = buildDifferenceRows({
      tracks: [track("clean", "Am Pm (Clean Version)", { isrc: "USCTA2600001", version: "Clean Version" }), track("dirty", "Am Pm (Dirty Version)", { isrc: "USCTA2600002", version: "Dirty Version" })],
      societies: [{ id: "soundexchange", name: "SoundExchange" }],
      stored: ({ byId: { soundexchange: { file: "sx.csv", reader: STORED_READER, result: r } } }) as unknown as StoredLists,
    });
    // Neither recording takes the other's code: every card keeps the song it is about.
    for (const row of rows) expect(row.catalogIsrc).toBe(row.songId === "clean" ? "USCTA2600001" : "USCTA2600002");
  });

  it("draws no card for a Royalty Inspector song, whose id is not in My Catalog", () => {
    const rows = buildDifferenceRows({
      tracks: [track("h:09bef0e2-1f7a-4a55-9a5e-64f8a0d1b2c3", "Bloodline")],
      societies: BMI,
      stored: stored("bmi", [{ trackId: "h:09bef0e2-1f7a-4a55-9a5e-64f8a0d1b2c3", title: "Bloodline", work: work({ title: "Bloodline" }), issues: ["The agency has ISWC T1234567890, your catalog has none"] }]),
    });
    expect(rows).toEqual([]);
  });
});
