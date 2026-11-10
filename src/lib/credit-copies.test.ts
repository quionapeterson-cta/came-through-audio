import { describe, expect, it } from "vitest";
import { CREDIT_KEYS, parseWriters, readCopies, withCopy, writersText } from "@/lib/credit-copies";
import { emptyStatus } from "@/lib/health-songs";

describe("the credit check's copies", () => {
  it("reads one writer per line, with an optional IPI and share", () => {
    expect(parseWriters("Ann Lee | 00123456789 | 50\nLee Ann\n\n")).toEqual([
      { legalName: "Ann Lee", ipi: "00123456789", share: "50" },
      { legalName: "Lee Ann" },
    ]);
    expect(writersText([{ legalName: "Ann Lee", ipi: "1", share: "50" }, { legalName: "Lee Ann" }])).toBe("Ann Lee | 1 | 50\nLee Ann");
  });
  it("survives a copy that was saved badly, without inventing one", () => {
    const copies = readCopies({ [CREDIT_KEYS.agency]: "{not json", [CREDIT_KEYS.release]: JSON.stringify({ title: "Gold Teeth", at: "2026-11-09", writers: [] }) });
    expect(copies.agency).toBeUndefined();
    expect(copies.release?.title).toBe("Gold Teeth");
    expect(copies.reading).toBeUndefined();
  });
  it("keeps the other steps when a copy is saved or removed", () => {
    const base = { ...emptyStatus("t1"), steps: { "release:split": "x" } };
    const saved = withCopy(base, "release", { name: "the release", at: "2026-11-09", verified: false, result: "found", title: "Gold Teeth", writers: [] });
    expect(saved.steps["release:split"]).toBe("x");
    expect(readCopies(saved.steps).release?.title).toBe("Gold Teeth");
    expect(withCopy(saved, "release", null).steps[CREDIT_KEYS.release]).toBeUndefined();
  });
});
