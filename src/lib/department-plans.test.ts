import { describe, expect, it } from "vitest";
import { generatePlan, goalPct, quarters, SCORECARD } from "./department-plans";
import { ASSIGNABLE_DEPARTMENTS } from "./departments";

describe("department plan generator", () => {
  it("has a scorecard for every department staff can be in", () => {
    for (const d of ASSIGNABLE_DEPARTMENTS) { expect(SCORECARD[d].goals).toHaveLength(3); expect(SCORECARD[d].milestones.length).toBeGreaterThan(0); }
  });
  it("lists the next quarters and spreads milestones across the chosen one", () => {
    const q = quarters(new Date("2026-11-15T12:00:00Z"), 2);
    expect(q.map((x) => x.label)).toEqual(["Q4 2026", "Q1 2027"]);
    expect(q[1]).toMatchObject({ start: "2027-01-01", end: "2027-03-31" });
    const p = generatePlan("support", q[1]!, "Support");
    expect(p.title).toBe("Support plan · Q1 2027");
    expect(p.milestones.at(-1)!.due.slice(0, 10)).toBe("2027-03-31");
    for (const m of p.milestones) expect(m.due >= "2027-01-01").toBe(true);
  });
  it("scores goals, including lower-is-better ones", () => {
    expect(goalPct({ name: "Tickets", target: 300, current: 150, unit: "tickets" })).toBe(50);
    expect(goalPct({ name: "Reopened", target: 5, current: 4, unit: "%", lowerIsBetter: true })).toBe(100);
    expect(goalPct({ name: "Reopened", target: 5, current: 10, unit: "%", lowerIsBetter: true })).toBe(50);
  });
});
