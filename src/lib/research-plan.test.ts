import { describe, expect, it } from "vitest";
import { RESEARCH_TITLES, researchTasks } from "./research-plan";
import { ASSIGNABLE_DEPARTMENTS, DEPARTMENT_LABEL } from "./departments";

describe("Market Research team", () => {
  it("is a department staff can be placed in", () => {
    expect(ASSIGNABLE_DEPARTMENTS).toContain("research");
    expect(DEPARTMENT_LABEL.research).toBe("Market Research");
  });
  it("starts with 4 repeating tasks due after today", () => {
    const now = new Date("2026-11-01T12:00:00Z");
    const t = researchTasks(now);
    expect(t.map((x) => x.title)).toEqual([...RESEARCH_TITLES]);
    expect(t.map((x) => x.repeat)).toEqual(["weekly", "monthly", "quarterly", "monthly"]);
    for (const x of t) expect(Date.parse(x.due_at)).toBeGreaterThan(now.getTime());
  });
});
