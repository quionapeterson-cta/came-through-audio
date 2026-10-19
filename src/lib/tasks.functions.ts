import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEPARTMENTS } from "./departments";

export const TASK_STATUSES = ["idea", "planned", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type DepartmentTask = { id: string; department: string; title: string; body: string; status: TaskStatus; created_at: string; updated_at: string };

const taskSchema = z.object({
  id: z.string().uuid().optional(),
  department: z.enum(DEPARTMENTS),
  title: z.string().trim().min(1, "Add a title").max(200),
  body: z.string().max(20000),
  status: z.enum(TASK_STATUSES),
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
    const row = { department: data.department, title: data.title, body: data.body, status: data.status, updated_at: new Date().toISOString() };
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
