import { describe, expect, it } from "vitest";
import { DEPARTMENTS, normalizeDepartments, resolveAccess, staffChangeError, visibleTabs } from "./departments";

describe("resolveAccess", () => {
  it("returns null for non-staff", () => {
    expect(resolveAccess([])).toBeNull();
    expect(resolveAccess([{ role: "user", departments: [] }])).toBeNull();
  });

  it("gives super admins every department and staff management", () => {
    expect(resolveAccess([{ role: "super_admin", departments: [] }])).toEqual({ role: "super_admin", departments: [...DEPARTMENTS], canManageStaff: true, allTeams: true });
  });

  it("limits employees to their departments", () => {
    const a = resolveAccess([{ role: "employee", departments: ["branding", "registration", "royalty_accounts"] }])!;
    expect(a.departments).toEqual(["registration", "royalty_accounts", "branding"]);
    expect(a.canManageStaff).toBe(false);
  });

  it("gives HR admins only HR, even if other departments are stored", () => {
    expect(resolveAccess([{ role: "hr_admin", departments: ["finance"] }])).toEqual({ role: "hr_admin", departments: ["hr"], canManageStaff: true });
  });

  it("ignores unknown department values", () => {
    expect(resolveAccess([{ role: "department_lead", departments: ["finance", "nope"] }])!.departments).toEqual(["finance"]);
  });
});

describe("visibleTabs", () => {
  it("shows employees only their department tabs", () => {
    const branding = resolveAccess([{ role: "employee", departments: ["registration", "royalty_accounts", "branding"] }])!;
    expect(visibleTabs(branding).map((t) => t.value)).toEqual(["queue", "reg", "splits", "badges", "homepage", "tasks", "calendar", "handbook", "recognition"]);
    const billing = resolveAccess([{ role: "employee", departments: ["finance", "support", "marketing_sales"] }])!;
    expect(visibleTabs(billing).map((t) => t.value)).toEqual(["queue", "purchases", "support", "badges", "tasks", "calendar", "handbook", "recognition"]);
  });

  it("gives the AI department the AI Protection tab; Software and Security start with their Task Bank", () => {
    expect(visibleTabs(resolveAccess([{ role: "employee", departments: ["ai"] }])!).map((t) => t.value)).toEqual(["queue", "ai", "tasks", "calendar", "handbook", "recognition"]);
    expect(visibleTabs(resolveAccess([{ role: "employee", departments: ["software", "security"] }])!).map((t) => t.value)).toEqual(["queue", "tasks", "calendar", "handbook", "recognition"]);
  });

  it("never shows finance to HR admins", () => {
    expect(visibleTabs(resolveAccess([{ role: "hr_admin" }])!).map((t) => t.value)).toEqual(["queue", "tasks", "calendar", "handbook", "recognition"]);
  });

  it("gives marketing the Badges and Homepage tabs and its Task Bank; sales gets its Task Bank", () => {
    const marketing = resolveAccess([{ role: "employee", departments: ["marketing"] }])!;
    expect(visibleTabs(marketing).map((t) => t.value)).toEqual(["queue", "badges", "homepage", "tasks", "calendar", "handbook", "recognition"]);
    expect(visibleTabs(resolveAccess([{ role: "employee", departments: ["marketing_sales"] }])!).map((t) => t.value)).toEqual(["queue", "tasks", "calendar", "handbook", "recognition"]);
    expect(visibleTabs(resolveAccess([{ role: "employee", departments: [] }])!)).toEqual([]);
  });

  it("narrows the super admin view with the switcher", () => {
    const sa = resolveAccess([{ role: "super_admin" }])!;
    expect(visibleTabs(sa).map((t) => t.value).slice(-6)).toEqual(["tasks", "calendar", "handbook", "recognition", "company", "plans"]);
    expect(visibleTabs(sa)[0]?.value).toBe("queue");
    expect(visibleTabs(sa, "finance").map((t) => t.value)).toEqual(["queue", "purchases", "tasks", "calendar", "handbook", "recognition"]);
    expect(visibleTabs(sa, "support").map((t) => t.value)).toEqual(["queue", "support", "badges", "tasks", "calendar", "handbook", "recognition"]);
  });
});

describe("normalizeDepartments", () => {
  it("forces HR admins to HR and drops unknown values", () => {
    expect(normalizeDepartments("hr_admin", ["finance"])).toEqual(["hr"]);
    expect(normalizeDepartments("employee", ["support", "bogus", "finance"])).toEqual(["finance", "support"]);
  });
});

describe("staffChangeError", () => {
  const base = { actorId: "a", actorIsSuper: false, targetId: "b", targetRoles: ["employee"] };
  it("allows HR to manage employees", () => expect(staffChangeError({ ...base, nextRole: "department_lead" })).toBeNull());
  it("blocks self edits", () => expect(staffChangeError({ ...base, targetId: "a" })).toMatch(/your own/));
  it("protects super admins", () => expect(staffChangeError({ ...base, actorIsSuper: true, targetRoles: ["super_admin"] })).toMatch(/Super admins/));
  it("stops HR from creating or editing HR admins", () => {
    expect(staffChangeError({ ...base, nextRole: "hr_admin" })).toMatch(/super admin/);
    expect(staffChangeError({ ...base, targetRoles: ["hr_admin"] })).toMatch(/super admin/);
    expect(staffChangeError({ ...base, actorIsSuper: true, nextRole: "hr_admin" })).toBeNull();
  });
});
