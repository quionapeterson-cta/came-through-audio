import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Pause, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listRegistrationQueue } from "@/lib/registration.functions";
import { listTickets } from "@/lib/support.functions";
import type { StaffAccess } from "@/lib/departments";

type Kind = "registration" | "ticket" | "task";
type Item = { ref: string; kind: Kind; title: string; detail: string; tab: string; taskId?: string };
type Row = { item_ref: string; kind: Kind; title: string; state: "working" | "paused" | "done"; note: string; updated_at: string };

const KIND_LABEL: Record<Kind, string> = { registration: "Registration", ticket: "Support ticket", task: "Task" };

/**
 * Admin → My Queue (Phase 4 item 10): everything waiting on you in one list (registrations, support tickets, your
 * tasks). Start one; if something urgent comes in, pause it with a note on where you left off, handle the other, then
 * resume. Only one item is "working" at a time. Your queue is private to you.
 */
export function MyQueue({ me, access, onOpen }: { me: string; access: StaffAccess; onOpen: (tab: string) => void }) {
  const regs = useServerFn(listRegistrationQueue);
  const tickets = useServerFn(listTickets);
  const [items, setItems] = useState<Item[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [pausing, setPausing] = useState<string>();
  const [note, setNote] = useState("");

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

  const stateOf = (ref: string) => rows.find((r) => r.item_ref === ref);
  const save = async (item: Item, state: Row["state"], noteText = stateOf(item.ref)?.note ?? "") => {
    const now = new Date().toISOString();
    // Starting one pauses whatever else was being worked on.
    const others = state === "working" ? rows.filter((r) => r.state === "working" && r.item_ref !== item.ref) : [];
    const changes = [{ user_id: me, item_ref: item.ref, kind: item.kind, title: item.title, state, note: noteText, updated_at: now },
      ...others.map((r) => ({ user_id: me, item_ref: r.item_ref, kind: r.kind, title: r.title, state: "paused" as const, note: r.note, updated_at: now }))];
    const { error } = await supabase.from("work_queue" as never).upsert(changes as never, { onConflict: "user_id,item_ref" });
    if (error) { toast.error("Couldn't update your queue."); return; }
    if (state === "done" && item.taskId) await supabase.from("department_tasks" as never).update({ status: "done", updated_at: now } as never).eq("id", item.taskId);
    void load();
  };

  const working = items.filter((i) => stateOf(i.ref)?.state === "working");
  const paused = items.filter((i) => stateOf(i.ref)?.state === "paused");
  // Not started yet (items marked done here drop off the list).
  const waiting = items.filter((i) => !stateOf(i.ref));

  const row = (i: Item, actions: React.ReactNode) => (
    <li key={i.ref} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
      <div className="min-w-0"><p className="truncate font-semibold">{i.title}</p><p className="text-xs text-muted-foreground">{KIND_LABEL[i.kind]} · {i.detail}</p>
        {stateOf(i.ref)?.note && <p className="mt-1 text-xs">Left off: {stateOf(i.ref)!.note}</p>}</div>
      <div className="flex flex-wrap gap-2">{actions}<Button size="sm" variant="ghost" onClick={() => onOpen(i.tab)}>Open</Button></div>
    </li>
  );

  return (
    <div className="mt-4 space-y-6">
      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">Working on now</h3>
        {working.length === 0 ? <p className="text-sm text-muted-foreground">Nothing started. Pick something below.</p> : <ul className="space-y-2">{working.map((i) => row(i, pausing === i.ref
          ? <div className="flex flex-wrap items-center gap-2"><Input className="h-8 w-56" placeholder="Where you left off (optional)" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
              <Button size="sm" onClick={() => { void save(i, "paused", note.trim()); setPausing(undefined); setNote(""); }}>Pause</Button></div>
          : <><Button size="sm" variant="outline" onClick={() => { setPausing(i.ref); setNote(stateOf(i.ref)?.note ?? ""); }}><Pause className="h-4 w-4" />Pause</Button>
              <Button size="sm" onClick={() => void save(i, "done")}><Check className="h-4 w-4" />Done</Button></>))}</ul>}
      </section>
      {paused.length > 0 && <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">Paused</h3>
        <ul className="space-y-2">{paused.map((i) => row(i, <Button size="sm" onClick={() => void save(i, "working")}><RotateCcw className="h-4 w-4" />Resume</Button>))}</ul>
      </section>}
      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">Waiting <span className="opacity-70">{waiting.length}</span></h3>
        {waiting.length === 0 ? <p className="text-sm text-muted-foreground">You're all caught up.</p> : <ul className="space-y-2">{waiting.map((i) => row(i, <Button size="sm" variant="outline" onClick={() => void save(i, "working")}><Play className="h-4 w-4" />Start</Button>))}</ul>}
      </section>
      <p className="text-xs text-muted-foreground">Done here marks a task done; registrations and tickets are finished in their own tabs (Open), then marked done here.</p>
    </div>
  );
}
