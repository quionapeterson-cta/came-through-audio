import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAccess, type StaffAccess } from "./departments";

/**
 * The admin hub's own tables (founder, 2026-11-05): step checklists with lead locks and approval requests, the live win
 * feed, and the coordination notices behind the Team Board. Reads and writes go through these server functions with the
 * service client after an explicit role check; the tables are RLS-protected as a second line, not as the only one.
 */
export type TaskStep = { id: string; itemRef: string; title: string; position: number; doneAt: string | null; lock: "open" | "locked" | "approval" };
export type StepRequest = { id: string; stepId: string; stepTitle: string; requesterName: string; proposedTitle: string | null; reason: string; createdAt: string; status: string };
export type Win = { id: string; userId: string; actorName: string; kind: string; title: string; createdAt: string };
export type Notice = { id: string; authorName: string; department: string | null; body: string; createdAt: string };
export type TeamPulse = {
  departments: { department: string; inProgress: number; planned: number; doneThisWeek: number }[];
  inProgress: { id: string; title: string; department: string; owner: string | null; dueAt: string | null }[];
  notices: Notice[];
  canPost: boolean;
};

type Ctx = {
  supabase: { from: (t: "user_roles") => { select: (c: string) => { eq: (col: string, v: unknown) => PromiseLike<{ data: unknown }> } } };
  userId: string;
};

/** The hub tables ship with their migration, so the generated types lag behind: reached through one cast client. */
type Row = {
  id?: string; item_ref?: string; title?: string; position?: number; done_at?: string | null; lock_mode?: string;
  user_id?: string; step_id?: string; requested_by?: string; proposed_title?: string | null; reason?: string;
  status?: string; created_at?: string; actor_name?: string; kind?: string; author_name?: string;
  department?: string | null; body?: string;
  updated_at?: string; created_by?: string; locked_by?: string; author_id?: string;
  decided_by?: string; decided_at?: string;
};
type Got<T> = { data: T[] | null; error?: unknown };
type Filter<T> = PromiseLike<Got<T>> & {
  order: (col: string, o: { ascending: boolean }) => Promise<Got<T>>;
  in: (col: string, values: unknown[]) => Promise<Got<T>>;
};
type Sel<T> = Filter<T> & { eq: (col: string, value: unknown) => Filter<T> };
type Table<T> = {
  select: (cols: string) => Sel<T>;
  insert: (row: Row) => Promise<{ error: unknown }>;
  update: (row: Row) => { eq: (col: string, value: unknown) => Promise<{ error: unknown }> };
  delete: () => { eq: (col: string, value: unknown) => Promise<{ error: unknown }> };
};

async function tables() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = supabaseAdmin as unknown as { from: (t: string) => Table<Row> };
  return { client, supabaseAdmin };
}

async function accessOf(context: Ctx): Promise<StaffAccess> {
  const { data } = await context.supabase.from("user_roles").select("role, departments").eq("user_id", context.userId);
  const access = resolveAccess((data ?? []) as { role: string; departments?: string[] | null }[]);
  if (!access) throw new Error("Staff only.");
  return access;
}

const isLead = (a: StaffAccess) => a.role === "super_admin" || a.role === "department_lead";
const canPostNotice = (a: StaffAccess) => isLead(a) || a.role === "project_manager";
const me = (context: unknown) => (context as Ctx).userId;

const stepType = z.object({ id: z.string().uuid() });
const lockType = z.enum(["open", "locked", "approval"]);

const toStep = (r: Row): TaskStep => ({
  id: String(r.id), itemRef: String(r.item_ref), title: String(r.title), position: Number(r.position ?? 0),
  doneAt: (r.done_at as string | null) ?? null, lock: (r.lock_mode as TaskStep["lock"]) ?? "open",
});

function nameOf(profiles: { id: string; legal_name: string | null; stage_name: string | null }[] | null, id: string) {
  const p = profiles?.find((x) => x.id === id);
  return (p?.legal_name || p?.stage_name || "A teammate").split(" ")[0] ?? "A teammate";
}

/** My own checklist, across every item on my board. */
export const listMySteps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TaskStep[]> => {
    await accessOf(context as unknown as Ctx);
    const { client } = await tables();
    try {
      const { data } = await client.from("task_steps").select("id, item_ref, title, position, done_at, lock_mode")
        .eq("user_id", me(context)).order("position", { ascending: true });
      return (data ?? []).map(toStep);
    } catch {
      return [];
    }
  });

export const addStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ itemRef: z.string().min(1).max(120), title: z.string().trim().min(1, "Name the step").max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await accessOf(context as unknown as Ctx);
    const { client } = await tables();
    const { data: have } = await client.from("task_steps").select("position").eq("user_id", me(context)).order("position", { ascending: false });
    const next = Number((have?.[0]?.position as number | undefined) ?? -1) + 1;
    const { error } = await client.from("task_steps").insert({ user_id: me(context), item_ref: data.itemRef, title: data.title, position: next, created_by: me(context), updated_at: new Date().toISOString() });
    if (error) throw new Error("Couldn't add that step.");
    return { ok: true as const };
  });

export const editStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => stepType.extend({ title: z.string().trim().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await accessOf(context as unknown as Ctx);
    const { client } = await tables();
    const { data: found } = await client.from("task_steps").select("user_id, lock_mode").eq("id", data.id);
    const step = found?.[0];
    if (!step || step.user_id !== me(context)) throw new Error("That step isn't yours.");
    if (step.lock_mode !== "open") throw new Error("That step is locked. Request approval from your lead.");
    const { error } = await client.from("task_steps").update({ title: data.title, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error("Couldn't save the step.");
    return { ok: true as const };
  });

export const toggleStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => stepType.extend({ done: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await accessOf(context as unknown as Ctx);
    const { client } = await tables();
    const { data: found } = await client.from("task_steps").select("user_id").eq("id", data.id);
    if (found?.[0]?.user_id !== me(context)) throw new Error("That step isn't yours.");
    const { error } = await client.from("task_steps").update({ done_at: data.done ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error("Couldn't update the step.");
    return { ok: true as const };
  });

export const deleteStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => stepType.parse(d))
  .handler(async ({ data, context }) => {
    await accessOf(context as unknown as Ctx);
    const { client } = await tables();
    const { data: found } = await client.from("task_steps").select("user_id, lock_mode").eq("id", data.id);
    const step = found?.[0];
    if (!step || step.user_id !== me(context)) throw new Error("That step isn't yours.");
    if (step.lock_mode !== "open") throw new Error("That step is locked. Ask your lead to remove it.");
    const { error } = await client.from("task_steps").delete().eq("id", data.id);
    if (error) throw new Error("Couldn't remove the step.");
    return { ok: true as const };
  });

/** Super admins and department leads lock, unlock, or require approval on any step. */
export const setStepLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => stepType.extend({ lock: lockType }).parse(d))
  .handler(async ({ data, context }) => {
    const access = await accessOf(context as unknown as Ctx);
    if (!isLead(access)) throw new Error("Only a super admin or department lead can lock steps.");
    const { client } = await tables();
    const { error } = await client.from("task_steps").update({ lock_mode: data.lock, locked_by: me(context), updated_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error("Couldn't change the lock.");
    return { ok: true as const };
  });

/** Standard staff propose a change to a locked step; a lead decides it. */
export const requestStepChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => stepType.extend({ proposedTitle: z.string().trim().max(200).optional(), reason: z.string().trim().max(500).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    await accessOf(context as unknown as Ctx);
    const { client } = await tables();
    const { data: found } = await client.from("task_steps").select("id, title, lock_mode").eq("id", data.id);
    const step = found?.[0];
    if (!step) throw new Error("That step is gone.");
    if (step.lock_mode === "open") throw new Error("That step is editable — change it directly.");
    const { error } = await client.from("step_change_requests").insert({
      step_id: data.id, requested_by: me(context), proposed_title: data.proposedTitle || String(step.title), reason: data.reason || "", created_at: new Date().toISOString(),
    });
    if (error) throw new Error("Couldn't send the request.");
    return { ok: true as const };
  });

/** Leads: the requests waiting on them, with the step and the person asking. */
export const listStepRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StepRequest[]> => {
    const access = await accessOf(context as unknown as Ctx);
    if (!isLead(access)) return [];
    const { client, supabaseAdmin } = await tables();
    try {
      const { data } = await client.from("step_change_requests").select("id, step_id, requested_by, proposed_title, reason, status, created_at").eq("status", "pending").order("created_at", { ascending: false });
      const rows = data ?? [];
      if (!rows.length) return [];
      const stepIds = [...new Set(rows.map((r) => String(r.step_id)))];
      const { data: steps } = await client.from("task_steps").select("id, title").in("id", stepIds);
      const titles = new Map((steps ?? []).map((s) => [String(s.id), String(s.title)]));
      const ids = [...new Set(rows.map((r) => String(r.requested_by)))];
      const { data: profiles } = await supabaseAdmin.from("profiles").select("id, legal_name, stage_name").in("id", ids);
      return rows.map((r) => ({
        id: String(r.id), stepId: String(r.step_id), stepTitle: titles.get(String(r.step_id)) ?? "Step",
        requesterName: nameOf(profiles, String(r.requested_by)), proposedTitle: (r.proposed_title as string | null) ?? null,
        reason: String(r.reason ?? ""), createdAt: String(r.created_at), status: String(r.status),
      }));
    } catch {
      return [];
    }
  });

export const decideStepRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), approve: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const access = await accessOf(context as unknown as Ctx);
    if (!isLead(access)) throw new Error("Only a super admin or department lead can decide this.");
    const { client } = await tables();
    const { data: found } = await client.from("step_change_requests").select("step_id, proposed_title, status").eq("id", data.id);
    const req = found?.[0];
    if (!req || req.status !== "pending") throw new Error("That request is already decided.");
    const now = new Date().toISOString();
    if (data.approve && req.proposed_title) {
      const { error } = await client.from("task_steps").update({ title: String(req.proposed_title), lock_mode: "open", updated_at: now }).eq("id", String(req.step_id));
      if (error) throw new Error("Couldn't apply the change.");
    }
    const { error } = await client.from("step_change_requests").update({ status: data.approve ? "approved" : "declined", decided_by: me(context), decided_at: now }).eq("id", data.id);
    if (error) throw new Error("Couldn't record the decision.");
    return { ok: true as const };
  });

/** Every finished task lands here, and every signed-in staff member sees it (founder, 2026-11-05). */
export const recordWin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ itemRef: z.string().min(1).max(120), title: z.string().trim().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }): Promise<Win> => {
    await accessOf(context as unknown as Ctx);
    const { client, supabaseAdmin } = await tables();
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, legal_name, stage_name").eq("id", me(context));
    const actorName = nameOf(profiles, me(context));
    const kind = data.itemRef.split(":")[0] || "task";
    const createdAt = new Date().toISOString();
    const { error } = await client.from("staff_wins").insert({ user_id: me(context), actor_name: actorName, kind, item_ref: data.itemRef, title: data.title, created_at: createdAt });
    if (error) throw new Error("That's done — but the win couldn't be posted.");
    return { id: crypto.randomUUID(), userId: me(context), actorName, kind, title: data.title, createdAt };
  });

/** The last wins, newest first. The header polls this so a win reaches the whole team within seconds. */
export const listWins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Win[]> => {
    await accessOf(context as unknown as Ctx);
    const { client } = await tables();
    try {
      const { data } = await client.from("staff_wins").select("id, user_id, actor_name, kind, title, created_at").order("created_at", { ascending: false });
      return (data ?? []).slice(0, 25).map((r) => ({
        id: String(r.id), userId: String(r.user_id), actorName: String(r.actor_name ?? "A teammate"),
        kind: String(r.kind ?? "task"), title: String(r.title), createdAt: String(r.created_at),
      }));
    } catch {
      return [];
    }
  });

/** Cross-department visibility for leads (and everyone, on the team board). */
export const teamPulse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TeamPulse> => {
    const access = await accessOf(context as unknown as Ctx);
    const { client, supabaseAdmin } = await tables();
    try {
      const [tasks, notices] = await Promise.all([
        supabaseAdmin.from("department_tasks").select("id, title, department, status, owner_id, due_at, completed_at").order("updated_at", { ascending: false }).limit(400),
        client.from("team_notices").select("id, author_name, department, body, created_at").order("created_at", { ascending: false }),
      ]);
      const rows = (tasks.data ?? []) as { id: string; title: string; department: string; status: string; owner_id: string | null; due_at: string | null; completed_at: string | null }[];
      const weekAgo = Date.now() - 7 * 86400000;
      const byDept = new Map<string, { inProgress: number; planned: number; doneThisWeek: number }>();
      for (const t of rows) {
        const at = byDept.get(t.department) ?? { inProgress: 0, planned: 0, doneThisWeek: 0 };
        if (t.status === "in_progress") at.inProgress += 1;
        if (t.status === "planned" || t.status === "idea") at.planned += 1;
        if (t.status === "done" && t.completed_at && Date.parse(t.completed_at) >= weekAgo) at.doneThisWeek += 1;
        byDept.set(t.department, at);
      }
      const owners = [...new Set(rows.filter((t) => t.status === "in_progress" && t.owner_id).map((t) => t.owner_id as string))];
      const profiles = owners.length ? (await supabaseAdmin.from("profiles").select("id, legal_name, stage_name").in("id", owners)).data : [];
      return {
        departments: [...byDept.entries()].map(([department, v]) => ({ department, ...v })).sort((a, b) => b.inProgress - a.inProgress || a.department.localeCompare(b.department)),
        inProgress: rows.filter((t) => t.status === "in_progress").slice(0, 24).map((t) => ({
          id: t.id, title: t.title, department: t.department, dueAt: t.due_at,
          owner: t.owner_id ? nameOf(profiles, t.owner_id) : null,
        })),
        notices: (notices.data ?? []).slice(0, 12).map((n) => ({
          id: String(n.id), authorName: String(n.author_name ?? "A lead"), department: (n.department as string | null) ?? null,
          body: String(n.body), createdAt: String(n.created_at),
        })),
        canPost: canPostNotice(access),
      };
    } catch {
      return { departments: [], inProgress: [], notices: [], canPost: canPostNotice(access) };
    }
  });

/** A short note for the other leads: a dependency, a blocker, a heads-up. */
export const postNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ body: z.string().trim().min(1, "Write the note").max(1000), department: z.string().max(40).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const access = await accessOf(context as unknown as Ctx);
    if (!canPostNotice(access)) throw new Error("Only leads and super admins post here. Send it to your lead.");
    const { client, supabaseAdmin } = await tables();
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, legal_name, stage_name").eq("id", me(context));
    const authorName = nameOf(profiles, me(context));
    const { error } = await client.from("team_notices").insert({
      author_id: me(context), author_name: authorName, department: data.department || access.departments[0] || null, body: data.body, created_at: new Date().toISOString(),
    });
    if (error) throw new Error("Couldn't post the note.");
    return { ok: true as const };
  });
