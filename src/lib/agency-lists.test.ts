import { describe, it, expect } from "vitest";
import { emptyMetadata } from "@/lib/metadata";
import { compareList, listGaps, parseDelimited, readWorks } from "@/lib/agency-lists";

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
