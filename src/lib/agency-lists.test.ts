import { describe, it, expect } from "vitest";
import { emptyMetadata } from "@/lib/metadata";
import { compareList, listGaps, matchWork, parseDelimited, readWorks, sameWriter, scaledShares, spelledDifferently, titleCore } from "@/lib/agency-lists";

const track = (id: string, title: string, extra = {}) => ({ id, title, artist: "Q", updatedAt: "", metadata: { ...emptyMetadata(), title, artist: "Q", composers: [],
  writers: [{ name: "", legalName: "Ann Lee", role: "Author/Composer", pro: "ASCAP", ipi: "00123456789", percentage: "50" }, { name: "", legalName: "Bo Ray", role: "Composer", pro: "BMI", ipi: "", percentage: "50" }],
  publishers: [], ...extra } });

describe("agency lists", () => {
  it("reads quoted CSV, finds the heading row and groups one-row-per-writer lists into works", () => {
    const csv = 'My ASCAP works,,,\n\nWork Title,ISWC,Writer Name,IPI,Share %\n"Midnight, Pt. 2",T-123.456.789-0,"LEE ANN",123456789,50\n,,RAY BO,,50\nGold Teeth,,LEE ANN,123456789,100\n';
    const works = readWorks(parseDelimited(csv));
    expect(works).toHaveLength(2);
    expect(works[0]).toMatchObject({ title: "Midnight, Pt. 2", iswc: "T1234567890", writers: [{ name: "LEE ANN", share: 50, ipi: "123456789" }, { name: "RAY BO", share: 50 }] });
  });

  it("matches by ISRC first, then title, and reports differences in writers, IPIs and shares on any scale", () => {
    const works = readWorks(parseDelimited("Title,ISWC,Writer,IPI,Share\nMidnight Pt 2,T1234567890,Lee Ann,123456789,100\nMidnight Pt 2,T1234567890,Ray Bo,,100\nRun It Back,,Lee Ann,999999999,100\nUnknown Song,,Lee Ann,,100"));
    const r = compareList(works, [
      track("a", "Midnight (Pt. 2)", { iswc: "T-123.456.789-0" }),
      track("b", "Run It Back (feat. Zed)"),
      track("c", "Never Registered"),
    ]);
    expect(r.matched.map((m) => m.trackId)).toEqual(["a"]);
    expect(r.differences[0]).toMatchObject({ trackId: "b" });
    expect(r.differences[0]!.issues).toEqual(expect.arrayContaining(["Bo Ray isn't on the agency's registration", "Ann Lee's IPI is 999999999 there, 123456789 here", "Ann Lee's share is 100% there, 50% here"]));
    expect(r.notListed).toEqual([{ trackId: "c", title: "Never Registered" }]);
    expect(r.extra.map((w) => w.title)).toEqual(["Unknown Song"]);
  });

  it("matches by ISRC before ISWC or title, because that is what the agencies match recordings by", () => {
    const works = readWorks(parseDelimited("Title,ISWC,ISRC,Writer,Share\nDifferent Title,T9999999999,USCTA2600001,Ann Lee,100\nMidnight,T1234567890,USCTA2699999,Ann Lee,100"));
    const r = compareList(works, [track("a", "Midnight", { iswc: "T1234567890", isrc: "US-CTA-26-00001" })]);
    const found = [...r.matched, ...r.differences];
    expect(found).toHaveLength(1);
    expect(found[0]!.work?.title).toBe("Different Title");
  });

  it("matches by ISWC before the title, because the ISWC names the composition exactly", () => {
    const works = readWorks(parseDelimited("Title,ISWC,ISRC,Writer,Share\nOther Recording,T1234567890,USCTA2600777,Ann Lee,100\nMidnight,T9999999999,USCTA2600888,Ann Lee,100"));
    const r = compareList(works, [track("a", "Midnight", { iswc: "T1234567890" })]);
    const found = [...r.matched, ...r.differences];
    expect(found).toHaveLength(1);
    expect(found[0]!.work?.title).toBe("Other Recording");
  });

  it("breaks a shared title with the writer names, so a re-record isn't confused with the work", () => {
    const works = readWorks(parseDelimited("Title,ISWC,Writer,Share\nMidnight,T1111111111,Someone Else,100\nMidnight,T2222222222,Lee Ann,100"));
    const r = compareList(works, [track("a", "Midnight")]);
    const found = [...r.matched, ...r.differences];
    expect(found).toHaveLength(1);
    expect(found[0]!.work?.iswc).toBe("T2222222222");
  });

  it("ignores a version the catalog names and the agency never registers", () => {
    // The founder's own titles, against a BMI list that registers the plain work (2026-11-12).
    const works = readWorks(parseDelimited("Title,Writer,Share\nQuit Playing With Me,Lee Ann,100\nBloodline,Lee Ann,100"));
    const r = compareList(works, [
      track("dirty", "Quit Playing With Me - Dirty Version"),
      track("inst", "Quit Playing With Me - Official Instrumental"),
      track("clean", "Bloodline (Clean Version)"),
    ]);
    // Every version is the same work on their list, so it is a difference to settle — never a new song to add.
    expect(r.notListed).toEqual([]);
    expect(r.extra).toEqual([]);
    expect([...r.matched, ...r.differences].map((m) => m.trackId).sort()).toEqual(["clean", "dirty", "inst"]);
  });

  it("recognises an agency still reporting under a retired code, and says what to send them", () => {
    const works = readWorks(parseDelimited("Title,ISRC,Writer,Share\nDo You Mind That,QZNMY2291725,Ann Lee,100"));
    // The founder's real case: the catalog holds the live code, SoundExchange still states the retired one.
    const t = track("a", "Do you Mind That?", { isrc: "GXESV2623521", retiredIscrs: ["QZNMY2291725"] });
    expect(matchWork(works, t)).toBe(works[0]);
    const r = compareList(works, [t], true, "SoundExchange");
    expect(r.matched).toHaveLength(0);
    const issues = r.differences[0]!.issues;
    expect(issues[0]).toContain("The agency only has the retired ISRC QZNMY2291725");
    // The live code is added next to the old one — never swapped in — because money filed under the old one can still
    // surface, and the member gets it done in their own account or through CTA, never by asking an agency politely
    // (founder, 2026-11-12).
    expect(issues[0]).toContain("Add the recording under its current ISRC GXESV2623521 as an entry of its own and leave the old one open");
    expect(issues[0]).toContain("CTA's Expert Registration Assistance");
    expect(issues[0]).not.toContain("ask them");
    // Paired, and settled: it is not an uncatalogued recording as well.
    expect(r.extra).toHaveLength(0);
  });

  it("is content when the agency keeps both codes, which is the state to aim for", () => {
    const both = readWorks(parseDelimited("Title,ISRC,Writer,Share\nDo you Mind That,QZNMY2291725,Ann Lee,100\nDo you Mind That,GXESV2623521,Ann Lee,100"));
    const t = track("a", "Do you Mind That?", { isrc: "GXESV2623521", retiredIscrs: ["QZNMY2291725"] });
    const r = compareList(both, [t], true, "SoundExchange");
    expect(r.matched).toHaveLength(1);
    expect(r.differences).toHaveLength(0);
    // The old code's row belongs to the same recording: nothing to chase, nothing "not in your catalog".
    expect(r.extra).toHaveLength(0);
  });

  it("only drops a short version tail, never part of the title itself", () => {
    // A bracket that doesn't name a version is kept, so the looser pass can't swallow a real title.
    expect(titleCore("Song (Part 2)")).not.toBe(titleCore("Song"));
    expect(titleCore("Live and Learn")).toBe(titleCore("Live and Learn"));
    expect(titleCore("Song: Radio Edit")).toBe(titleCore("Song"));
    expect(titleCore("Song - Sped Up")).toBe(titleCore("Song"));
    expect(titleCore("Live and Learn")).toBe(titleCore("Live and Learn"));
  });

  it("reads the list's own gaps without needing a catalog", () => {
    const [w] = readWorks(parseDelimited("Title,Writer,Share\nMidnight,Ann Lee,80"));
    expect(listGaps(w!)).toEqual([
      "No ISRC — The MLC and SoundExchange match a recording by it",
      "No ISWC — your PRO registers the composition by it",
      "A writer with no IPI number",
      "The shares don't add up to 100%",
    ]);
    expect(listGaps({ ...w!, isrc: "USCTA2600001", iswc: "T1234567890", writers: [{ name: "Ann Lee", share: 100, ipi: "123456789" }] })).toEqual([]);
    // A SoundExchange list is recordings: the ISRC is the only thing it is matched by.
    expect(listGaps(w!, true)).toEqual(["No ISRC — SoundExchange matches a recording by it"]);
  });

  it("compares recording lists by presence only", () => {
    const works = readWorks(parseDelimited("ISRC,Track Title,Artist\nUSCTA2600001,Midnight,Q"));
    const r = compareList(works, [track("a", "Midnight", { isrc: "US-CTA-26-00001" })], true);
    expect(r.matched).toHaveLength(1);
  });

  it("explains when it can't find the columns", () => {
    expect(() => readWorks([["a", "b"], ["1", "2"]])).toThrow(/title or ISRC column/);
  });
});

import { bmiPdfRows as _bmiPdfRows, readWorks as _readWorks } from "./agency-lists";
describe("BMI Catalog Detail PDF", () => {
  it("reads each work with its writers, skipping the publisher", () => {
    const items = ["10K", "07/01/2025", "T3335071513", "74058036", "Participant Name", "Work Name:", "PETERSON QUI ONA LASHAY", "W", "100.00%", "BMI", "00658645500", "STEPHENS CALVIN ANDRE", "W", "100.00%", "BMI", "00549852210", "MANUSCRIPT", "P", "0.00%", "NA", "00686021835",
      "BEAUTY KING", "06/06/2017", "24494803", "Participant Name", "PARIS JOSHUA", "W", "33.00%", "NA", "PETERSON QUI ONA LASHAY", "W", "167.00%", "BMI", "00658645500"];
    const works = _readWorks(_bmiPdfRows(items));
    expect(works).toHaveLength(2);
    expect(works[0]).toMatchObject({ title: "10K", workId: "74058036", iswc: "T3335071513" });
    expect(works[0]!.writers.map((w) => w.name)).toEqual(["PETERSON QUI ONA LASHAY", "STEPHENS CALVIN ANDRE"]);
    expect(works[1]!.writers[0]).toMatchObject({ name: "PARIS JOSHUA", share: 33, ipi: undefined });
  });
});

describe("BMI's 200% column and its spelling of a name", () => {
  it("reads the writer's half and the publisher's half on the composition's 100% scale", () => {
    const [w] = readWorks(parseDelimited("Title,Writer,Share\nBig Booty Bouncing,PETERSON QUI ONA LASHAY,200"));
    expect(scaledShares(w!.writers)).toEqual([100]);
    // Two writers BMI prints at 100% each are 50/50 of the composition, which is what the catalog holds.
    expect(scaledShares([{ name: "A", share: 100 }, { name: "B", share: 100 }])).toEqual([50, 50]);
  });

  it("sees one writer behind an agency's middle name, title and word order", () => {
    expect(sameWriter("PETERSON QUI ONA LASHAY", "Qui-Ona Peterson")).toBe(true);
    expect(sameWriter("STEPHENS CALVIN ANDRE JR (MR)", "Calvin Andre Stephens Jr")).toBe(true);
    expect(sameWriter("LEE ANN", "Ann Lee")).toBe(true);
    expect(sameWriter("Ann Lee", "Bo Ray")).toBe(false);
    expect(sameWriter("Lee", "Ann Lee")).toBe(false);
  });

  it("says the share is right and the spelling is the only thing to fix when BMI prints 200%", () => {
    const [w] = readWorks(parseDelimited("Title,Writer,Share\nBig Booty Bouncing feat. OG PI,PETERSON QUI ONA LASHAY,200"));
    const me = { ...emptyMetadata(), title: "Big Booty Bouncing", artist: "Q", iswc: "", isrc: "",
      writers: [{ name: "", legalName: "Qui-Ona Peterson", role: "Author/Composer" as const, pro: "BMI", ipi: "", percentage: "100" }], composers: [] };
    const r = compareList([w!], [{ id: "a", title: me.title, artist: "Q", updatedAt: "", metadata: me }]);
    expect(r.differences).toHaveLength(1);
    // The person and the share both match; only the spelling needs bringing up to the agency's.
    expect(r.differences[0]!.issues).toEqual(["The agency has PETERSON QUI ONA LASHAY where your catalog has Qui-Ona Peterson — same writer, fix the spelling so both records match"]);
  });

  it("flags a real spelling difference, so the catalog can be brought up to the registration", () => {
    const [w] = readWorks(parseDelimited("Title,Writer,Share\nBloodline,STEPHENS CALVIN ANDRE JR (MR),100"));
    const me = { ...emptyMetadata(), title: "Bloodline", artist: "Q", iswc: "", isrc: "",
      writers: [{ name: "", legalName: "Calvin Stephens", role: "Author/Composer" as const, pro: "BMI", ipi: "", percentage: "100" }], composers: [] };
    const r = compareList([w!], [{ id: "a", title: "Bloodline", artist: "Q", updatedAt: "", metadata: me }]);
    expect(r.differences[0]!.issues).toEqual(["The agency has STEPHENS CALVIN ANDRE JR (MR) where your catalog has Calvin Stephens — same writer, fix the spelling so both records match"]);
    // Word order and the "MR" title on their own are not a difference; a missing middle name and suffix are.
    expect(spelledDifferently("STEPHENS CALVIN ANDRE JR (MR)", "Calvin Andre Stephens Jr")).toBe(false);
  });
});

import { describe as societyDescribe, expect as societyExpect, it as societyIt } from "vitest";
import { listGaps as gapsFor } from "@/lib/agency-lists";

societyDescribe("what a society's own list leaves out", () => {
  const work = { title: "Bloom", iswc: "T1234567890", isrc: "", workId: "1", writers: [{ name: "Ann Lee", share: 100, ipi: "123456789" }] };
  societyIt("never calls a BMI or ASCAP work missing an ISRC, because a PRO registers the composition", () => {
    societyExpect(gapsFor(work, false, "bmi")).toEqual([]);
    societyExpect(gapsFor(work, false, "ascap")).toEqual([]);
    societyExpect(gapsFor(work, false, "sesac")).toEqual([]);
    societyExpect(gapsFor(work, false, "gmr")).toEqual([]);
  });
  societyIt("still names it for The MLC, which matches recordings by ISRC", () => {
    societyExpect(gapsFor(work, false, "mlc")).toEqual(["No ISRC — The MLC and SoundExchange match a recording by it"]);
  });
  societyIt("keeps the old wording when the society isn't known", () => {
    societyExpect(gapsFor(work)).toEqual(["No ISRC — The MLC and SoundExchange match a recording by it"]);
  });
});

import { describe as halfDescribe, expect as halfExpect, it as halfIt } from "vitest";
import { bmiPdfRows as pdfRows, matchWork as match, readWorks as readList } from "@/lib/agency-lists";
import { emptyContributor as writerRow } from "@/lib/metadata";

halfDescribe("both halves of a BMI list", () => {
  const items = ["Bloom", "Jan 2, 2026", "T1234567890", "123456789", "Participant Name", "LEE ANN", "W", "50%", "ASCAP", "123456789", "LEE SONGS", "P", "50%", "ASCAP", "987654321", "Participant Name"];
  halfIt("keeps the publisher row instead of dropping it", () => {
    const rows = pdfRows(items);
    halfExpect(rows.some((r) => r[4] === "Publisher")).toBe(true);
    const [work] = readList(rows);
    halfExpect(work!.writers.map((w) => w.name)).toEqual(["LEE ANN"]);
    halfExpect(work!.publishers?.map((p) => p.name)).toEqual(["LEE SONGS"]);
  });
  halfIt("names a publisher with no IPI, because the agency matches it by one", () => {
    const rows = pdfRows(["Bloom", "Jan 2, 2026", "T1234567890", "123456789", "Participant Name", "LEE ANN", "W", "50%", "ASCAP", "123456789", "LEE SONGS", "P", "50%", "ASCAP", "", "Participant Name"]);
    const [work] = readList(rows);
    halfExpect(work!.publishers?.[0]?.name).toBe("LEE SONGS");
    halfExpect(gapsFor(work!, false, "bmi")).toContain("A publisher with no IPI number");
  });
});

halfDescribe("a shared title", () => {
  const works = [
    { title: "Bloom", iswc: "", isrc: "", workId: "1", writers: [{ name: "Ann Lee", share: 100 }] },
    { title: "Bloom", iswc: "", isrc: "", workId: "2", writers: [{ name: "Bo Ray", share: 100 }] },
  ];
  const song = (name: string) => ({ title: "Bloom", metadata: { writers: [{ ...writerRow(), name, legalName: name, role: "Author/Composer" }], iswc: "", isrc: "" } });
  halfIt("matches the work whose writers agree", () => {
    halfExpect(match(works, song("Bo Ray"))?.workId).toBe("2");
  });
  halfIt("refuses to guess when no writer agrees, so another writer's registration is never pinned on the song", () => {
    halfExpect(match(works, song("Cal Ray"))).toBeUndefined();
  });
});

import { describe as clashDescribe, expect as clashExpect, it as clashIt } from "vitest";
import { clashIssues as diagnosis, compareList as compare } from "@/lib/agency-lists";

clashDescribe("a title clash", () => {
  const list = [
    { title: "Bloom", iswc: "", isrc: "", workId: "1", writers: [{ name: "Ann Lee", share: 100 }] },
    { title: "Bloom", iswc: "", isrc: "", workId: "2", writers: [{ name: "Bo Ray", share: 100 }] },
  ];
  const track = { id: "t1", title: "Bloom", artist: "Q", updatedAt: "", metadata: { ...emptyMetadata(), iswc: "", isrc: "", writers: [{ ...writerRow(), name: "Cal Ray", legalName: "Cal Ray", role: "Author/Composer" }] } };

  clashIt("is diagnosed instead of being called not on the list", () => {
    const result = compare(list, [track as never], false, "ASCAP");
    clashExpect(result.notListed).toEqual([]);
    clashExpect(result.clashes).toHaveLength(1);
    // The list's own works are accounted for, so the fill dialog never offers to add them as new songs.
    clashExpect(result.extra).toEqual([]);
  });
  clashIt("says what is wrong and what each cause needs", () => {
    const issues = diagnosis(list[0]!, track.metadata, "ASCAP");
    clashExpect(issues[0]).toContain("none of its writers are on your song");
    clashExpect(issues[0]).toContain("Ann Lee");
    clashExpect(issues.join(" ")).toContain("My Catalog");
    clashExpect(issues.join(" ")).toContain("another writer's song");
  });
  clashIt("still reports a title the list does not have at all", () => {
    const result = compare(list, [{ ...track, id: "t2", title: "Amber" } as never], false, "ASCAP");
    clashExpect(result.clashes).toEqual([]);
    clashExpect(result.notListed.map((n) => n.trackId)).toEqual(["t2"]);
  });
});
