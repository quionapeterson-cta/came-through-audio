import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { confirmAction } from "@/components/ConfirmHost";
import { CalendarFeedPanel } from "@/components/CalendarFeedPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ASSIGNABLE_DEPARTMENTS, DEPARTMENT_LABEL, type Department, type StaffAccess } from "@/lib/departments";
import {
  ADMIN_CALENDAR_VIEWS,
  ADMIN_CALENDAR_VIEW_LABEL,
  type AdminCalendarView,
} from "@/lib/admin-calendar";

type CalEvent = { id: string; owner_id: string; department: Department | null; title: string; notes: string; starts_at: string; ends_at: string | null; all_day: boolean };
type Deadline = { id: string; department: Department; title: string; due_at: string; status?: string };
type Draft = { id?: string; title: string; notes: string; date: string; start: string; end: string; allDay: boolean; calendar: Department | "private" };

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const addDays = (d: Date, n: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
};
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfWeek = (d: Date) => addDays(startOfDay(d), -startOfDay(d).getDay());
const byStart = (a: CalEvent, b: CalEvent) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
const byDeadline = (a: Deadline, b: Deadline) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime();

/** The rows each view needs. Month keeps exactly the window it always had; the other views look around their anchor. */
function loadWindow(view: AdminCalendarView, month: Date, anchor: Date): [string, string] {
  if (view === "month") {
    return [
      new Date(month.getFullYear(), month.getMonth() - 1, 20).toISOString(),
      new Date(month.getFullYear(), month.getMonth() + 1, 12).toISOString(),
    ];
  }
  if (view === "week") return [addDays(startOfWeek(anchor), -7).toISOString(), addDays(startOfWeek(anchor), 21).toISOString()];
  if (view === "day") return [addDays(anchor, -7).toISOString(), addDays(anchor, 8).toISOString()];
  // Agenda lists the next 90 days from its anchor, with a week behind and a month past the end already loaded.
  return [addDays(startOfDay(anchor), -7).toISOString(), addDays(startOfDay(anchor), 120).toISOString()];
}

function periodLabel(view: AdminCalendarView, month: Date, anchor: Date): string {
  if (view === "month") return month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  if (view === "week") {
    const first = startOfWeek(anchor);
    const last = addDays(first, 6);
    const sameMonth = first.getMonth() === last.getMonth();
    const left = first.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const right = last.toLocaleDateString(undefined, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
    return `${left} – ${right}, ${last.getFullYear()}`;
  }
  if (view === "day") return anchor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const end = addDays(startOfDay(anchor), 89);
  return `${anchor.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

/**
 * Admin → Calendar (Phase 4 item 8): private entries only their owner sees; each department's calendar is shared inside
 * it; department leads, Project Managers and super admins see every department's. Task Bank deadlines show too.
 * Who sees what is enforced by the database; this screen only draws it.
 *
 * Month, Week, Day and Agenda are four ways of reading the same rows (founder spec, 2026-11-19). Month is unchanged;
 * each other view keeps its own anchor day, so stepping a week and then switching to Day lands on that week's day
 * rather than jumping back to today. The personal .ics feed below the calendar carries the same entries off-screen.
 */
export function AdminCalendar({ me, access }: { me: string; access: StaffAccess }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  // Week, Day and Agenda read from one anchor day. It starts on today and follows whichever month was on screen.
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [view, setView] = useState<AdminCalendarView>("month");
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [filter, setFilter] = useState<Department | "private" | "all">("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  // Calendars someone can add to: private, plus the departments they work in.
  const mine = access.departments.filter((d) => (ASSIGNABLE_DEPARTMENTS as readonly string[]).includes(d) || d === "launch");

  const [from, to] = useMemo(() => loadWindow(view, month, anchor), [view, month, anchor]);
  const load = async () => {
    const [e, t] = await Promise.all([
      supabase.from("calendar_events" as never).select("*").gte("starts_at", from).lte("starts_at", to).order("starts_at"),
      supabase.from("department_tasks" as never).select("id, department, title, due_at, status").not("due_at", "is", null).gte("due_at", from).lte("due_at", to),
    ]);
    if (e.error) toast.error("Couldn't load the calendar. Run migrations 20261025210000 and 20261025210100 first.");
    setEvents((e.data ?? []) as CalEvent[]);
    setDeadlines(((t.data ?? []) as Deadline[]));
  };
  useEffect(() => { void load(); }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i)), [anchor]);
  const anchorDay = startOfDay(anchor);
  const dayKey = ymd(anchorDay);
  const dayEvents = events.filter((e) => shown(e.department) && ymd(new Date(e.starts_at)) === dayKey).sort(byStart);
  const dayDeadlines = deadlines.filter((d) => shown(d.department) && ymd(new Date(d.due_at)) === dayKey).sort(byDeadline);

  const agenda = useMemo(() => {
    const fromMs = startOfDay(anchor).getTime();
    const toMs = addDays(startOfDay(anchor), 90).getTime();
    const rows: ({ at: string; event: CalEvent } | { at: string; deadline: Deadline })[] = [
      ...events.filter((e) => shown(e.department)).map((e) => ({ at: e.starts_at, event: e })),
      ...deadlines.filter((d) => shown(d.department)).map((d) => ({ at: d.due_at, deadline: d })),
    ];
    const window = rows
      .filter((row) => { const at = new Date(row.at).getTime(); return at >= fromMs && at < toMs; })
      .sort((a, b) => a.at.localeCompare(b.at));
    const grouped = new Map<string, typeof window>();
    for (const row of window) {
      const key = ymd(new Date(row.at));
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    }
    return [...grouped.entries()];
  }, [events, deadlines, filter, anchor]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /** Arrows move the unit the view is showing: a month, a week, a day, or 30 days of agenda. */
  function step(dir: -1 | 1) {
    if (view === "month") setMonth(new Date(month.getFullYear(), month.getMonth() + dir, 1));
    else if (view === "week") setAnchor((current) => addDays(current, dir * 7));
    else if (view === "day") setAnchor((current) => addDays(current, dir));
    else setAnchor((current) => addDays(current, dir * 30));
  }

  /**
   * Switching view keeps the period being looked at. Going to Week or Day opens the month on screen rather than today,
   * and coming back to Month shows the month the anchor landed in, so a week stepped into December returns to December.
   */
  function switchView(next: AdminCalendarView) {
    setView(next);
    if (next === "month") {
      setMonth((current) => (current.getFullYear() === anchor.getFullYear() && current.getMonth() === anchor.getMonth()
        ? current
        : new Date(anchor.getFullYear(), anchor.getMonth(), 1)));
      return;
    }
    setAnchor((current) => (current.getFullYear() === month.getFullYear() && current.getMonth() === month.getMonth()
      ? current
      : startOfDay(month)));
  }

  function goToday() {
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setAnchor(startOfDay(now));
  }

  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`;
  const evClass = (e: CalEvent) => e.department ? "bg-primary/15 text-foreground" : "bg-ink text-ink-foreground";
  const owned = draft?.id ? events.find((e) => e.id === draft.id)?.owner_id === me : true;
  const dayHeading = new Date(`${dayKey}T00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" aria-label={`Previous ${ADMIN_CALENDAR_VIEW_LABEL[view].toLowerCase()}`} onClick={() => step(-1)}><ChevronLeft /></Button>
          <h3 className="min-w-44 text-center text-lg font-bold">{periodLabel(view, month, anchor)}</h3>
          <Button size="icon" variant="outline" aria-label={`Next ${ADMIN_CALENDAR_VIEW_LABEL[view].toLowerCase()}`} onClick={() => step(1)}><ChevronRight /></Button>
          <Button size="sm" variant="ghost" onClick={goToday}>Today</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Calendar view" className="flex overflow-hidden rounded-full border border-border">
            {ADMIN_CALENDAR_VIEWS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={option === view}
                onClick={() => switchView(option)}
                className={`px-3 py-1 text-xs font-semibold ${option === view ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {ADMIN_CALENDAR_VIEW_LABEL[option]}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => open(view === "month" ? today : dayKey)}><Plus className="h-4 w-4" />New entry</Button>
        </div>
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

      {view === "month" && (
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
      )}

      {view === "week" && (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-7 sm:divide-x sm:divide-y-0">
            {weekDays.map((d) => {
              const key = ymd(d), { ev, due } = onDay(key), isToday = key === today;
              return (
                <div key={key} className={`min-h-44 p-2 ${isToday ? "bg-primary/5" : ""}`}>
                  <div className="mb-2 flex items-center justify-between gap-1">
                    <button type="button" onClick={() => { setAnchor(startOfDay(d)); setView("day"); }} className="rounded px-1 text-left hover:bg-muted" aria-label={`Open ${d.toDateString()}`}>
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{WEEK[d.getDay()]}</span>
                      <span className={`mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm font-bold ${isToday ? "bg-primary text-primary-foreground" : ""}`}>{d.getDate()}</span>
                    </button>
                    <button type="button" onClick={() => open(key)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Add an entry on ${d.toDateString()}`}><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="space-y-1">
                    {ev.sort(byStart).map((e) => <button key={e.id} type="button" onClick={() => open(key, e)} className={`block w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-medium ${evClass(e)}`} title={e.title}>{e.all_day ? "" : `${time(e.starts_at)} `}{e.title}</button>)}
                    {due.sort(byDeadline).map((t) => t.status === "done"
                      ? <div key={t.id} className="truncate rounded border border-border px-1.5 py-1 text-[11px] text-muted-foreground line-through" title={`Done: ${t.title}`}>✓ {t.title}</div>
                      : <div key={t.id} className="truncate rounded border border-dashed border-primary px-1.5 py-1 text-[11px]" title={`Task deadline: ${t.title}`}>Due: {t.title}</div>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "day" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2">
            <p className="text-sm font-bold">{dayHeading}{dayKey === today && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary-foreground">Today</span>}</p>
            <Button size="sm" variant="outline" onClick={() => open(dayKey)}><Plus className="h-4 w-4" />Add to this day</Button>
          </div>
          {dayEvents.length === 0 && dayDeadlines.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nothing on this day.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {dayEvents.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => open(dayKey, e)} className="flex w-full flex-wrap items-start justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-muted">
                    <span className="min-w-0">
                      <span className="block font-semibold">{e.department ? "" : "🔒 "}{e.title}</span>
                      {e.notes && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{e.notes}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">{e.all_day ? "All day" : `${time(e.starts_at)}${e.ends_at ? ` – ${time(e.ends_at)}` : ""}`} · {e.department ? DEPARTMENT_LABEL[e.department] : "Private"}</span>
                  </button>
                </li>
              ))}
              {dayDeadlines.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className={t.status === "done" ? "text-muted-foreground line-through" : ""}>{t.status === "done" ? "✓ " : "Due: "}{t.title}</span>
                  <span className="text-xs text-muted-foreground">{DEPARTMENT_LABEL[t.department] ?? t.department} · Task deadline</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {view === "agenda" && (
        <div className="space-y-3">
          {agenda.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nothing in the next 90 days on these calendars.</p>
          ) : agenda.map(([key, rows]) => (
            <section key={key} className="overflow-hidden rounded-xl border border-border">
              <h4 className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/60 px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {new Date(`${key}T00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                {key === today && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] tracking-normal text-primary-foreground">Today</span>}
              </h4>
              <ul className="divide-y divide-border">
                {rows.map((row) => "event" in row ? (
                  <li key={`e-${row.event.id}`}>
                    <button type="button" onClick={() => open(ymd(new Date(row.event.starts_at)), row.event)} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-muted">
                      <span className="font-semibold">{row.event.department ? "" : "🔒 "}{row.event.title}</span>
                      <span className="text-xs text-muted-foreground">{row.event.all_day ? "All day" : time(row.event.starts_at)} · {row.event.department ? DEPARTMENT_LABEL[row.event.department] : "Private"}</span>
                    </button>
                  </li>
                ) : (
                  <li key={`d-${row.deadline.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                    <span className={row.deadline.status === "done" ? "text-muted-foreground line-through" : ""}>{row.deadline.status === "done" ? "✓ " : "Due: "}{row.deadline.title}</span>
                    <span className="text-xs text-muted-foreground">{DEPARTMENT_LABEL[row.deadline.department] ?? row.deadline.department} · Task deadline</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Month keeps its "Coming up" list; Agenda is already the longer version of it. */}
      {view !== "agenda" && (
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
      )}

      <CalendarFeedPanel me={me} />
    </div>
  );
}

function time24(iso: string) { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
