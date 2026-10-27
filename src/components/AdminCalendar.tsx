import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { confirmAction } from "@/components/ConfirmHost";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ASSIGNABLE_DEPARTMENTS, DEPARTMENT_LABEL, type Department, type StaffAccess } from "@/lib/departments";

type CalEvent = { id: string; owner_id: string; department: Department | null; title: string; notes: string; starts_at: string; ends_at: string | null; all_day: boolean };
type Deadline = { id: string; department: Department; title: string; due_at: string; status?: string };
type Draft = { id?: string; title: string; notes: string; date: string; start: string; end: string; allDay: boolean; calendar: Department | "private" };

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/**
 * Admin → Calendar (Phase 4 item 8): private entries only their owner sees; each department's calendar is shared inside
 * it; department leads, Project Managers and super admins see every department's. Task Bank deadlines show too.
 * Who sees what is enforced by the database; this screen only draws it.
 */
export function AdminCalendar({ me, access }: { me: string; access: StaffAccess }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [filter, setFilter] = useState<Department | "private" | "all">("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  // Calendars someone can add to: private, plus the departments they work in.
  const mine = access.departments.filter((d) => (ASSIGNABLE_DEPARTMENTS as readonly string[]).includes(d) || d === "launch");

  const load = async () => {
    const from = new Date(month.getFullYear(), month.getMonth() - 1, 20).toISOString();
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 12).toISOString();
    const [e, t] = await Promise.all([
      supabase.from("calendar_events" as never).select("*").gte("starts_at", from).lte("starts_at", to).order("starts_at"),
      supabase.from("department_tasks" as never).select("id, department, title, due_at, status").not("due_at", "is", null).gte("due_at", from).lte("due_at", to),
    ]);
    if (e.error) toast.error("Couldn't load the calendar. Run migrations 20261025210000 and 20261025210100 first.");
    setEvents((e.data ?? []) as CalEvent[]);
    setDeadlines(((t.data ?? []) as Deadline[]));
  };
  useEffect(() => { void load(); }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = (d: Department | null) => filter === "all" || (filter === "private" ? d === null : d === filter);
  const seen = useMemo(() => [...new Set([...events.map((e) => e.department), ...deadlines.map((d) => d.department)].filter((d): d is Department => !!d))], [events, deadlines]);
  const days = useMemo(() => {
    const start = new Date(month); start.setDate(1 - start.getDay());
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [month]);
  const onDay = (day: string) => ({
    ev: events.filter((e) => shown(e.department) && ymd(new Date(e.starts_at)) === day),
    due: deadlines.filter((d) => shown(d.department) && ymd(new Date(d.due_at)) === day),
  });
  const today = ymd(new Date());
  const upcoming = [...events.filter((e) => shown(e.department)).map((e) => ({ at: e.starts_at, e })), ...deadlines.filter((d) => shown(d.department) && d.status !== "done").map((d) => ({ at: d.due_at, d }))]
    .filter((x) => x.at >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.at.localeCompare(b.at)).slice(0, 12);

  const open = (day: string, e?: CalEvent) => setDraft(e
    ? { id: e.id, title: e.title, notes: e.notes, date: ymd(new Date(e.starts_at)), start: e.all_day ? "" : time24(e.starts_at), end: e.ends_at && !e.all_day ? time24(e.ends_at) : "", allDay: e.all_day, calendar: e.department ?? "private" }
    : { title: "", notes: "", date: day, start: "10:00", end: "11:00", allDay: false, calendar: "private" });

  async function save() {
    if (!draft || !draft.title.trim()) return;
    const startsAt = draft.allDay ? new Date(`${draft.date}T00:00`) : new Date(`${draft.date}T${draft.start || "09:00"}`);
    const endsAt = !draft.allDay && draft.end ? new Date(`${draft.date}T${draft.end}`) : null;
    if (endsAt && endsAt < startsAt) { toast.error("The end time is before the start."); return; }
    setBusy(true);
    const row = { title: draft.title.trim(), notes: draft.notes.trim(), starts_at: startsAt.toISOString(), ends_at: endsAt?.toISOString() ?? null, all_day: draft.allDay,
      department: draft.calendar === "private" ? null : draft.calendar, updated_at: new Date().toISOString() };
    const { error } = draft.id ? await supabase.from("calendar_events" as never).update(row as never).eq("id", draft.id) : await supabase.from("calendar_events" as never).insert(row as never);
    setBusy(false);
    if (error) { toast.error("Couldn't save that entry."); return; }
    setDraft(null);
    toast.success("Saved to the calendar.");
    void load();
  }
  async function remove(id: string) {
    if (!(await confirmAction({ title: "Delete this entry?" }))) return;
    await supabase.from("calendar_events" as never).delete().eq("id", id);
    setDraft(null);
    void load();
  }

  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`;
  const evClass = (e: CalEvent) => e.department ? "bg-primary/15 text-foreground" : "bg-ink text-ink-foreground";
  const owned = draft?.id ? events.find((e) => e.id === draft.id)?.owner_id === me : true;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></Button>
          <h3 className="w-44 text-center text-lg font-bold">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h3>
          <Button size="icon" variant="outline" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></Button>
          <Button size="sm" variant="ghost" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</Button>
        </div>
        <Button size="sm" onClick={() => open(today)}><Plus className="h-4 w-4" />New entry</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={chip(filter === "private")} onClick={() => setFilter("private")}><Lock className="mr-1 inline h-3 w-3" />Private</button>
        {seen.map((d) => <button key={d} className={chip(filter === d)} onClick={() => setFilter(d)}>{DEPARTMENT_LABEL[d]}</button>)}
        <button className={chip(filter === "all")} onClick={() => setFilter("all")}>All</button>
      </div>
      <p className="text-xs text-muted-foreground"><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-ink align-middle" />Private · <span className="mx-1 inline-block h-2.5 w-2.5 rounded-sm bg-primary/30 align-middle" />Department · <span className="mx-1 inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-primary align-middle" />Task deadline</p>

      {draft && (
        <div className="space-y-3 rounded-xl border-2 border-primary bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
            <Input aria-label="Title" placeholder="What's happening" value={draft.title} disabled={!owned} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <select aria-label="Calendar" value={draft.calendar} disabled={!owned} onChange={(e) => setDraft({ ...draft, calendar: e.target.value as Draft["calendar"] })} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              {mine.map((d) => <option key={d} value={d}>{DEPARTMENT_LABEL[d]} calendar</option>)}
              <option value="private">Private (only you)</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Input type="date" aria-label="Date" className="w-auto" value={draft.date} disabled={!owned} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            {!draft.allDay && <>
              <Input type="time" aria-label="Starts" className="w-auto" value={draft.start} disabled={!owned} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
              <span className="text-sm text-muted-foreground">to</span>
              <Input type="time" aria-label="Ends" className="w-auto" value={draft.end} disabled={!owned} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
            </>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={draft.allDay} disabled={!owned} onChange={(e) => setDraft({ ...draft, allDay: e.target.checked })} />All day</label>
          </div>
          <textarea aria-label="Notes" rows={3} placeholder="Notes (optional)" value={draft.notes} disabled={!owned} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="w-full rounded-md border border-input bg-background p-3 text-sm" />
          <div className="flex flex-wrap gap-2">
            {owned && <Button size="sm" disabled={busy || !draft.title.trim()} onClick={() => void save()}>Save</Button>}
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>{owned ? "Cancel" : "Close"}</Button>
            {owned && draft.id && <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void remove(draft.id!)}><Trash2 className="h-4 w-4" />Delete</Button>}
            {!owned && <span className="text-xs text-muted-foreground">Only the person who added it can change it.</span>}
          </div>
        </div>
      )}

      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <div className="grid grid-cols-7 bg-muted text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">{WEEK.map((d) => <div key={d} className="py-2">{d}</div>)}</div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const key = ymd(d), { ev, due } = onDay(key), out = d.getMonth() !== month.getMonth();
            return (
              <div key={key} className={`min-h-28 border-t border-l border-border p-1.5 first:border-l-0 [&:nth-child(7n+1)]:border-l-0 ${out ? "bg-muted/40 text-muted-foreground" : ""}`}>
                <button type="button" onClick={() => open(key)} className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${key === today ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} aria-label={`Add an entry on ${d.toDateString()}`}>{d.getDate()}</button>
                <div className="space-y-1">
                  {ev.map((e) => <button key={e.id} type="button" onClick={() => open(key, e)} className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium ${evClass(e)}`} title={e.title}>{e.all_day ? "" : `${time(e.starts_at)} `}{e.title}</button>)}
                  {/* Done tasks stay on their day, crossed off (founder, 2026-10-27). */}
                  {due.map((t) => t.status === "done"
                    ? <div key={t.id} className="truncate rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground line-through" title={`Done: ${t.title}`}>✓ {t.title}</div>
                    : <div key={t.id} className="truncate rounded border border-dashed border-primary px-1.5 py-0.5 text-[11px]" title={`Task deadline: ${t.title}`}>Due: {t.title}</div>)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <section className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Coming up</h4>
        {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">Nothing coming up on these calendars.</p> : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {upcoming.map((x, i) => "e" in x && x.e
              ? <li key={i}><button type="button" onClick={() => open(ymd(new Date(x.e.starts_at)), x.e)} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-muted">
                  <span className="font-semibold">{x.e.department ? "" : "🔒 "}{x.e.title}</span>
                  <span className="text-xs text-muted-foreground">{x.e.department ? DEPARTMENT_LABEL[x.e.department] : "Private"} · {new Date(x.e.starts_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}{x.e.all_day ? "" : ` · ${time(x.e.starts_at)}`}</span></button></li>
              : "d" in x && x.d ? <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                  <span>Due: {x.d.title}</span>
                  <span className="text-xs text-muted-foreground">{DEPARTMENT_LABEL[x.d.department] ?? x.d.department} · {new Date(x.d.due_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span></li> : null)}
          </ul>
        )}
      </section>
    </div>
  );
}

function time24(iso: string) { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
