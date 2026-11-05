import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Clock3, Lock, Pause, Pencil, Play, Plus, RotateCcw, Send, ShieldQuestion, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Confetti } from "@/components/Confetti";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { listRegistrationQueue } from "@/lib/registration.functions";
import { listTickets } from "@/lib/support.functions";
import type { StaffAccess } from "@/lib/departments";
import { addStep, decideStepRequest, deleteStep, editStep, listMySteps, listStepRequests, recordWin, requestStepChange, setStepLock, toggleStep, type TaskStep } from "@/lib/queue.functions";
import { canCheckStep, canEditStep, canLockSteps, completedToday, queueColumns, queueProgress, LOCK_COPY, LOCK_LABEL, type StepLock } from "@/lib/queue-board";
import { cn } from "@/lib/utils";

type Kind = "registration" | "ticket" | "task";
type Item = { ref: string; kind: Kind; title: string; detail: string; tab: string; taskId?: string };
type Row = { item_ref: string; kind: Kind; title: string; state: "working" | "paused" | "done"; note: string; updated_at: string };

const KIND_LABEL: Record<Kind, string> = { registration: "Registration", ticket: "Support ticket", task: "Task" };
const COLUMN = [
  { key: "working" as const, title: "Working on now", hint: "One thing at a time" },
  { key: "waiting" as const, title: "Waiting", hint: "Paused or not started" },
  { key: "completed" as const, title: "Completed", hint: "Today" },
];

/**
 * Admin → My Queue (Phase 4 item 10, rebuilt 2026-11-05): everything waiting on you in three columns, with a bar that
 * fills as you tick steps. Steps are yours to write; a lead can lock one, and then a change becomes a request they decide.
 * Finishing something posts a win the whole team sees.
 */
export function MyQueue({ me, access, onOpen }: { me: string; access: StaffAccess; onOpen: (tab: string) => void }) {
  const regs = useServerFn(listRegistrationQueue);
  const tickets = useServerFn(listTickets);
  const fetchSteps = useServerFn(listMySteps);
  const add = useServerFn(addStep);
  const edit = useServerFn(editStep);
  const drop = useServerFn(deleteStep);
  const tick = useServerFn(toggleStep);
  const lockFn = useServerFn(setStepLock);
  const request = useServerFn(requestStepChange);
  const requestsFn = useServerFn(listStepRequests);
  const decide = useServerFn(decideStepRequest);
  const winFn = useServerFn(recordWin);
  const qc = useQueryClient();
  const canLock = canLockSteps(access.role);

  const stepsQ = useQuery({ queryKey: ["my-steps"], queryFn: () => fetchSteps() });
  const requestsQ = useQuery({ queryKey: ["step-requests"], queryFn: () => requestsFn(), enabled: canLock });
  const steps = stepsQ.data ?? [];

  const [items, setItems] = useState<Item[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [pausing, setPausing] = useState<string>();
  const [note, setNote] = useState("");
  const [openSteps, setOpenSteps] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ id: string; title: string; request: boolean } | null>(null);
  const [burst, setBurst] = useState<{ name: string; title: string } | null>(null);

  const load = async () => {
    const out: Item[] = [];
    const [r, t, k, q] = await Promise.all([
      access.departments.includes("registration") ? regs().catch(() => []) : Promise.resolve([]),
      access.departments.includes("support") ? tickets().catch(() => []) : Promise.resolve([]),
      supabase.from("department_tasks" as never).select("id, title, department, status, due_at").eq("owner_id", me).neq("status", "done"),
      supabase.from("work_queue" as never).select("*").order("updated_at", { ascending: false }),
    ]);
    for (const o of r) if (o.state === "Ready to register" || o.state === "In progress") out.push({ ref: `reg:${o.purchaseId}`, kind: "registration", title: o.customer, detail: `${o.songs.length} song${o.songs.length === 1 ? "" : "s"} · ${o.agencies.join(", ")} · ${o.state}`, tab: "reg" });
    for (const x of t as { id: string; subject: string; status: string; name: string; category: string }[]) if (x.status !== "resolved") out.push({ ref: `ticket:${x.id}`, kind: "ticket", title: x.subject, detail: `${x.name} · ${x.category} · ${x.status.replace("_", " ")}`, tab: "support" });
    for (const x of (k.data ?? []) as { id: string; title: string; due_at: string | null }[]) out.push({ ref: `task:${x.id}`, kind: "task", title: x.title, detail: x.due_at ? `Due ${new Date(x.due_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "No deadline", tab: "tasks", taskId: x.id });
    if (q.error) toast.error("Couldn't load your queue. Run migration 20261025230000 first.");
    setItems(out);
    setRows((q.data ?? []) as Row[]);
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!burst) return; const t = setTimeout(() => setBurst(null), 2600); return () => clearTimeout(t); }, [burst]);

  const stateOf = (ref: string) => rows.find((r) => r.item_ref === ref);
  const save = async (item: Item, state: Row["state"], noteText = stateOf(item.ref)?.note ?? "") => {
    const now = new Date().toISOString();
    const others = state === "working" ? rows.filter((r) => r.state === "working" && r.item_ref !== item.ref) : [];
    const changes = [{ user_id: me, item_ref: item.ref, kind: item.kind, title: item.title, state, note: noteText, updated_at: now },
      ...others.map((r) => ({ user_id: me, item_ref: r.item_ref, kind: r.kind, title: r.title, state: "paused" as const, note: r.note, updated_at: now }))];
    const { error } = await supabase.from("work_queue" as never).upsert(changes as never, { onConflict: "user_id,item_ref" });
    if (error) { toast.error("Couldn't update your queue."); return; }
    if (state === "done" && item.taskId) await supabase.from("department_tasks" as never).update({ status: "done", updated_at: now } as never).eq("id", item.taskId);
    await load();
  };

  const finish = async (item: Item) => {
    await save(item, "done");
    try {
      const w = await winFn({ data: { itemRef: item.ref, title: item.title } });
      setBurst({ name: w.actorName, title: w.title });
      toast.success(`You Came Through: ${item.title}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Done — but the win couldn't be posted.");
    }
  };

  const stepAction = async (fn: () => Promise<unknown>, message: string) => {
    try { await fn(); await qc.invalidateQueries({ queryKey: ["my-steps"] }); toast.success(message); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't update that step."); }
  };

  const columns = queueColumns(items, rows);
  const completed = completedToday(columns.completed, rows);
  const progress = queueProgress(items, rows, steps.map((s) => ({ item_ref: s.itemRef, done_at: s.doneAt })));
  const grouped = { working: columns.working, waiting: columns.waiting, completed };

  const stepRow = (s: TaskStep) => {
    const mine = s.lock === "open";
    return (
      <li key={s.id} className={cn("group flex items-start gap-2 rounded-lg px-1.5 py-1 transition-colors", s.doneAt ? "opacity-60" : "hover:bg-accent/30")}>
        <input
          type="checkbox"
          aria-label={s.title}
          checked={!!s.doneAt}
          disabled={!canCheckStep({ ownerId: me, me })}
          onChange={() => void tick({ data: { id: s.id, done: !s.doneAt } })}
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
        />
        {editing?.id === s.id ? (
          <div className="flex-1 space-y-1">
            <Input autoFocus className="h-8" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} aria-label="Step title" />
            <div className="flex gap-1">
              <Button size="sm" className="h-7" disabled={!editing.title.trim()} onClick={() => {
                const current = editing;
                setEditing(null);
                void stepAction(
                  () => current.request ? request({ data: { id: current.id, proposedTitle: current.title.trim(), reason: "" } }) : edit({ data: { id: current.id, title: current.title.trim() } }),
                  current.request ? "Approval requested." : "Step updated.",
                );
              }}>{editing.request ? "Request" : "Save"}</Button>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <span className="min-w-0 flex-1 text-sm leading-snug">
            <span className={cn(s.doneAt && "line-through")}>{s.title}</span>
            {s.lock !== "open" && (
              <Badge variant="outline" title={LOCK_COPY[s.lock]} className="ml-2 gap-1 text-[10px]">
                {s.lock === "locked" ? <Lock className="h-3 w-3" /> : <ShieldQuestion className="h-3 w-3" />}{LOCK_LABEL[s.lock]}
              </Badge>
            )}
          </span>
        )}
        {editing?.id !== s.id && (
          <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={mine ? "Edit step" : "Request a change"}
              onClick={() => setEditing({ id: s.id, title: s.title, request: !canEditStep({ ownerId: me, me, lock: s.lock }) })}>
              {mine ? <Pencil className="h-3 w-3" /> : <Send className="h-3 w-3" />}
            </Button>
            {mine && (
              <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Remove step" onClick={() => void stepAction(() => drop({ data: { id: s.id } }), "Step removed.")}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </span>
        )}
      </li>
    );
  };

  const card = (i: Item) => {
    const mine = steps.filter((s) => s.itemRef === i.ref);
    const doneCount = mine.filter((s) => s.doneAt).length;
    const isDone = stateOf(i.ref)?.state === "done";
    return (
      <li key={i.ref} className="rounded-xl border border-border bg-card/70 p-3 transition-shadow hover:shadow-[0_0_20px_-14px_var(--primary)]">
        <div className="min-w-0">
          <p className={cn("truncate text-sm font-semibold", isDone && "line-through")}>{i.title}</p>
          <p className="text-xs text-muted-foreground">{KIND_LABEL[i.kind]} · {i.detail}</p>
          {stateOf(i.ref)?.note && <p className="mt-1 text-xs"><span className="text-muted-foreground">Left off:</span> {stateOf(i.ref)!.note}</p>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {pausing === i.ref ? (
            <div className="flex w-full items-center gap-1.5">
              <Input className="h-7" placeholder="Where you left off" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
              <Button size="sm" className="h-7" onClick={() => { void save(i, "paused", note.trim()); setPausing(undefined); setNote(""); }}>Pause</Button>
            </div>
          ) : isDone ? (
            <Button size="sm" variant="outline" className="h-7" onClick={() => void save(i, "working")}><RotateCcw className="h-3 w-3" />Reopen</Button>
          ) : stateOf(i.ref)?.state === "working" ? (
            <>
              <Button size="sm" variant="outline" className="h-7" onClick={() => { setPausing(i.ref); setNote(stateOf(i.ref)?.note ?? ""); }}><Pause className="h-3 w-3" />Pause</Button>
              <Button size="sm" className="h-7" onClick={() => void finish(i)}><Check className="h-3 w-3" />Done</Button>
            </>
          ) : (
            <Button size="sm" variant="outline" className="h-7" onClick={() => void save(i, "working")}><Play className="h-3 w-3" />Start</Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onOpen(i.tab)}>Open</Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" aria-expanded={!!openSteps[i.ref]} onClick={() => setOpenSteps({ ...openSteps, [i.ref]: !openSteps[i.ref] })}>
            <ChevronDown className={cn("h-3 w-3 transition-transform", openSteps[i.ref] && "rotate-180")} />
            Steps {mine.length ? `${doneCount}/${mine.length}` : ""}
          </Button>
        </div>

        {openSteps[i.ref] && (
          <div className="mt-2 space-y-1 border-t border-border pt-2">
            {mine.length === 0 && <p className="text-xs text-muted-foreground">Break this into steps so the bar at the top can follow it.</p>}
            <ul className="space-y-0.5">{mine.map(stepRow)}</ul>
            <div className="flex items-center gap-1.5 pt-1">
              <Input
                className="h-7"
                placeholder="Add a step and press Enter"
                aria-label="Add a step"
                value={drafts[i.ref] ?? ""}
                onChange={(e) => setDrafts({ ...drafts, [i.ref]: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || !(drafts[i.ref] ?? "").trim()) return;
                  const title = (drafts[i.ref] ?? "").trim();
                  setDrafts({ ...drafts, [i.ref]: "" });
                  void stepAction(() => add({ data: { itemRef: i.ref, title } }), "Step added.");
                }}
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Add step" disabled={!(drafts[i.ref] ?? "").trim()} onClick={() => {
                const title = (drafts[i.ref] ?? "").trim();
                setDrafts({ ...drafts, [i.ref]: "" });
                void stepAction(() => add({ data: { itemRef: i.ref, title } }), "Step added.");
              }}><Plus className="h-3 w-3" /></Button>
            </div>
            {canLock && mine.length > 0 && (
              <label className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3" />
                <span className="sr-only">Lock the newest step</span>
                <select
                  aria-label="Lock the newest step"
                  defaultValue=""
                  onChange={(e) => {
                    const mode = e.target.value as StepLock;
                    const newest = mine[mine.length - 1]!;
                    if (!mode) return;
                    void stepAction(() => lockFn({ data: { id: newest.id, lock: mode } }), mode === "open" ? "Step unlocked." : `Step set to ${LOCK_LABEL[mode].toLowerCase()}.`);
                    e.currentTarget.value = "";
                  }}
                  className="h-6 rounded border border-input bg-background px-1"
                >
                  <option value="">Lead: lock the newest step…</option>
                  <option value="open">{LOCK_LABEL.open}</option>
                  <option value="locked">{LOCK_LABEL.locked}</option>
                  <option value="approval">{LOCK_LABEL.approval}</option>
                </select>
              </label>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="mt-4 space-y-6">
      {burst && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4" role="status" aria-live="polite">
          <Confetti />
          <div className="relative rounded-2xl border-2 border-primary bg-card px-8 py-6 text-center shadow-2xl">
            <p className="text-3xl font-black">You Came Through</p>
            <p className="mt-1 text-sm text-muted-foreground">{burst.title}</p>
            <p className="mt-2 text-xs text-muted-foreground">The whole team just saw it.</p>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-border bg-card/70 p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Your day</h2>
            <p className="text-xs text-muted-foreground">
              {progress.done} of {progress.total} {progress.unit} done{progress.pct === 100 && progress.total ? " — that's all of it" : ""}
            </p>
          </div>
          <span className="text-2xl font-black text-primary">{progress.pct}%</span>
        </div>
        <Progress value={progress.pct} aria-label="Daily progress" className="mt-2 h-2" />
      </section>

      {canLock && !!requestsQ.data?.length && (
        <section className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-primary">Waiting on you: step changes</h3>
          <ul className="mt-2 space-y-2">
            {requestsQ.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background/60 p-2">
                <p className="text-sm"><span className="font-semibold">{r.requesterName}</span> wants “{r.proposedTitle ?? r.stepTitle}” <span className="text-muted-foreground">(was “{r.stepTitle}”)</span></p>
                <span className="flex gap-1">
                  <Button size="sm" className="h-7" onClick={() => void decide({ data: { id: r.id, approve: true } }).then(() => qc.invalidateQueries({ queryKey: ["step-requests"] })).then(() => qc.invalidateQueries({ queryKey: ["my-steps"] }))}>Approve</Button>
                  <Button size="sm" variant="outline" className="h-7" onClick={() => void decide({ data: { id: r.id, approve: false } }).then(() => qc.invalidateQueries({ queryKey: ["step-requests"] }))}>Decline</Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMN.map((col) => {
          const list = grouped[col.key];
          return (
            <section key={col.key} className="rounded-2xl border border-border bg-card/40 p-3">
              <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary">
                  {col.key === "waiting" && <Clock3 className="h-3.5 w-3.5" />}{col.title}
                </h3>
                <span className="text-xs text-muted-foreground">{list.length}</span>
              </div>
              <p className="mb-2 px-1 text-[11px] text-muted-foreground">{col.hint}</p>
              {list.length === 0
                ? <p className="px-1 text-sm text-muted-foreground">{col.key === "working" ? "Start something from Waiting." : col.key === "waiting" ? "Nothing waiting. Rare." : "Nothing finished yet today."}</p>
                : <ul className="space-y-2">{list.map(card)}</ul>}
            </section>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Done marks a task done and posts the win. Registrations and tickets are finished in their own tab (Open), then completed here.</p>
    </div>
  );
}
