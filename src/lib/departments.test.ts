import { describe, expect, it } from "vitest";
import {
  DEPARTMENTS,
  canReceivePackets,
  canSendPackets,
  canViewDepartmentPlans,
  canWorkPackets,
  normalizeDepartments,
  resolveAccess,
  staffChangeError,
  visibleTabs,
} from "./departments";

describe("resolveAccess", () => {
  it("returns null for non-staff", () => {
    expect(resolveAccess([])).toBeNull();
    expect(resolveAccess([{ role: "user", departments: [] }])).toBeNull();
  });

  it("gives super admins every department and staff management", () => {
    expect(resolveAccess([{ role: "super_admin", departments: [] }])).toEqual({
      role: "super_admin",
      departments: [...DEPARTMENTS],
      canManageStaff: true,
      allTeams: true,
    });
  });

  it("limits employees to their departments", () => {
    const a = resolveAccess([
      { role: "employee", departments: ["branding", "registration", "royalty_accounts"] },
    ])!;
    expect(a.departments).toEqual(["registration", "royalty_accounts", "branding"]);
    expect(a.canManageStaff).toBe(false);
  });

  it("gives HR admins only HR, even if other departments are stored", () => {
    expect(resolveAccess([{ role: "hr_admin", departments: ["finance"] }])).toEqual({
      role: "hr_admin",
      departments: ["hr"],
      canManageStaff: true,
    });
  });

  it("ignores unknown department values", () => {
    expect(
      resolveAccess([{ role: "department_lead", departments: ["finance", "nope"] }])!.departments,
    ).toEqual(["finance"]);
  });

  it("keeps the launch department to super admins", () => {
    // A stored "launch" on a staff row grants nothing: the milestones name hosting, secrets and vendors.
    expect(
      resolveAccess([{ role: "department_lead", departments: ["launch", "support"] }])!.departments,
    ).toEqual(["support"]);
    expect(resolveAccess([{ role: "employee", departments: ["launch"] }])!.departments).toEqual([]);
    expect(
      resolveAccess([{ role: "project_manager", departments: ["launch"] }])!.departments,
    ).toEqual([]);
    expect(resolveAccess([{ role: "super_admin" }])!.departments).toContain("launch");
  });
});

/** Every staff member gets My Queue, the Idea Box, their own tabs, Task Bank, Calendar, Handbook, Support Scripts, the Price List, PDF Tools, Email and Recognition. */
const ALWAYS = ["queue", "team", "submissions"];
const ALWAYS_AFTER = [
  "tasks",
  "calendar",
  "handbook",
  "staff-plan",
  "scripts",
  "prices",
  "pdf",
  "email",
  "recognition",
];
const withDeptTabs = (tabs: string[]) => [...ALWAYS, ...tabs, ...ALWAYS_AFTER];

describe("visibleTabs", () => {
  it("shows employees only their department tabs", () => {
    const branding = resolveAccess([
      { role: "employee", departments: ["registration", "royalty_accounts", "branding"] },
    ])!;
    // Registration and Royalty Accounts also work the retired-ISRC queue (founder, 2026-11-12).
    // The Message Board sits beside Registrations, and the registration desk reads the company inbox's registrations@
    // mailbox from the same tab (founder, 2026-11-18), so both follow that department and nobody else.
    expect(visibleTabs(branding).map((t) => t.value)).toEqual([
      ...withDeptTabs(["reg", "board", "splits", "retired", "badges", "homepage"]),
      "inbox",
    ]);
    const support = visibleTabs(
      resolveAccess([{ role: "employee", departments: ["support"] }])!,
    ).map((t) => t.value);
    expect(support).not.toContain("board");
    expect(support).not.toContain("inbox");
    // Finance keeps the billing console, Support gets tickets and badges, Sales just its Task Bank.
    const billing = resolveAccess([
      { role: "employee", departments: ["finance", "support", "marketing_sales"] },
    ])!;
    // Billing also gets Account help, where it sends the card-update link (founder, 2026-11-05).
    // Support works the retired-ISRC queue too, alongside the ticket queue it already owns.
    expect(visibleTabs(billing).map((t) => t.value)).toEqual(
      withDeptTabs(["retired", "purchases", "billing", "support", "accounts", "badges"]),
    );
  });

  it("gives the AI department the AI Protection tab; Legal is the super admin's alone", () => {
    expect(
      visibleTabs(resolveAccess([{ role: "employee", departments: ["ai"] }])!).map((t) => t.value),
    ).toEqual(withDeptTabs(["ai"]));
    // Legal is a role now (founder, 2026-11-20): no department, Security included, hands it to its staff.
    expect(
      visibleTabs(
        resolveAccess([{ role: "employee", departments: ["software", "security"] }])!,
      ).map((t) => t.value),
    ).toEqual(withDeptTabs([]));
    expect(
      visibleTabs(resolveAccess([{ role: "super_admin", departments: [] }])!).map((t) => t.value),
    ).toContain("legal");
  });

  it("never shows finance to HR admins", () => {
    // Company Contracts is the super admin's alone again (founder, 2026-11-17), so HR keeps no tab beyond its own work.
    expect(visibleTabs(resolveAccess([{ role: "hr_admin" }])!).map((t) => t.value)).toEqual(
      withDeptTabs([]),
    );
  });

  it("lets HR send and receive a packet, never build or counter-sign", () => {
    // Founder, 2026-11-22: HR sends and reads what came back; building a packet, the reply inbox and counter-signing are
    // the super admin's. The server and migration 20261122200000 keep the same split.
    for (const access of [
      resolveAccess([{ role: "employee", departments: ["hr"] }]),
      resolveAccess([{ role: "department_lead", departments: ["hr"] }]),
      resolveAccess([{ role: "hr_admin" }]),
    ]) {
      expect(canSendPackets(access)).toBe(true);
      expect(canReceivePackets(access)).toBe(true);
      expect(canWorkPackets(access)).toBe(false);
    }
    for (const role of ["employee", "department_lead", "project_manager"] as const) {
      const access = resolveAccess([{ role, departments: ["finance", "support"] }]);
      expect(canSendPackets(access)).toBe(false);
      expect(canReceivePackets(access)).toBe(false);
      expect(canWorkPackets(access)).toBe(false);
    }
    const superAdmin = resolveAccess([{ role: "super_admin" }]);
    expect(canSendPackets(superAdmin)).toBe(true);
    expect(canReceivePackets(superAdmin)).toBe(true);
    expect(canWorkPackets(superAdmin)).toBe(true);
    expect(canSendPackets(null)).toBe(false);
    expect(canReceivePackets(null)).toBe(false);
    expect(canWorkPackets(null)).toBe(false);
  });

  it("keeps Company Contracts to super admins alone", () => {
    const tabs = (role: "super_admin" | "hr_admin" | "project_manager" | "department_lead") =>
      visibleTabs(resolveAccess([{ role, departments: ["finance"] }])!).map((t) => t.value);
    expect(tabs("super_admin")).toContain("company");
    expect(tabs("hr_admin")).not.toContain("company");
    expect(tabs("project_manager")).not.toContain("company");
    expect(tabs("department_lead")).not.toContain("company");
  });

  it("keeps Task Bank Plans to super admins alone", () => {
    // Founder, 2026-11-21: a department's quarterly plan is its scorecard, so the toggle exists for nobody else.
    // The panel reads canViewDepartmentPlans (migration 20261121210000), so assert both halves stay shut.
    expect(visibleTabs(resolveAccess([{ role: "super_admin" }])!).map((t) => t.value)).toContain(
      "plans",
    );
    expect(canViewDepartmentPlans(resolveAccess([{ role: "super_admin" }]))).toBe(true);
    for (const role of ["hr_admin", "project_manager", "department_lead", "employee"] as const) {
      const access = resolveAccess([{ role, departments: ["finance"] }])!;
      expect(visibleTabs(access).map((t) => t.value)).not.toContain("plans");
      expect(canViewDepartmentPlans(access)).toBe(false);
    }
    // Even a Project Manager, who reads every team's Task Bank, gets no Plans.
    expect(
      canViewDepartmentPlans(
        resolveAccess([{ role: "project_manager", departments: ["finance", "support"] }]),
      ),
    ).toBe(false);
    expect(canViewDepartmentPlans(null)).toBe(false);
    expect(canViewDepartmentPlans(undefined)).toBe(false);
  });

  it("gives marketing the Badges and Homepage tabs and its Task Bank; sales gets its Task Bank", () => {
    const marketing = resolveAccess([{ role: "employee", departments: ["marketing"] }])!;
    // Marketing also answers marketing@, partners@, info@ and collaborate@ from the Inbox tab (founder, 2026-11-19).
    // It gets no Support Tickets tab: an escalated thread is the department lead's, never the team's.
    expect(visibleTabs(marketing).map((t) => t.value)).toEqual([
      ...withDeptTabs(["badges", "homepage"]),
      "inbox",
    ]);
    expect(
      visibleTabs(resolveAccess([{ role: "employee", departments: ["marketing_sales"] }])!).map(
        (t) => t.value,
      ),
    ).toEqual(withDeptTabs([]));
    expect(visibleTabs(resolveAccess([{ role: "employee", departments: [] }])!)).toEqual([]);
  });

  it("narrows the super admin view with the switcher", () => {
    const sa = resolveAccess([{ role: "super_admin" }])!;
    // The company inbox sits with the super-admin tabs (founder, 2026-11-17): admin@ and contracts@ mail is the company's.
    expect(
      visibleTabs(sa)
        .map((t) => t.value)
        .slice(-8),
    ).toEqual(["prices", "pdf", "email", "recognition", "inbox", "holiday", "company", "plans"]);
    // A staff member never gets it, whatever department they hold.
    expect(
      visibleTabs(resolveAccess([{ role: "employee", departments: ["support"] }])!).map(
        (t) => t.value,
      ),
    ).not.toContain("inbox");
    expect(visibleTabs(sa)[0]?.value).toBe("queue");
    // The inbox follows a super admin into a narrowed view too, since it belongs to no department.
    expect(visibleTabs(sa, "finance").map((t) => t.value)).toEqual([
      ...withDeptTabs(["purchases", "billing"]),
      "inbox",
    ]);
    expect(visibleTabs(sa, "support").map((t) => t.value)).toEqual([
      ...withDeptTabs(["retired", "support", "accounts", "badges"]),
      "inbox",
    ]);
  });

  it("gives Billing the ticket queue and every staff member the scripts", () => {
    const billing = resolveAccess([{ role: "employee", departments: ["billing"] }])!;
    expect(visibleTabs(billing).map((t) => t.value)).toContain("support");
    expect(visibleTabs(billing).map((t) => t.value)).toContain("scripts");
    expect(
      visibleTabs(resolveAccess([{ role: "employee", departments: ["ai"] }])!).map((t) => t.value),
    ).toContain("scripts");
    expect(visibleTabs(resolveAccess([{ role: "hr_admin" }])!).map((t) => t.value)).toContain(
      "scripts",
    );
  });

  it("gives an escalated department's lead the ticket queue, and its employees nothing", () => {
    const lead = visibleTabs(
      resolveAccess([{ role: "department_lead", departments: ["marketing"] }])!,
    ).map((t) => t.value);
    const employee = visibleTabs(
      resolveAccess([{ role: "employee", departments: ["marketing"] }])!,
    ).map((t) => t.value);
    expect(lead).toContain("support");
    expect(employee).not.toContain("support");
    // A lead of a department no escalation reaches keeps the queue out of their tabs.
    expect(
      visibleTabs(resolveAccess([{ role: "department_lead", departments: ["finance"] }])!).map(
        (t) => t.value,
      ),
    ).not.toContain("support");
  });

  it("keeps Holiday Cover to super admins and department leads", () => {
    const tabs = (
      role: "super_admin" | "department_lead" | "employee",
      departments: string[] = ["support"],
    ) => visibleTabs(resolveAccess([{ role, departments }])!).map((t) => t.value);
    expect(tabs("super_admin")).toContain("holiday");
    expect(tabs("department_lead", ["support"])).toContain("holiday");
    expect(tabs("employee", ["support"])).not.toContain("holiday");
    expect(tabs("employee", ["support"])).not.toContain("purchases");
  });
});

describe("normalizeDepartments", () => {
  it("forces HR admins to HR and drops unknown values", () => {
    expect(normalizeDepartments("hr_admin", ["finance"])).toEqual(["hr"]);
    expect(normalizeDepartments("employee", ["support", "bogus", "finance"])).toEqual([
      "finance",
      "support",
    ]);
  });

  it("never writes the super admin's launch department onto a staff row", () => {
    expect(normalizeDepartments("employee", ["launch", "support"])).toEqual(["support"]);
    expect(normalizeDepartments("department_lead", ["launch"])).toEqual([]);
  });
});

describe("staffChangeError", () => {
  const base = { actorId: "a", actorIsSuper: false, targetId: "b", targetRoles: ["employee"] };
  it("allows HR to manage employees", () =>
    expect(staffChangeError({ ...base, nextRole: "department_lead" })).toBeNull());
  it("blocks self edits", () =>
    expect(staffChangeError({ ...base, targetId: "a" })).toMatch(/your own/));
  it("protects super admins", () =>
    expect(staffChangeError({ ...base, actorIsSuper: true, targetRoles: ["super_admin"] })).toMatch(
      /Super admins/,
    ));
  it("stops HR from creating or editing HR admins", () => {
    expect(staffChangeError({ ...base, nextRole: "hr_admin" })).toMatch(/super admin/);
    expect(staffChangeError({ ...base, targetRoles: ["hr_admin"] })).toMatch(/super admin/);
    expect(staffChangeError({ ...base, actorIsSuper: true, nextRole: "hr_admin" })).toBeNull();
  });
});
