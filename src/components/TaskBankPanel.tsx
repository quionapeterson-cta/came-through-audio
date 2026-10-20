import { useState } from "react";
import { confirmAction } from "@/components/ConfirmHost";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEPARTMENT_LABEL, type Department } from "@/lib/departments";
import { deleteTask, listTasks, saveTask, TASK_STATUSES, type DepartmentTask, type TaskStatus } from "@/lib/tasks.functions";

const STATUS_LABEL: Record<TaskStatus, string> = { idea: "Idea", planned: "Planned", in_progress: "In Progress", done: "Done" };
type Draft = { id?: string; department: Department; title: string; body: string; status: TaskStatus };

/** Each department's bank of ideas and plans for later. Rows are limited to the caller's departments by RLS. */
export function TaskBankPanel({ departments }: { departments: Department[] }) {
  const fetchTasks = useServerFn(listTasks);
  const save = useServerFn(saveTask);
  const remove = useServerFn(deleteTask);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["department-tasks"], queryFn: () => fetchTasks() });
  const [dept, setDept] = useState<Department | "all">("all");
  const [status, setStatus] = useState<TaskStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  if (q.isLoading) return <p className="mt-6 text-muted-foreground">Loading…</p>;
  if (q.isError) return <p className="mt-6 text-destructive">Couldn't load the task bank.</p>;
  const mine = (q.data ?? []).filter((t) => departments.includes(t.department as Department));
  const inDept = mine.filter((t) => dept === "all" || t.department === dept);
  const rows = inDept.filter((t) => status === "all" || t.status === status);

  const submit = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await save({ data: draft });
      setDraft(null);
      await qc.invalidateQueries({ queryKey: ["department-tasks"] });
      toast.success("Task saved.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save the task."); }
    finally { setBusy(false); }
  };

  const quickStatus = async (t: DepartmentTask, next: TaskStatus) => {
    try {
      await save({ data: { id: t.id, department: t.department as Department, title: t.title, body: t.body, status: next } });
      await qc.invalidateQueries({ queryKey: ["department-tasks"] });
    } catch { toast.error("Couldn't update the status."); }
  };

  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {departments.length > 1 && [...departments, "all" as const].map((d) => (
            <button key={d} className={chip(dept === d)} onClick={() => setDept(d)}>
              {d === "all" ? "All" : DEPARTMENT_LABEL[d]} ({mine.filter((t) => d === "all" || t.department === d).length})
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setDraft({ department: dept === "all" ? departments[0]! : dept, title: "", body: "", status: "idea" })}><Plus className="h-4 w-4" />New task</Button>
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
              {departments.map((d) => <option key={d} value={d}>{DEPARTMENT_LABEL[d]}</option>)}
            </select>
            <select aria-label="Status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as TaskStatus })} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
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
              <div className="text-sm text-muted-foreground">{DEPARTMENT_LABEL[t.department as Department] ?? t.department} · updated {new Date(t.updated_at).toLocaleDateString()}</div>
            </button>
            <div className="flex items-center gap-2">
              <select aria-label="Status" value={t.status} onChange={(e) => void quickStatus(t, e.target.value as TaskStatus)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              <Badge variant="outline">{STATUS_LABEL[t.status]}</Badge>
            </div>
          </div>
          {openId === t.id && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{t.body || "No details yet."}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setDraft({ id: t.id, department: t.department as Department, title: t.title, body: t.body, status: t.status })}><Pencil className="h-4 w-4" />Edit</Button>
                <Button size="sm" variant="ghost" onClick={async () => { if (await confirmAction({ title: "Delete this task?" })) void remove({ data: { id: t.id } }).then(() => qc.invalidateQueries({ queryKey: ["department-tasks"] })); }}><Trash2 className="h-4 w-4" />Delete</Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
