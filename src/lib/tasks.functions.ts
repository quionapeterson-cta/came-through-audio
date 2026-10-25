import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEPARTMENTS } from "./departments";

export const TASK_STATUSES = ["idea", "planned", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_IMPORTANCE = ["top", "high", "normal", "low"] as const;
export type TaskImportance = (typeof TASK_IMPORTANCE)[number];
export type DepartmentTask = {
  id: string; department: string; title: string; body: string; status: TaskStatus; created_at: string; updated_at: string;
  importance: TaskImportance; due_at: string | null; owner_id: string | null; completed_at: string | null; completed_by: string | null;
};

const taskSchema = z.object({
  id: z.string().uuid().optional(),
  department: z.enum(DEPARTMENTS),
  title: z.string().trim().min(1, "Add a title").max(200),
  body: z.string().max(20000),
  status: z.enum(TASK_STATUSES),
  importance: z.enum(TASK_IMPORTANCE).default("normal"),
  due_at: z.string().datetime({ offset: true }).nullable().default(null),
  owner_id: z.string().uuid().nullable().default(null),
});

/** Staff only: tasks for every department the caller belongs to (RLS narrows the rows to in_department). */
export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("department_tasks" as never).select("*").order("updated_at", { ascending: false }).limit(500);
    if (error) throw new Error("Couldn't load the task bank.");
    return (data ?? []) as unknown as DepartmentTask[];
  });

/** Adds or updates a task, after confirming the caller belongs to that department. */
export const saveTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => taskSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("in_department", { _user_id: context.userId, _dept: data.department });
    if (!allowed) throw new Error("Forbidden");
    const row = { department: data.department, title: data.title, body: data.body, status: data.status, importance: data.importance, due_at: data.due_at, owner_id: data.owner_id, updated_at: new Date().toISOString() };
    const { error } = data.id
      ? await context.supabase.from("department_tasks" as never).update(row as never).eq("id", data.id)
      : await context.supabase.from("department_tasks" as never).insert(row as never);
    if (error) throw new Error("Couldn't save the task.");
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("department_tasks" as never).delete().eq("id", data.id);
    if (error) throw new Error("Couldn't delete the task.");
    return { ok: true };
  });

export type TaskOwner = { userId: string; name: string; departments: string[] };

/** Staff who can own a task: everyone in a department the caller belongs to (super admins see all), plus the caller. */
export const listTaskOwners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ me: string; owners: TaskOwner[] }> => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!isStaff) throw new Error("Forbidden");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await db.from("user_roles").select("user_id, role, departments").neq("role", "user");
    const mineRows = (rows ?? []).filter((r) => r.user_id === context.userId);
    const isSuper = mineRows.some((r) => r.role === "super_admin");
    const myDepts = new Set(mineRows.flatMap((r) => (r.departments as string[] | null) ?? []));
    const byUser = new Map<string, string[]>();
    for (const r of rows ?? []) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), ...(((r.departments as string[] | null) ?? []))]);
    const ids = [...byUser.keys()].filter((id) => id === context.userId || isSuper || byUser.get(id)!.some((d) => myDepts.has(d)));
    const { data: profiles } = await db.from("profiles").select("id, legal_name, stage_name").in("id", ids);
    const owners = ids.map((id) => {
      const p = profiles?.find((x) => x.id === id);
      return { userId: id, name: p?.legal_name || p?.stage_name || "Team member", departments: [...new Set(byUser.get(id))] };
    }).sort((a, b) => a.name.localeCompare(b.name));
    return { me: context.userId, owners };
  });
