import { describe, it, expect } from "vitest";
import { TREATMENTS, actionFor, buildDifferenceRows, fieldFor, fixesFor, nameFromIssue, signInFor, treatmentForIssue, type StoredLists } from "@/lib/discrepancy-treatments";
import { catalogHref } from "@/lib/catalog-links";
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

  it("tells the member a title with two catalogued codes is two recordings, and offers Add Version", () => {
    // AM PM: both codes are in the catalog and both are on the list, so nothing disagrees — and the pair used to vanish.
    const storedPair = {
      byId: { soundexchange: { file: "sx.csv", result: { differences: [], clashes: [], notListed: [], extra: [], works: 2, matched: [
        { trackId: "a", title: "AM PM", work: work({ title: "AM PM", isrc: "QT6HX2656773" }), issues: [] },
        { trackId: "b", title: "AM PM", work: work({ title: "AM PM", isrc: "QT6HX2656774" }), issues: [] },
      ] } } },
    } as unknown as StoredLists;
    const rows = buildDifferenceRows({
      tracks: [catTrack("a", "AM PM", { isrc: "QT6HX2656773", releaseDate: "2026-01-01" }), catTrack("b", "AM PM", { isrc: "QT6HX2656774", releaseDate: "2026-01-01" })],
      stored: storedPair,
    });
    const pair = rows.find((r) => r.kind === "version-pair")!;
    expect(pair).toBeTruthy();
    expect(pair.treatment.headline).toBe("Name each version of this title");
    expect(pair.treatment.action).toBe("add-version");
    expect(pair.agencyCodes.map((c) => c.isrc)).toEqual(["QT6HX2656773", "QT6HX2656774"]);
    expect(pair.catalogCodes).toHaveLength(2);
    expect(pair.title).toBe("AM PM");
  });

  it("names the two agencies' versions as an audio question, not a metadata mismatch", () => {
    const twoLists = {
      byId: {
        soundexchange: { file: "sx.csv", result: { differences: [], clashes: [], notListed: [], extra: [], works: 1, matched: [
          { trackId: "a", title: "Big Swag", work: work({ title: "Big Swag", version: "Album version", isrc: "QZNMY2291720" }), issues: [] },
        ] } },
        ascap: { file: "ascap.csv", result: { differences: [], clashes: [], notListed: [], extra: [], works: 1, matched: [
          { trackId: "a", title: "Big Swag", work: work({ title: "Big Swag", version: "Instrumental", isrc: "QZNMY2291720" }), issues: [] },
        ] } },
      },
    } as unknown as StoredLists;
    const rows = buildDifferenceRows({ tracks: [catTrack("a", "Big Swag", { isrc: "QZNMY2291720", releaseDate: "2026-01-01" })], stored: twoLists });
    const row = rows.find((r) => r.kind === "agency-version-conflict")!;
    expect(row).toBeTruthy();
    expect(row.treatment.headline).toContain("distributor");
    expect(row.claims.map((c) => c.version)).toEqual(["Album version", "Instrumental"]);
    expect(row.issues.join(" ")).toContain("Instrumental");
  });

  it("sends every fix to the field that actually disagrees, in one place", () => {
    const base = { builds: 0 } as const;
    void base;
    const version = buildDifferenceRows({
      tracks: [catTrack("a", "Quit Playing With Me", { isrc: "QT6HW2687935", version: "Radio edit", releaseDate: "2026-01-01" })],
      stored: stored([{ trackId: "a", title: "Quit Playing With Me",
        work: work({ title: "Quit Playing With Me", version: "Clean Version", isrc: "QT6HW2687935" }),
        issues: ['The agency has version "Clean Version", your catalog has "Radio edit" — same title, two versions of the recording'] }]),
    })[0]!;
    expect(fieldFor(version)).toBe("version");
    expect(actionFor(version)).toBe("add-version");
    expect(catalogHref({ trackId: "a", field: fieldFor(version), action: actionFor(version), agencyVersion: "Clean Version" }))
      .toBe("/workspace?tab=catalog&songId=a&focusField=version&agencyVersion=Clean+Version&action=add-version#song-a");
    const retired = buildDifferenceRows({
      tracks: [catTrack("a", "Bloodline", { isrc: "GBSMU2963390", releaseDate: "2026-01-01", retiredIscrs: ["GBSMU2963386"] })],
      stored: stored([{ trackId: "a", title: "Bloodline", work: work({ title: "Bloodline", isrc: "GBSMU2963386" }), issues: ["The agency still holds the code of an earlier release"] }]),
    })[0]!;
    expect(fieldFor(retired)).toBe("retired");
    expect(actionFor(retired)).toBe("dual_isrc");
  });

  it("gives a registering card the agency's own sign-in page, never its homepage", () => {
    expect(signInFor("soundexchange")).toEqual({ name: "SoundExchange Direct", signIn: "https://sxdirect.soundexchange.com/login/" });
    expect(signInFor("ascap").signIn).toBe("https://www.ascap.com/member-access#login");
    expect(signInFor("bmi").signIn).toBe("https://ols.bmi.com/");
    expect(signInFor("mlc").signIn).toBe("https://portal.themlc.com/login");
    // An agency with no checked page falls back to its own site rather than inventing one.
    expect(signInFor("sesac", "https://www.sesac.com").signIn).toBe("https://www.sesac.com");
  });
});
