/**
 * Staff roles and departments. Mirrors public.in_department / public.can_manage_staff so the
 * dashboard shows exactly the tabs the database will let each person read.
 */
export const DEPARTMENTS = ["registration", "royalty_accounts", "finance", "branding", "marketing", "marketing_sales", "support", "ai", "software", "security", "hr", "research", "launch"] as const;
export type Department = (typeof DEPARTMENTS)[number];
/**
 * Departments staff can be placed in. "launch" holds the pre-launch milestones (Phase 4, 2026-10-25) and is never
 * assigned, so only super admins (who see every department) see it.
 */
export const ASSIGNABLE_DEPARTMENTS = DEPARTMENTS.filter((d): d is Exclude<Department, "launch"> => d !== "launch");

export const DEPARTMENT_LABEL: Record<Department, string> = {
  registration: "Registration",
  royalty_accounts: "Royalty Accounts",
  finance: "Finance",
  branding: "Branding",
  marketing: "Marketing & Social Media",
  // The id predates the separate Marketing department (2026-10-20); it is the Sales team now.
  marketing_sales: "Sales",
  support: "Support",
  ai: "AI",
  software: "Software",
  security: "Security",
  hr: "HR",
  research: "Market Research",
  launch: "Launch (Super Admin)",
};

/** Roles HR can hand out from /admin/staff. super_admin is never granted from the UI. */
export const MANAGED_ROLES = ["employee", "department_lead", "project_manager", "hr_admin"] as const;
export type ManagedRole = (typeof MANAGED_ROLES)[number];
export type StaffRole = "super_admin" | ManagedRole;

export const ROLE_LABEL: Record<StaffRole, string> = {
  super_admin: "Super Admin",
  hr_admin: "HR Admin",
  department_lead: "Department Lead",
  project_manager: "Project Manager",
  employee: "Employee",
};

const ROLE_RANK: StaffRole[] = ["super_admin", "hr_admin", "project_manager", "department_lead", "employee"];

/**
 * `allTeams`: sees every team's Task Bank and calendar (super admins and Project Managers, Phase 4 item 8). A Project
 * Manager reads them only; `departments` is still just what they work in and can edit.
 */
export type StaffAccess = { role: StaffRole; departments: Department[]; canManageStaff: boolean; allTeams?: boolean };

/** Resolves a user's user_roles rows into one access summary, or null for non-staff. */
export function resolveAccess(rows: { role: string; departments?: string[] | null }[]): StaffAccess | null {
  const role = ROLE_RANK.find((r) => rows.some((row) => row.role === r));
  if (!role) return null;
  if (role === "super_admin") return { role, departments: [...DEPARTMENTS], canManageStaff: true, allTeams: true };
  const set = new Set<Department>();
  for (const row of rows) {
    if (row.role === "employee" || row.role === "department_lead") {
      for (const d of row.departments ?? []) if ((DEPARTMENTS as readonly string[]).includes(d)) set.add(d as Department);
    }
    if (row.role === "hr_admin") set.add("hr");
  }
  const allTeams = rows.some((r) => r.role === "project_manager");
  return { role, departments: DEPARTMENTS.filter((d) => set.has(d)), canManageStaff: role === "hr_admin", ...(allTeams && { allTeams }) };
}

/** HR Admins only ever hold the HR department; everyone else needs at least one. */
export function normalizeDepartments(role: ManagedRole, departments: readonly string[]): Department[] {
  if (role === "hr_admin") return ["hr"];
  // Project Managers see every team without being placed in one.
  if (role === "project_manager") return [];
  return DEPARTMENTS.filter((d) => departments.includes(d));
}

/**
 * Why a staff change isn't allowed, or null when it is. Nobody edits themselves or a super admin,
 * and only a super admin can grant, change or remove HR Admin, so HR can't escalate its own power.
 */
export function staffChangeError(o: { actorId: string; actorIsSuper: boolean; targetId: string; targetRoles: string[]; nextRole?: ManagedRole }): string | null {
  if (o.actorId === o.targetId) return "You can't change your own access.";
  if (o.targetRoles.includes("super_admin")) return "Super admins can't be changed here.";
  if (!o.actorIsSuper && (o.nextRole === "hr_admin" || o.targetRoles.includes("hr_admin"))) return "Only a super admin can manage HR Admins.";
  return null;
}

/** Departments that see and control badges in Admin → Badges (super admins hold every department). Mirrors public.can_manage_badges. */
export const BADGE_DEPARTMENTS = ["branding", "marketing", "support"] as const satisfies readonly Department[];

export const ADMIN_TABS = [
  { value: "ai", label: "AI Protection", departments: ["ai"] },
  { value: "reg", label: "Registrations", departments: ["registration"] },
  { value: "splits", label: "Split Sheets", departments: ["royalty_accounts"] },
  { value: "purchases", label: "Purchases", departments: ["finance"] },
  { value: "support", label: "Support Tickets", departments: ["support"] },
  { value: "badges", label: "Badges", departments: BADGE_DEPARTMENTS },
  { value: "homepage", label: "Homepage", departments: ["marketing", "branding"] },
] as const satisfies readonly { value: string; label: string; departments: readonly Department[] }[];

/** Departments in view: all of the caller's, or the one the super admin switcher picked. */
export function viewDepartments(access: StaffAccess, view: Department | "all" = "all") {
  return access.departments.filter((d) => view === "all" || d === view);
}

/** Tabs for the caller, optionally narrowed to one department. Every department gets the Task Bank; super admins also get Company Contracts and Plans. */
export function visibleTabs(access: StaffAccess, view: Department | "all" = "all"): { value: string; label: string }[] {
  const tabs = ADMIN_TABS.filter((t) => t.departments.some((d: Department) => access.departments.includes(d) && (view === "all" || d === view)));
  const base = viewDepartments(access, view).length || (access.allTeams && view === "all") ? [...tabs, { value: "tasks", label: "Task Bank" }] : tabs;
  // Everyone on the team gets the Calendar (Phase 4 item 8) and their own staff badges (item 6); nobody with no access
  // at all gets a tab.
  const withTasks = base.length ? [...base, { value: "calendar", label: "Calendar" }, { value: "recognition", label: "My Recognition" }] : base;
  // Company contracts and plans are for super admins only, in the all-departments view.
  return access.role === "super_admin" && view === "all" ? [...withTasks, { value: "company", label: "Company Contracts" }, { value: "plans", label: "Plans" }] : withTasks;
}
