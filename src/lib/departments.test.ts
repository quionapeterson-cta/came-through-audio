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

/** Every staff member gets My Queue, the Idea Box, their own tabs, Task Bank, Calendar, Handbook, Support Scripts, the Price List, PDF Tools, Email and Recognition. */
const ALWAYS = ["queue", "submissions"];
const ALWAYS_AFTER = ["tasks", "calendar", "handbook", "staff-plan", "scripts", "prices", "pdf", "email", "recognition"];
const withDeptTabs = (tabs: string[]) => [...ALWAYS, ...tabs, ...ALWAYS_AFTER];

describe("visibleTabs", () => {
  it("shows employees only their department tabs", () => {
    const branding = resolveAccess([{ role: "employee", departments: ["registration", "royalty_accounts", "branding"] }])!;
    expect(visibleTabs(branding).map((t) => t.value)).toEqual(withDeptTabs(["reg", "splits", "badges", "homepage"]));
    // Finance keeps the billing console, Support gets tickets and badges, Sales just its Task Bank.
    const billing = resolveAccess([{ role: "employee", departments: ["finance", "support", "marketing_sales"] }])!;
    // Billing also gets Account help, where it sends the card-update link (founder, 2026-11-05).
    expect(visibleTabs(billing).map((t) => t.value)).toEqual(withDeptTabs(["purchases", "billing", "support", "accounts", "badges"]));
  });

  it("gives the AI department the AI Protection tab; Security also gets Legal", () => {
    expect(visibleTabs(resolveAccess([{ role: "employee", departments: ["ai"] }])!).map((t) => t.value)).toEqual(withDeptTabs(["ai"]));
    expect(visibleTabs(resolveAccess([{ role: "employee", departments: ["software", "security"] }])!).map((t) => t.value)).toEqual(withDeptTabs(["legal"]));
  });

  it("never shows finance to HR admins", () => {
    expect(visibleTabs(resolveAccess([{ role: "hr_admin" }])!).map((t) => t.value)).toEqual(withDeptTabs([]));
  });

  it("gives marketing the Badges and Homepage tabs and its Task Bank; sales gets its Task Bank", () => {
    const marketing = resolveAccess([{ role: "employee", departments: ["marketing"] }])!;
    expect(visibleTabs(marketing).map((t) => t.value)).toEqual(withDeptTabs(["badges", "homepage"]));
    expect(visibleTabs(resolveAccess([{ role: "employee", departments: ["marketing_sales"] }])!).map((t) => t.value)).toEqual(withDeptTabs([]));
    expect(visibleTabs(resolveAccess([{ role: "employee", departments: [] }])!)).toEqual([]);
  });

  it("narrows the super admin view with the switcher", () => {
    const sa = resolveAccess([{ role: "super_admin" }])!;
    expect(visibleTabs(sa).map((t) => t.value).slice(-8)).toEqual(["scripts", "prices", "pdf", "email", "recognition", "holiday", "company", "plans"]);
    expect(visibleTabs(sa)[0]?.value).toBe("queue");
    expect(visibleTabs(sa, "finance").map((t) => t.value)).toEqual(withDeptTabs(["purchases", "billing"]));
    expect(visibleTabs(sa, "support").map((t) => t.value)).toEqual(withDeptTabs(["support", "accounts", "badges"]));
  });

  it("gives Billing the ticket queue and every staff member the scripts", () => {
    const billing = resolveAccess([{ role: "employee", departments: ["billing"] }])!;
    expect(visibleTabs(billing).map((t) => t.value)).toContain("support");
    expect(visibleTabs(billing).map((t) => t.value)).toContain("scripts");
    expect(visibleTabs(resolveAccess([{ role: "employee", departments: ["ai"] }])!).map((t) => t.value)).toContain("scripts");
    expect(visibleTabs(resolveAccess([{ role: "hr_admin" }])!).map((t) => t.value)).toContain("scripts");
  });

  it("keeps Holiday Cover to super admins and department leads", () => {
    const tabs = (role: "super_admin" | "department_lead" | "employee", departments: string[] = ["support"]) =>
      visibleTabs(resolveAccess([{ role, departments }])!).map((t) => t.value);
    expect(tabs("super_admin")).toContain("holiday");
    expect(tabs("department_lead", ["support"])).toContain("holiday");
    expect(tabs("employee", ["support"])).not.toContain("holiday");
    expect(tabs("employee", ["support"])).not.toContain("purchases");
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
