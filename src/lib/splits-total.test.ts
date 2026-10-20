import { describe, it, expect } from "vitest";
import { capShare, splitStatus, splitSummary } from "@/lib/splits-total";

const rows = (...p: string[]) => p.map((percentage) => ({ percentage }));

describe("split totals", () => {
  it("caps a share at what the others leave", () => {
    expect(capShare(rows("35", "35", ""), 2, "50")).toEqual({ value: "30", cappedAt: 30 });
    expect(capShare(rows("35", "35", ""), 2, "30")).toEqual({ value: "30" });
    expect(capShare(rows("33.33", "33.33", ""), 2, "40")).toEqual({ value: "33.34", cappedAt: 33.34 });
  });
  it("always allows blank and lowering, even when already over 100%", () => {
    expect(capShare(rows("60", "60"), 0, "")).toEqual({ value: "" });
    expect(capShare(rows("60", "60"), 0, "50")).toEqual({ value: "50" });
    expect(capShare(rows("60", "60"), 0, "70")).toEqual({ value: "60", cappedAt: 60 });
    expect(capShare(rows("10"), 0, "-5")).toEqual({ value: "0" });
  });
  it("summarizes the total", () => {
    expect(splitStatus(rows("", "")).state).toBe("empty");
    expect(splitSummary(rows("50", "35"))).toBe("Total: 85% · 15% left");
    expect(splitSummary(rows("50", "50"))).toBe("Total: 100%");
    expect(splitSummary(rows("60", "50"))).toBe("Total: 110%, 10% over. Lower a share to fix it.");
  });
});
