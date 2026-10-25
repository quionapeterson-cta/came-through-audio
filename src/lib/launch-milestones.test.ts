import { describe, expect, it } from "vitest";
import { LAUNCH_MILESTONES } from "./launch-milestones";
import { ASSIGNABLE_DEPARTMENTS, DEPARTMENTS } from "./departments";

describe("pre-launch milestones", () => {
  it("have unique titles (loading skips titles already there) and valid deadlines", () => {
    expect(new Set(LAUNCH_MILESTONES.map((m) => m.title)).size).toBe(LAUNCH_MILESTONES.length);
    for (const m of LAUNCH_MILESTONES) { expect(m.title.length).toBeLessThanOrEqual(200); if (m.due) expect(Number.isNaN(Date.parse(m.due))).toBe(false); }
  });
  it("live in a department staff are never placed in", () => {
    expect(DEPARTMENTS).toContain("launch");
    expect(ASSIGNABLE_DEPARTMENTS).not.toContain("launch");
  });
});
