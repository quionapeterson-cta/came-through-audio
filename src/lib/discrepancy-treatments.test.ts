import { describe, it, expect } from "vitest";
import { TREATMENTS, actionFor, buildDifferenceRows, fieldFor, fixesFor, nameFromIssue, rereadStored, signInFor, treatmentForIssue, worksFromResult, type StoredLists } from "@/lib/discrepancy-treatments";
import { compareList, parseDelimited, readWorks } from "@/lib/agency-lists";
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

  it("reads a comparison saved by an older reader again, instead of trusting its verdict", () => {
    // Saved on 2026-11-12: no version field, and the same recording listed once per version in the catalog's own title.
    const old = {
      byId: { soundexchange: { file: "sx.csv", result: { matched: [], clashes: [], notListed: [], extra: [], works: 30, differences: [
        { trackId: "a", title: "Therapy (Acapella)", work: { title: "Therapy", iswc: "", isrc: "QT6HM2622200", workId: "", writers: [], artist: "Karma Came" }, issues: ['The agency calls it "Therapy", your catalog has "Therapy (Acapella)" — same recording, different name'] },
      ] } } },
    } as unknown as StoredLists;
    const tracks = [catTrack("a", "Therapy (Acapella)", { isrc: "QT6HM2622200", releaseDate: "2026-01-01" })];
    const fresh = rereadStored(old, tracks)!;
    // Same recording, a version the catalog names and the list does not: nothing to report.
    expect(fresh).not.toBe(old);
    expect(buildDifferenceRows({ tracks, stored: fresh })).toHaveLength(0);
    // A save already made by the current reader is left exactly as it is.
    const marked = { byId: { soundexchange: { ...old.byId["soundexchange"]!, reader: 2 } } } as unknown as StoredLists;
    expect(rereadStored(marked, tracks)).toBe(marked);
  });

  it("keeps the versions a SoundExchange list names when it reads an older save again", () => {
    // The founder's own file: two codes for "Am Pm", one named Clean and one named Dirty, against two catalog entries that
    // name no version at all. An old save dropped the versions, so the pair card read "Not named" on both sides.
    const csv = `Artist,Track Title,ISRC,SXID,Effective %,Hold,Registrant,Payee ID#,Association Type
Karma Came,Am Pm (Clean Version),QT6HX2656773,SX217QGZ03,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Am Pm (Dirty Version),QT6HX2656774,SX217QGZ04,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
`;
    const tracks = [
      catTrack("a", "AM PM", { isrc: "QT6HX2656773", releaseDate: "2026-01-01" }),
      catTrack("b", "AM PM", { isrc: "QT6HX2656774", releaseDate: "2026-01-01" }),
    ];
    const works = readWorks(parseDelimited(csv));
    const today = compareList(works, tracks, true, "SoundExchange");
    // What the old reader saved: the works it kept carry no version and no core title.
    const bare = (w: { title: string; iswc: string; isrc: string; workId: string; writers: unknown[] }) =>
      ({ title: w.title, iswc: w.iswc, isrc: w.isrc, workId: w.workId, writers: w.writers });
    const old = {
      byId: { soundexchange: { file: "sx.csv", result: {
        ...today,
        matched: today.matched.map((m) => ({ ...m, work: bare(m.work!) })),
        differences: today.differences.map((d) => ({ ...d, work: bare(d.work!) })),
        clashes: today.clashes.map((c) => ({ ...c, work: bare(c.work!) })),
        extra: today.extra.map((w) => bare(w)),
      } } },
    } as unknown as StoredLists;
    // The save itself holds no version at all, and the versions come back from the agency's own titles.
    const saved = old.byId["soundexchange"]!.result;
    expect([...saved.matched, ...saved.differences, ...saved.clashes].every((m) => !!m.work && !("version" in m.work))).toBe(true);
    expect(worksFromResult(saved).map((w) => w.version)).toEqual(["Clean Version", "Dirty Version"]);
    const rows = buildDifferenceRows({ tracks, stored: rereadStored(old, tracks)! });
    const pair = rows.find((r) => r.key === "pair:am-pm" || /am pm/i.test(r.title ?? ""));
    expect(pair?.versions?.agency ?? "").toMatch(/Clean Version/);
    expect(pair?.versions?.agency ?? "").toMatch(/Dirty Version/);
  });

  it("pairs two catalog entries when the list names each version and neither code is in the catalog yet", () => {
    // The live shape: the catalog holds "AM PM" twice under distributor codes, the list holds "Am Pm (Clean Version)" and
    // "Am Pm (Dirty Version)" under its own codes, and an older save kept both works unmatched.
    const csv = `Artist,Track Title,ISRC,SXID,Effective %,Hold,Registrant,Payee ID#,Association Type
Karma Came,Am Pm (Clean Version),QT6HX2656773,SX217QGZ03,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Am Pm (Dirty Version),QT6HX2656774,SX217QGZ04,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
`;
    const tracks = [
      catTrack("a", "AM PM", { isrc: "US-CTA-26-00001", releaseDate: "2026-01-01" }),
      catTrack("b", "AM PM", { isrc: "US-CTA-26-00002", releaseDate: "2026-01-01" }),
    ];
    const works = readWorks(parseDelimited(csv));
    const old = { byId: { soundexchange: { file: "sx.csv", result: {
      matched: [], differences: [], clashes: [], notListed: [], works: works.length,
      extra: works.map((w) => ({ title: w.title, iswc: w.iswc, isrc: w.isrc, workId: w.workId, writers: w.writers })),
    } } } } as unknown as StoredLists;
    const rows = buildDifferenceRows({ tracks, stored: rereadStored(old, tracks)! });
    const pair = rows.find((r) => r.kind === "version-pair");
    expect(pair?.versions?.agency).toBe("Clean Version · Dirty Version");
    expect(pair?.claims.map((c) => c.isrc)).toEqual(["QT6HX2656773", "QT6HX2656774"]);
  });

  it("names every version a list holds under one title, and hands all of them to Add Version", () => {
    // The founder's own file: four SoundExchange rows under "Quit Playing With Me", each naming its version.
    const csv = `Artist,Track Title,ISRC,SXID,Effective %,Hold,Registrant,Payee ID#,Association Type
Karma Came,Quit Playing With Me (Clean Version),QT6HW2687935,SX217QGYZU,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Quit Playing With Me (Dirty Version),QT6HW2687937,SX217QGYZX,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Quit Playing With Me (Official Acapella),QT6HW2687938,SX217QGYZV,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Quit Playing With Me (Official Instrumental),QT6HW2687936,SX217QGYZW,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
`;
    const tracks = [catTrack("a", "Quit Playing With Me", { isrc: "QT6HW2687935", releaseDate: "2026-01-01" })];
    const stored = { byId: { soundexchange: { file: "sx.csv", result: compareList(readWorks(parseDelimited(csv)), tracks, true, "SoundExchange") } } } as unknown as StoredLists;
    const rows = buildDifferenceRows({ tracks, stored });
    const row = rows.find((r) => r.songId === "a")!;
    // Every code is its own row on the agency side, with the version that row names.
    expect(row.claims.map((c) => c.version).sort()).toEqual(["Clean Version", "Dirty Version", "Official Acapella", "Official Instrumental"]);
    expect(row.versions.agency).toBe("Clean Version · Dirty Version · Official Acapella · Official Instrumental");
    expect(row.agencyCodes.map((c) => c.version).sort()).toEqual(["Clean Version", "Dirty Version", "Official Acapella", "Official Instrumental"]);
  });

  it("sends every version a list names to the form, not only the first", () => {
    expect(catalogHref({ trackId: "a", field: "version", action: "add-version", agencyVersion: "Clean Version",
      agencyVersions: ["Clean Version", "Dirty Version", "Official Acapella", "Official Instrumental"] }))
      .toBe("/workspace?tab=catalog&songId=a&focusField=version&agencyVersion=Clean+Version&agencyVersions=Clean+Version%7CDirty+Version%7COfficial+Acapella%7COfficial+Instrumental&action=add-version#song-a");
  });
});
