import { useState } from "react";
import { confirmAction } from "@/components/ConfirmHost";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Rocket, Telescope, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEPARTMENT_LABEL, type Department } from "@/lib/departments";
import { LAUNCH_MILESTONES } from "@/lib/launch-milestones";
import { RESEARCH_TITLES } from "@/lib/research-plan";
import { DepartmentPlans } from "@/components/DepartmentPlans";
import { deleteTask, listTaskOwners, listTasks, loadLaunchMilestones, loadResearchPlan, saveTask, TASK_REPEATS, type TaskRepeat, TASK_IMPORTANCE, TASK_STATUSES, type DepartmentTask, type TaskImportance, type TaskStatus } from "@/lib/tasks.functions";
import { IMPORTANCE_LABEL, dueLabel, importanceChip, sortTasks, toLocalInput, fromLocalInput } from "@/lib/task-alerts";

const STATUS_LABEL: Record<TaskStatus, string> = { idea: "Idea", planned: "Planned", in_progress: "In Progress", done: "Done" };
type Draft = { id?: string; department: Department; title: string; body: string; status: TaskStatus; importance: TaskImportance; due_at: string | null; owner_id: string | null;
  repeat: TaskRepeat | null; /** The saved value, so an unchanged repeat isn't sent. */ wasRepeat: TaskRepeat | null };
const REPEAT_LABEL: Record<TaskRepeat, string> = { weekly: "Every week", monthly: "Every month", quarterly: "Every 3 months" };

/** Each department's bank of ideas and plans for later. Rows are limited to the caller's departments by RLS. */
export function TaskBankPanel({ departments, editable = departments }: { departments: Department[]; /** Departments the caller can change (Project Managers read the rest). */ editable?: Department[] }) {
  const canEdit = (d: string) => editable.includes(d as Department);
  const fetchTasks = useServerFn(listTasks);
  const save = useServerFn(saveTask);
  const remove = useServerFn(deleteTask);
  const loadMilestones = useServerFn(loadLaunchMilestones);
  const loadResearch = useServerFn(loadResearchPlan);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["department-tasks"], queryFn: () => fetchTasks() });
  const fetchOwners = useServerFn(listTaskOwners);
  const owners = useQuery({ queryKey: ["task-owners"], queryFn: () => fetchOwners() });
  const ownerName = (id: string | null) => (id && owners.data?.owners.find((o) => o.userId === id)?.name) || "";
  const [dept, setDept] = useState<Department | "all">("all");
  const [status, setStatus] = useState<TaskStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"tasks" | "plans">("tasks");

  if (q.isLoading) return <p className="mt-6 text-muted-foreground">Loading…</p>;
  if (q.isError) return <p className="mt-6 text-destructive">Couldn't load the task bank.</p>;
  const mine = (q.data ?? []).filter((t) => departments.includes(t.department as Department));
  const inDept = mine.filter((t) => dept === "all" || t.department === dept);
  const rows = sortTasks(inDept.filter((t) => status === "all" || t.status === status));
  // Super admins: the pre-launch milestones not loaded yet into the Launch department.
  const launchTitles = new Set(mine.filter((t) => t.department === "launch").map((t) => t.title));
  const missingMilestones = departments.includes("launch") ? LAUNCH_MILESTONES.filter((m) => !launchTitles.has(m.title)).length : 0;
  const researchTitles = new Set(mine.filter((t) => t.department === "research").map((t) => t.title));
  const missingResearch = departments.includes("research") ? RESEARCH_TITLES.filter((t) => !researchTitles.has(t)).length : 0;
  const addResearch = async () => {
    setBusy(true);
    try {
      const { added } = await loadResearch();
      await qc.invalidateQueries({ queryKey: ["department-tasks"] });
      setDept("research");
      toast.success(`${added} repeating Market Research task${added === 1 ? "" : "s"} added.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't add the plan."); }
    finally { setBusy(false); }
  };
  const addMilestones = async () => {
    setBusy(true);
    try {
      const { added } = await loadMilestones();
      await qc.invalidateQueries({ queryKey: ["department-tasks"] });
      setDept("launch");
      toast.success(`${added} pre-launch milestone${added === 1 ? "" : "s"} added to Launch.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't add the milestones."); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const { wasRepeat, repeat, ...rest } = draft;
      await save({ data: { ...rest, ...(repeat !== wasRepeat ? { repeat } : {}) } });
      setDraft(null);
      await qc.invalidateQueries({ queryKey: ["department-tasks"] });
      toast.success("Task saved.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save the task."); }
    finally { setBusy(false); }
  };

  const quickStatus = async (t: DepartmentTask, next: TaskStatus) => {
    try {
      await save({ data: { id: t.id, department: t.department as Department, title: t.title, body: t.body, status: next, importance: t.importance, due_at: t.due_at, owner_id: t.owner_id } });
      await qc.invalidateQueries({ queryKey: ["department-tasks"] });
    } catch { toast.error("Couldn't update the status."); }
  };

  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`;

  const modeSwitch = (
    <div className="inline-flex gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Task Bank">
      {(["tasks", "plans"] as const).map((m) => <Button key={m} role="tab" aria-selected={mode === m} size="sm" variant={mode === m ? "default" : "ghost"} onClick={() => setMode(m)}>{m === "tasks" ? "Tasks" : "Plans"}</Button>)}
    </div>
  );
  if (mode === "plans") return <div className="mt-4 space-y-4">{modeSwitch}<DepartmentPlans departments={departments} editable={editable} /></div>;

  return (
    <div className="mt-4 space-y-4">
      {modeSwitch}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {departments.length > 1 && [...departments, "all" as const].map((d) => (
            <button key={d} className={chip(dept === d)} onClick={() => setDept(d)}>
              {d === "all" ? "All" : DEPARTMENT_LABEL[d]} ({mine.filter((t) => d === "all" || t.department === d).length})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
        {missingResearch > 0 && <Button size="sm" variant="outline" disabled={busy} onClick={() => void addResearch()}><Telescope className="h-4 w-4" />Load Market Research plan ({missingResearch})</Button>}
        {missingMilestones > 0 && <Button size="sm" variant="outline" disabled={busy} onClick={() => void addMilestones()}><Rocket className="h-4 w-4" />Load pre-launch milestones ({missingMilestones})</Button>}
        {editable.length > 0 && <Button size="sm" onClick={() => setDraft({ department: dept !== "all" && canEdit(dept) ? dept : editable[0]!, title: "", body: "", status: "idea", importance: "normal", due_at: null, owner_id: owners.data?.me ?? null, repeat: null, wasRepeat: null })}><Plus className="h-4 w-4" />New task</Button>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {[...TASK_STATUSES, "all" as const].map((s) => (
          <button key={s} className={chip(status === s)} onClick={() => setStatus(s)}>
            {s === "all" ? "All" : STATUS_LABEL[s]} ({inDept.filter((t) => s === "all" || t.status === s).length})
          </button>
        ))}
      </div>

      {draft && (
        <div className="space-y-3 rounded-xl border-2 border-primary bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem_10rem]">
            <Input aria-label="Task title" placeholder="Task title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <select aria-label="Department" value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value as Department })} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              {editable.map((d) => <option key={d} value={d}>{DEPARTMENT_LABEL[d]}</option>)}
            </select>
            <select aria-label="Status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as TaskStatus })} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="space-y-1 text-sm"><span className="font-semibold">Repeats</span>
              <select aria-label="Repeats" value={draft.repeat ?? ""} onChange={(e) => setDraft({ ...draft, repeat: (e.target.value || null) as TaskRepeat | null })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {TASK_REPEATS.map((r) => <option key={r} value={r}>{REPEAT_LABEL[r]}</option>)}
                <option value="">Doesn't repeat</option>
              </select></label>
            <label className="space-y-1 text-sm"><span className="font-semibold">Importance</span>
              <select aria-label="Importance" value={draft.importance} onChange={(e) => setDraft({ ...draft, importance: e.target.value as TaskImportance })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {TASK_IMPORTANCE.map((i) => <option key={i} value={i}>{IMPORTANCE_LABEL[i]}</option>)}
              </select></label>
            <label className="space-y-1 text-sm"><span className="font-semibold">Deadline{draft.importance === "top" ? " (needed for Top priority alerts)" : " (optional)"}</span>
              <Input type="datetime-local" aria-label="Deadline" value={toLocalInput(draft.due_at)} onChange={(e) => setDraft({ ...draft, due_at: fromLocalInput(e.target.value) })} /></label>
            <label className="space-y-1 text-sm"><span className="font-semibold">Owner</span>
              <select aria-label="Owner" value={draft.owner_id ?? ""} onChange={(e) => setDraft({ ...draft, owner_id: e.target.value || null })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Whole department</option>
                {(owners.data?.owners ?? []).map((o) => <option key={o.userId} value={o.userId}>{o.name}{o.userId === owners.data?.me ? " (me)" : ""}</option>)}
              </select></label>
          </div>
          <textarea aria-label="Task details" rows={10} placeholder="Goal, plan, owners, next steps…" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="w-full rounded-md border border-input bg-background p-3 text-sm" />
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || !draft.title.trim()} onClick={() => void submit()}>Save task</Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {!rows.length && <p className="text-muted-foreground">Nothing here yet.</p>}
      {rows.map((t) => (
        <div key={t.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button className="min-w-0 flex-1 text-left" onClick={() => setOpenId(openId === t.id ? null : t.id)}>
              <div className="font-semibold">{t.title}</div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className={importanceChip(t.importance)}>{IMPORTANCE_LABEL[t.importance]}</span>
                {t.due_at && t.status !== "done" && <span className={dueLabel(t.due_at).overdue ? "font-semibold text-destructive" : ""}>{dueLabel(t.due_at).text}</span>}
                {t.repeat && <span>· Repeats {REPEAT_LABEL[t.repeat].toLowerCase()}</span>}
                <span>{DEPARTMENT_LABEL[t.department as Department] ?? t.department}{ownerName(t.owner_id) ? ` · ${ownerName(t.owner_id)}` : ""} · updated {new Date(t.updated_at).toLocaleDateString()}</span>
              </div>
            </button>
            <div className="flex items-center gap-2">
              {canEdit(t.department) && <select aria-label="Status" value={t.status} onChange={(e) => void quickStatus(t, e.target.value as TaskStatus)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>}
              <Badge variant="outline">{STATUS_LABEL[t.status]}</Badge>
            </div>
          </div>
          {openId === t.id && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{t.body || "No details yet."}</p>
              {canEdit(t.department) && <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setDraft({ id: t.id, department: t.department as Department, title: t.title, body: t.body, status: t.status, importance: t.importance ?? "normal", due_at: t.due_at, owner_id: t.owner_id , repeat: t.repeat ?? null, wasRepeat: t.repeat ?? null })}><Pencil className="h-4 w-4" />Edit</Button>
                <Button size="sm" variant="ghost" onClick={async () => { if (await confirmAction({ title: "Delete this task?" })) void remove({ data: { id: t.id } }).then(() => qc.invalidateQueries({ queryKey: ["department-tasks"] })); }}><Trash2 className="h-4 w-4" />Delete</Button>
              </div>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
