/**
 * Staff roles and departments. Mirrors public.in_department / public.can_manage_staff so the
 * dashboard shows exactly the tabs the database will let each person read.
 */
export const DEPARTMENTS = ["registration", "royalty_accounts", "finance", "branding", "marketing", "marketing_sales", "support", "ai", "software", "security", "hr"] as const;
export type Department = (typeof DEPARTMENTS)[number];

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
};

/** Roles HR can hand out from /admin/staff. super_admin is never granted from the UI. */
export const MANAGED_ROLES = ["employee", "department_lead", "hr_admin"] as const;
export type ManagedRole = (typeof MANAGED_ROLES)[number];
export type StaffRole = "super_admin" | ManagedRole;

export const ROLE_LABEL: Record<StaffRole, string> = {
  super_admin: "Super Admin",
  hr_admin: "HR Admin",
  department_lead: "Department Lead",
  employee: "Employee",
};

const ROLE_RANK: StaffRole[] = ["super_admin", "hr_admin", "department_lead", "employee"];

export type StaffAccess = { role: StaffRole; departments: Department[]; canManageStaff: boolean };

/** Resolves a user's user_roles rows into one access summary, or null for non-staff. */
export function resolveAccess(rows: { role: string; departments?: string[] | null }[]): StaffAccess | null {
  const role = ROLE_RANK.find((r) => rows.some((row) => row.role === r));
  if (!role) return null;
  if (role === "super_admin") return { role, departments: [...DEPARTMENTS], canManageStaff: true };
  const set = new Set<Department>();
  for (const row of rows) {
    if (row.role === "employee" || row.role === "department_lead") {
      for (const d of row.departments ?? []) if ((DEPARTMENTS as readonly string[]).includes(d)) set.add(d as Department);
    }
    if (row.role === "hr_admin") set.add("hr");
  }
  return { role, departments: DEPARTMENTS.filter((d) => set.has(d)), canManageStaff: role === "hr_admin" };
}

/** HR Admins only ever hold the HR department; everyone else needs at least one. */
export function normalizeDepartments(role: ManagedRole, departments: readonly string[]): Department[] {
  if (role === "hr_admin") return ["hr"];
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
  { value: "ai", label: "AI Protection", departments: ["registration", "ai"] },
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
  const withTasks = viewDepartments(access, view).length ? [...tabs, { value: "tasks", label: "Task Bank" }] : tabs;
  // Company contracts and plans are for super admins only, in the all-departments view.
  return access.role === "super_admin" && view === "all" ? [...withTasks, { value: "company", label: "Company Contracts" }, { value: "plans", label: "Plans" }] : withTasks;
}
