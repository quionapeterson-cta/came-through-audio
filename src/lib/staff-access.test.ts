import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { requireStaffAccess, staffAccessOf, type StaffContext } from "./staff-access.server";

/** The auth middleware's context as far as the lookup reads it: user_roles → role + departments. */
const contextWith = (rows: { role: string; departments: string[] | null }[]) =>
  ({
    userId: "user-1",
    supabase: {
      from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: rows, error: null }) }) }),
    },
  }) as unknown as StaffContext;

describe("staff access", () => {
  it("accepts an HR Admin, the seat public.is_staff leaves out", async () => {
    const access = await requireStaffAccess(
      contextWith([{ role: "hr_admin", departments: ["hr"] }]),
      "Only staff.",
    );
    expect(access.role).toBe("hr_admin");
    expect(access.departments).toEqual(["hr"]);
    expect(access.canManageStaff).toBe(true);
  });

  it("keeps every other staff seat and refuses an account with no staff row", async () => {
    for (const role of ["super_admin", "project_manager", "department_lead", "employee"]) {
      const access = await staffAccessOf(contextWith([{ role, departments: [] }]));
      expect(access?.role, role).toBe(role);
    }
    expect(await staffAccessOf(contextWith([{ role: "user", departments: null }]))).toBeNull();
    expect(await staffAccessOf(contextWith([]))).toBeNull();
    await expect(requireStaffAccess(contextWith([]), "Only staff.")).rejects.toThrow("Only staff.");
  });

  it("gates the Idea Box, Support Scripts and the task owners through this lookup", () => {
    const panels = [
      "src/lib/support-scripts.functions.ts", // Admin → Support Scripts
      "src/lib/staff-submissions.functions.ts", // Admin → Idea Box
      "src/lib/tasks.functions.ts", // the Task Bank's owner list
    ];
    for (const file of panels) {
      const source = readFileSync(file, "utf8");
      expect(source, file).toContain("staff-access.server");
      expect(source, file).toContain("requireStaffAccess(context");
      // The old gate the HR Admin fell through, and the loose context type its casts needed.
      expect(source, file).not.toContain('"is_staff"');
      expect(source, file).not.toContain("as unknown as Ctx");
    }
  });
});
