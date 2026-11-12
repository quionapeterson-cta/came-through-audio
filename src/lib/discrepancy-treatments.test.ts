import { describe, it, expect } from "vitest";
import { TREATMENTS, buildDifferenceRows, fixesFor, nameFromIssue, treatmentForIssue, type StoredLists } from "@/lib/discrepancy-treatments";
import { emptyMetadata, type Metadata } from "@/lib/metadata";

/** Every difference the comparison found is listed with the rule that fixes it, never only the headline one. */
describe("difference treatments", () => {
  it("gives each issue on one recording its own treatment and fix", () => {
    const issues = [
      "The agency has ISRC US-CTA-16-00001, your catalog has US-CTA-26-00111",
      "The agency has ISWC T-123.456.789-0, your catalog has none",
      "Ann Lee isn't on the agency's registration",
      "Ann Lee's share is 60% there, 50% here",
    ];
    const fixes = fixesFor(issues, { catalogIsrc: "US-CTA-26-00111", agencyIsrc: "US-CTA-16-00001" });
    expect(fixes.map((f) => f.treatment)).toEqual([
      TREATMENTS.checkDistributor, TREATMENTS.iswc, TREATMENTS.writerAtAgency, TREATMENTS.share,
    ]);
    expect(fixes[2]!.text).toContain("Ann Lee");
    expect(fixes[2]!.headline).toContain("Ann Lee");
    expect(fixes.every((f) => !f.headline.includes("{") && !f.text.includes("{"))).toBe(true);
    expect(fixes.every((f) => f.code === "US-CTA-16-00001")).toBe(true);
  });

  it("names the writer an issue is about, so the fix says who to change", () => {
    expect(nameFromIssue("Kim Roe's IPI is 00123456789 there, 00123456780 here")).toBe("Kim Roe");
    expect(nameFromIssue("The agency lists Sam Poe, who isn't in your catalog")).toBe("Sam Poe");
    expect(nameFromIssue("The agency has ISRC US-CTA-16-00001, your catalog has none")).toBe("");
  });

  it("lists a repeated difference once", () => {
    expect(fixesFor(["Not on the BMI list", "Not on the BMI list"], { catalogIsrc: "", agencyIsrc: "" })).toHaveLength(1);
  });

  it("treats a song the agency does not list as a submission", () => {
    expect(treatmentForIssue("Not on the SoundExchange list", { catalogIsrc: "US-CTA-26-00001", agencyIsrc: "" })).toBe(TREATMENTS.submit);
  });

  it("offers the agency's code when the catalog has none", () => {
    expect(treatmentForIssue("The agency has ISRC US-CTA-16-00001, your catalog has none", { catalogIsrc: "", agencyIsrc: "US-CTA-16-00001" })).toBe(TREATMENTS.adoptAgency);
  });
});

/** The cards the panel reads, built from a saved comparison exactly as an upload leaves it. */
describe("difference rows", () => {
  const catTrack = (id: string, title: string, extra: Partial<Metadata> = {}) => ({
    id, title, artist: "Karma Came", updatedAt: "",
    metadata: { ...emptyMetadata(), title, artist: "Karma Came", writers: [], composers: [], publishers: [], ...extra },
  });
  const work = (extra: Record<string, unknown>) => ({ title: "", iswc: "", isrc: "", workId: "", writers: [], ...extra });
  const stored = (differences: unknown[]): StoredLists => ({
    byId: { soundexchange: { file: "sx.csv", result: { matched: [], clashes: [], notListed: [], extra: [], works: differences.length, differences } } },
  }) as unknown as StoredLists;

  it("reads two codes under one title as another version to add, not a metadata mismatch", () => {
    const rows = buildDifferenceRows({
      tracks: [catTrack("a", "Big Swag", { isrc: "QZNMY2291720", releaseDate: "2026-01-01" })],
      stored: stored([{ trackId: "a", title: "Big Swag", work: work({ title: "Big Swag", isrc: "QZNMY2291727" }),
        issues: ['The agency holds a second ISRC for "Big Swag": QZNMY2291727, beside QZNMY2291720 — one title, 2 codes'] }]),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe("same-title-different-isrc");
    expect(rows[0]!.treatment.headline).toBe("Add the version");
    expect(rows[0]!.versions).toEqual({ catalog: "", agency: "" });
  });

  it("shows each side's version and artist, and treats a version difference as one", () => {
    const storedRow = stored([{
      trackId: "a", title: "Quit Playing With Me",
      work: work({ title: "Quit Playing With Me (Clean Version)", coreTitle: "Quit Playing With Me", version: "Clean Version", artist: "Karma Came", isrc: "QT6HW2687935" }),
      issues: ['The agency has version "Clean Version", your catalog has "Radio edit" — same title, two versions of the recording'],
    }]);
    const released = buildDifferenceRows({
      tracks: [catTrack("a", "Quit Playing With Me", { isrc: "QT6HW2687935", version: "Radio edit", releaseDate: "2026-01-01" })],
      stored: storedRow,
    });
    expect(released[0]!.kind).toBe("version-difference");
    expect(released[0]!.versions).toEqual({ catalog: "Radio edit", agency: "Clean Version" });
    expect(released[0]!.artists).toEqual({ catalog: "Karma Came", agency: "Karma Came" });
    expect(released[0]!.treatment.headline).toBe("Add the version");
    // The same version difference on a release that is not out yet waits for release day.
    const waiting = buildDifferenceRows({ tracks: [catTrack("a", "Quit Playing With Me", { isrc: "QT6HW2687935", version: "Radio edit" })], stored: storedRow });
    expect(waiting[0]!.treatment.headline).toBe("Waiting for the release");
  });

  it("never renders a card whose sides read the same recording", () => {
    // A comparison saved before the name rule was fixed still carries its old issue; the card has nothing left to say.
    const rows = buildDifferenceRows({
      tracks: [catTrack("a", "AM PM", { isrc: "QT6HX2656773", releaseDate: "2026-01-01" })],
      stored: stored([{ trackId: "a", title: "AM PM", work: work({ title: "AM PM", isrc: "QT6HX2656773" }),
        issues: ['The agency calls it "AM PM", your catalog has "AM PM" — same recording, different name'] }]),
    });
    expect(rows).toHaveLength(0);
  });
});
