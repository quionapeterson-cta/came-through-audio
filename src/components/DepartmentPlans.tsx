import { useEffect, useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { confirmAction } from "@/components/ConfirmHost";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEPARTMENT_LABEL, type Department } from "@/lib/departments";
import { generatePlan, goalPct, quarters, SCORECARD, type PlanGoal, type PlanMilestone } from "@/lib/department-plans";

type Plan = { id: string; department: Department; title: string; period_start: string; period_end: string; goals: PlanGoal[] };
type Milestone = { id: string; plan_id: string; title: string; status: string; due_at: string | null };
type Draft = { department: Exclude<Department, "launch">; quarter: number; title: string; period_start: string; period_end: string; goals: PlanGoal[]; milestones: PlanMilestone[] };

const bar = (pct: number) => <span className="block h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${Math.max(pct, 2)}%` }} /></span>;
const dateOnly = (iso: string) => iso.slice(0, 10);

/**
 * Task Bank → Plans (Phase 4 item 9): generate a department's quarterly plan from its scorecard, edit it, create it;
 * milestones become Task Bank tasks (each done one fills the bar and counts toward the department's staff badge), and
 * goal numbers are updated by hand. Who can see and change plans is enforced by the database.
 */
export function DepartmentPlans({ departments, editable }: { departments: Department[]; editable: Department[] }) {
  const qc = useQueryClient();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const qs = quarters();
  const generatable = editable.filter((d): d is Exclude<Department, "launch"> => d !== "launch" && d in SCORECARD);

  const load = async () => {
    const [p, m] = await Promise.all([
      supabase.from("department_plans" as never).select("*").order("period_start", { ascending: false }),
      supabase.from("department_tasks" as never).select("id, plan_id, title, status, due_at").not("plan_id", "is", null).order("due_at"),
    ]);
    if (p.error) { toast.error("Couldn't load plans. Run migration 20261025220000 first."); return; }
    setPlans(((p.data ?? []) as Plan[]).filter((x) => departments.includes(x.department)));
    setMilestones((m.data ?? []) as Milestone[]);
  };
  useEffect(() => { void load(); }, [departments.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = (d: Exclude<Department, "launch">, qi = 0) => setDraft({ department: d, quarter: qi, ...generatePlan(d, qs[qi]!, DEPARTMENT_LABEL[d]) });

  async function create() {
    if (!draft) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.from("department_plans" as never).insert({ department: draft.department, title: draft.title.trim(), period_start: draft.period_start, period_end: draft.period_end, goals: draft.goals } as never).select("id").single();
      if (error || !data) throw error ?? new Error("no plan");
      const planId = (data as { id: string }).id;
      const tasks = draft.milestones.filter((m) => m.title.trim()).map((m) => ({ department: draft.department, title: m.title.trim(), body: `Milestone of ${draft.title}`, status: "planned", importance: "high", due_at: m.due, plan_id: planId }));
      if (tasks.length) { const { error: tErr } = await supabase.from("department_tasks" as never).insert(tasks as never); if (tErr) throw tErr; }
      setDraft(null);
      toast.success(`Plan created with ${tasks.length} milestone${tasks.length === 1 ? "" : "s"} in the Task Bank.`);
      await Promise.all([load(), qc.invalidateQueries({ queryKey: ["department-tasks"] })]);
    } catch { toast.error("Couldn't create the plan."); }
    finally { setBusy(false); }
  }

  async function setGoal(p: Plan, i: number, current: number) {
    const goals = p.goals.map((x, k) => (k === i ? { ...x, current } : x));
    setPlans((all) => all.map((x) => (x.id === p.id ? { ...x, goals } : x)));
    const { error } = await supabase.from("department_plans" as never).update({ goals, updated_at: new Date().toISOString() } as never).eq("id", p.id);
    if (error) toast.error("Couldn't save that number.");
  }
  async function remove(p: Plan) {
    if (!(await confirmAction({ title: `Delete "${p.title}"?`, text: "Its milestones stay in the Task Bank." }))) return;
    await supabase.from("department_plans" as never).delete().eq("id", p.id);
    void load();
  }

  return (
    <div className="space-y-5">
      {generatable.length > 0 && !draft && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-primary/60 bg-primary/5 p-4">
          <Sparkles className="h-5 w-5 text-primary" /><span className="text-sm font-semibold">Generate a quarterly plan:</span>
          {generatable.map((d) => <Button key={d} size="sm" variant="outline" onClick={() => start(d)}>{DEPARTMENT_LABEL[d]}</Button>)}
        </div>
      )}

      {draft && (
        <div className="space-y-4 rounded-xl border-2 border-primary bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <Input aria-label="Plan title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <select aria-label="Quarter" value={draft.quarter} onChange={(e) => start(draft.department, Number(e.target.value))} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              {qs.map((q, i) => <option key={q.label} value={i}>{q.label}</option>)}
            </select>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Goals (the {DEPARTMENT_LABEL[draft.department]} scorecard; set the targets with the lead)</p>
            <ul className="space-y-2">{draft.goals.map((x, i) => (
              <li key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_7rem_6rem]">
                <Input aria-label="Goal" value={x.name} onChange={(e) => setDraft({ ...draft, goals: draft.goals.map((y, k) => (k === i ? { ...y, name: e.target.value } : y)) })} />
                <Input aria-label={`Target for ${x.name}`} inputMode="decimal" value={x.target} onChange={(e) => setDraft({ ...draft, goals: draft.goals.map((y, k) => (k === i ? { ...y, target: Number(e.target.value) || 0 } : y)) })} />
                <span className="text-xs text-muted-foreground">{x.lowerIsBetter ? "at most · " : "target · "}{x.unit}</span>
              </li>))}</ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Milestones (each becomes a Task Bank task)</p>
            <ul className="space-y-2">{draft.milestones.map((m, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <Input aria-label="Milestone" className="min-w-0 flex-1" value={m.title} onChange={(e) => setDraft({ ...draft, milestones: draft.milestones.map((y, k) => (k === i ? { ...y, title: e.target.value } : y)) })} />
                <Input aria-label="Due" type="date" className="w-auto" value={dateOnly(m.due)} onChange={(e) => setDraft({ ...draft, milestones: draft.milestones.map((y, k) => (k === i ? { ...y, due: `${e.target.value}T17:00:00.000Z` } : y)) })} />
                <Button size="icon" variant="ghost" aria-label="Remove milestone" onClick={() => setDraft({ ...draft, milestones: draft.milestones.filter((_, k) => k !== i) })}><Trash2 className="h-4 w-4" /></Button>
              </li>))}</ul>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setDraft({ ...draft, milestones: [...draft.milestones, { title: "", due: `${draft.period_end}T17:00:00.000Z` }] })}><Plus className="h-4 w-4" />Add milestone</Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || !draft.title.trim()} onClick={() => void create()}>Create plan</Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {plans.length === 0 ? <p className="text-muted-foreground">No plans yet.</p> : plans.map((p) => {
        const ms = milestones.filter((m) => m.plan_id === p.id);
        const done = ms.filter((m) => m.status === "done").length;
        const can = editable.includes(p.department);
        return (
          <article key={p.id} className="space-y-3 rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="font-bold">{p.title}</h4>
              <span className="text-xs text-muted-foreground">{DEPARTMENT_LABEL[p.department]} · {p.period_start} to {p.period_end}</span>
            </div>
            <div className="space-y-1"><div className="flex justify-between text-xs"><span className="font-semibold">Milestones</span><span>{done} of {ms.length} done</span></div>{bar(ms.length ? (done / ms.length) * 100 : 0)}</div>
            <ul className="grid gap-3 sm:grid-cols-3">{p.goals.map((x, i) => (
              <li key={i} className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm">
                <div className="font-semibold leading-tight">{x.name}</div>
                <div className="flex items-center gap-2 text-xs">
                  {can ? <Input aria-label={`Current ${x.name}`} inputMode="decimal" className="h-7 w-20" defaultValue={x.current} onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== x.current) void setGoal(p, i, v); }} /> : <span className="font-semibold">{x.current}</span>}
                  <span className="text-muted-foreground">{x.lowerIsBetter ? "at most" : "of"} {x.target} {x.unit}</span>
                </div>
                {bar(goalPct(x))}
              </li>))}</ul>
            {ms.length > 0 && <ul className="space-y-1 text-sm">{ms.map((m) => <li key={m.id} className="flex items-center justify-between gap-2"><span className={m.status === "done" ? "text-muted-foreground line-through" : ""}>{m.title}</span><span className="text-xs text-muted-foreground">{m.due_at ? new Date(m.due_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}</span></li>)}</ul>}
            {can && <Button size="sm" variant="ghost" onClick={() => void remove(p)}><Trash2 className="h-4 w-4" />Delete plan</Button>}
          </article>
        );
      })}
    </div>
  );
}
