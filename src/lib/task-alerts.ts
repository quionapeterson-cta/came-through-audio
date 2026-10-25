import type { DepartmentTask, TaskImportance } from "@/lib/tasks.functions";

/** Task importance, deadlines and what Admin shows on sign-in (PLAN-master-notes Phase 4, approved 2026-10-25). */
export const IMPORTANCE_LABEL: Record<TaskImportance, string> = { top: "Top priority", high: "High", normal: "Normal", low: "Low" };
const RANK: Record<TaskImportance, number> = { top: 0, high: 1, normal: 2, low: 3 };

export const importanceChip = (i: TaskImportance | undefined) => `rounded-full px-2 py-0.5 text-xs font-bold ${
  i === "top" ? "bg-destructive text-destructive-foreground" : i === "high" ? "bg-primary text-primary-foreground" : "border border-border"}`;

/** Open tasks first; then Top priority → Low; then soonest deadline; then newest. */
export function sortTasks(tasks: DepartmentTask[]) {
  return [...tasks].sort((a, b) =>
    Number(a.status === "done") - Number(b.status === "done")
    || RANK[a.importance ?? "normal"] - RANK[b.importance ?? "normal"]
    || (a.due_at ? Date.parse(a.due_at) : Infinity) - (b.due_at ? Date.parse(b.due_at) : Infinity)
    || b.updated_at.localeCompare(a.updated_at));
}

/** "Due in 3 hours", "Due tomorrow at 5:00 PM", "2 days overdue". */
export function dueLabel(dueAt: string, now = Date.now()): { text: string; overdue: boolean; ms: number } {
  const ms = Date.parse(dueAt) - now;
  const abs = Math.abs(ms), h = abs / 3600_000, d = h / 24;
  const span = h < 1 ? `${Math.max(1, Math.round(abs / 60_000))} min` : h < 48 ? `${Math.round(h)} hour${Math.round(h) === 1 ? "" : "s"}` : `${Math.round(d)} days`;
  return ms < 0 ? { text: `${span} overdue`, overdue: true, ms } : { text: `Due in ${span}`, overdue: false, ms };
}

export const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

/** Tasks this person should act on: theirs, or their department's with no owner. */
const mine = (t: DepartmentTask, me: string) => t.owner_id === me || !t.owner_id;

/** What Admin shows on sign-in: urgent Top priority alerts first, else the last win and the next task. */
export function signInMoment(tasks: DepartmentTask[], me: string, snoozed: Record<string, number> = {}, now = Date.now()) {
  const open = tasks.filter((t) => t.status !== "done" && mine(t, me));
  const urgent = sortTasks(open.filter((t) => t.importance === "top" && !((snoozed[t.id] ?? 0) > now)));
  const last = tasks.filter((t) => t.completed_by === me && t.completed_at).sort((a, b) => b.completed_at!.localeCompare(a.completed_at!))[0];
  const next = sortTasks(open.filter((t) => t.status !== "idea"))[0] ?? sortTasks(open)[0];
  return { urgent, last, next };
}

/** Snooze lasts an hour but never past the deadline. */
export const snoozeUntil = (t: DepartmentTask, now = Date.now()) => Math.min(now + 3600_000, t.due_at ? Date.parse(t.due_at) : Infinity);
