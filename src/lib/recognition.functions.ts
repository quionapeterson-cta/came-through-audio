import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAccess, type Department } from "./departments";
import { staffBadges, type StaffBadgeState } from "./staff-badges";

/** Admin → My Recognition: the signed-in staff member's own badges, worked out on the server from their records. */
export const myRecognition = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffBadgeState[]> => {
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data: roles } = await db.from("user_roles").select("role, departments, created_at").eq("user_id", context.userId);
    const rows = (roles ?? []) as { role: string; departments: string[] | null; created_at: string }[];
    const access = resolveAccess(rows);
    if (!access) throw new Error("Only team members have staff badges.");
    const joinedAt = rows.map((r) => r.created_at).sort()[0]!;
    const { data: done } = await db.from("department_tasks" as never).select("department").eq("completed_by", context.userId).not("completed_at", "is", null);
    const completed: Partial<Record<Department, number>> = {};
    for (const t of (done ?? []) as { department: Department }[]) completed[t.department] = (completed[t.department] ?? 0) + 1;
    return staffBadges({ joinedAt, completed, departments: access.departments });
  });
