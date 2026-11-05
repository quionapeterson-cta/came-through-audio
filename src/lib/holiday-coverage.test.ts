import { describe, expect, it } from "vitest";
import { canSeeHolidayPlan, COVERAGE_SECTIONS, HOLIDAY_BREAKS, HOLIDAY_PAY_STATUS } from "./holiday-coverage";
import type { StaffAccess } from "./departments";

const access = (role: StaffAccess["role"], departments: StaffAccess["departments"] = ["support"]): StaffAccess =>
  ({ role, departments, canManageStaff: role === "super_admin" });

describe("holiday coverage plan", () => {
  it("is for super admins and department leads only", () => {
    expect(canSeeHolidayPlan(access("super_admin"))).toBe(true);
    expect(canSeeHolidayPlan(access("department_lead"))).toBe(true);
    expect(canSeeHolidayPlan(access("employee"))).toBe(false);
    expect(canSeeHolidayPlan(access("hr_admin", ["hr"]))).toBe(false);
    expect(canSeeHolidayPlan(null)).toBe(false);
  });

  it("carries no pay rate, because none is approved", () => {
    expect(HOLIDAY_PAY_STATUS).toBe("undecided");
    expect(JSON.stringify(COVERAGE_SECTIONS)).not.toMatch(/\$\s?\d/);
    expect(JSON.stringify(COVERAGE_SECTIONS)).toMatch(/undecided/i);
  });

  it("names the three breaks without inventing dates", () => {
    expect([...HOLIDAY_BREAKS]).toEqual(["Christmas and New Year", "Thanksgiving", "Spring break"]);
    expect(JSON.stringify(HOLIDAY_BREAKS)).not.toMatch(/\d{4}/);
  });

  it("keeps overtime and holiday work on a need basis", () => {
    const text = JSON.stringify(COVERAGE_SECTIONS);
    expect(text).toMatch(/need basis/i);
    expect(text).toMatch(/overtime/i);
    expect(text).toMatch(/extra earnings/i);
  });

  it("every section has a heading and at least one point", () => {
    for (const s of COVERAGE_SECTIONS) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.points.length).toBeGreaterThan(0);
    }
  });
});
