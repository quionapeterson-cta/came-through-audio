import { describe, expect, it } from "vitest";
import { creditCheck, masterCheck, masterLine, nameKey, renegotiationDue, sameName, sameWork, type WorkCopy } from "@/lib/process-check";
import { emptyContributor, emptyMetadata } from "@/lib/metadata";

const writer = (legalName: string, extra: Partial<ReturnType<typeof emptyContributor>> = {}) => ({ ...emptyContributor(), legalName, role: "Composer" as const, percentage: "100", ...extra });
const song = (extra: Partial<ReturnType<typeof emptyMetadata>> = {}) => ({ ...emptyMetadata(), title: "Gold Teeth", iswc: "T1234567890", writers: [writer("Ann Lee", { ipi: "00123456789" })], ...extra });
const agency = (extra: Partial<WorkCopy> = {}): WorkCopy => ({ name: "The MLC", at: "2026-11-09", verified: true, result: "found", title: "Gold Teeth", iswc: "T1234567890", writers: [{ legalName: "Ann Lee", ipi: "00123456789", share: "100" }], ...extra });
const release = (extra: Partial<WorkCopy> = {}): WorkCopy => ({ name: "the release", at: "2026-11-09", verified: false, result: "found", title: "Gold Teeth", writers: [{ legalName: "Ann Lee" }], ...extra });

describe("names are compared, never corrected", () => {
  it("ignores case, punctuation, accents, suffixes and word order", () => {
    expect(nameKey("SMITH, John Jr.")).toBe(nameKey("John Smith"));
    expect(nameKey("Beyoncé")).toBe(nameKey("beyonce"));
    expect(sameName("Ann Lee", "Lee, Ann")).toBe(true);
    expect(sameName("Ann Lee", "Anne Lee")).toBe(false);
  });
  it("lets a code settle the work, and a title only when a writer agrees", () => {
    expect(sameWork({ title: "Gold Teeth", iswc: "T1", writers: [] }, { title: "Goldteeth (Remix)", iswc: "T1", writers: [] })).toBe(true);
    expect(sameWork({ title: "Gold Teeth", writers: [] }, { title: "Gold Teeth", writers: [] })).toBe(false);
    expect(sameWork({ title: "Gold Teeth", writers: [{ legalName: "Ann Lee" }] }, { title: "Gold Teeth", writers: [{ legalName: "Lee Ann" }] })).toBe(true);
  });
});

describe("the credit check", () => {
  it("waits, without a finding, until there is a release to compare", () => {
    const c = creditCheck(song(), agency(), null);
    expect(c.state).toBe("waiting");
    expect(c.findings).toEqual([]);
    expect(c.next).toContain("release exists");
  });
  it("agrees when the three copies agree", () => {
    const c = creditCheck(song(), agency(), release());
    expect(c.state).toBe("agree");
    expect(c.findings).toEqual([]);
    expect(c.facts.every((f) => f.state === "match")).toBe(true);
  });
  it("names each difference and the catalog field to fix", () => {
    const c = creditCheck(song(), agency({ title: "Gold Teeth (Radio)" }), release({ writers: [{ legalName: "A. Lee" }] }));
    expect(c.state).toBe("difference");
    expect(c.findings.map((f) => f.field)).toContain("title");
    expect(c.findings.map((f) => f.id)).toContain("writer:ann lee:release");
    expect(c.next).toContain("your catalog");
  });
  it("never calls a writer missing when the lookup didn't answer", () => {
    const c = creditCheck(song(), agency({ result: "unknown", writers: [] }), release());
    expect(c.state).toBe("unknown");
    expect(c.findings.some((f) => f.state === "difference" && f.title.includes("isn't on the registration"))).toBe(false);
    expect(c.findings.some((f) => f.state === "unknown")).toBe(true);
  });
  it("calls a writer missing only when a found registration omits them", () => {
    const c = creditCheck(song(), agency({ writers: [] }), release());
    expect(c.findings.some((f) => f.id === "writer:ann lee:missing" && f.state === "difference")).toBe(true);
  });
});

describe("the master checkup", () => {
  const deal = { dealType: "Exclusive" as const, dealDate: "2026-11-09", dealStreams: "50000", dealContract: "c1" };
  it("says no reading yet, never zero streams", () => {
    expect(masterCheck(deal, null).state).toBe("unknown");
    expect(masterLine(deal, null)).toContain("No reading yet");
    expect(renegotiationDue(deal, null)).toBe("waiting");
    expect(masterCheck(deal, null).findings.some((f) => f.title === "The license point has passed")).toBe(false);
  });
  it("compares a reading with the cap the member entered, with no invented thresholds", () => {
    expect(renegotiationDue(deal, { at: "2026-11-09", streams: 49999 })).toBe("not yet");
    expect(renegotiationDue(deal, { at: "2026-11-09", streams: 50000 })).toBe("due");
    expect(renegotiationDue(deal, { at: "2026-11-09", streams: 63200 })).toBe("over");
    expect(masterLine(deal, { at: "2026-11-09", streams: 63200 })).toContain("has passed");
    expect(masterCheck(deal, { at: "2026-11-09", streams: 63200 }).state).toBe("difference");
  });
  it("asks for the deal and the licence before it can measure anything", () => {
    const c = masterCheck({ dealType: "", dealDate: "", dealStreams: "", dealContract: "" }, { at: "2026-11-09", streams: 100 });
    expect(c.findings.map((f) => f.id)).toEqual(["deal", "contract", "cap"]);
    expect(c.state).toBe("difference");
  });
});

describe("creditCheck waiting", () => {
  it("names the copy it is actually waiting for", () => {
    const noAgency = creditCheck(song(), null, release());
    expect(noAgency.state).toBe("waiting");
    expect(noAgency.waitingFor).toBe("registration");
    expect(creditCheck(song(), agency(), null).waitingFor).toBe("release");
    expect(creditCheck(song(), null, null).waitingFor).toBe("release");
  });
});

describe("creditCheck writer names", () => {
  it("treats a reordered name as the same writer instead of a difference nobody can fix", () => {
    const out = creditCheck(song(), agency(), release({ writers: [{ legalName: "Lee Ann" }] }));
    expect(out.findings.filter((f) => f.id.startsWith("writer:"))).toHaveLength(0);
    expect(out.state).toBe("agree");
  });
});
