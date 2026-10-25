import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlarmClock, Bell, BellOff, PartyPopper, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listTasks, type DepartmentTask } from "@/lib/tasks.functions";
import { IMPORTANCE_LABEL, dueLabel, importanceChip, signInMoment, snoozeUntil, sortTasks } from "@/lib/task-alerts";

const SNOOZE_KEY = "cta.taskSnooze";
const SOUND_KEY = "cta.adminSound";
const SEEN_KEY = "cta.adminWelcomeSeen";
const read = <T,>(k: string, fallback: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };

/** Short original tones made in the browser (no audio files): a two-note alarm, or a rising cheer. */
function playTone(kind: "alarm" | "cheer") {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return false;
  const ctx = new AC();
  if (ctx.state === "suspended") { void ctx.close(); return false; }
  const notes = kind === "alarm" ? [880, 660, 880, 660] : [523, 659, 784, 1047];
  notes.forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = kind === "alarm" ? "square" : "triangle";
    o.frequency.value = f;
    const t = ctx.currentTime + i * (kind === "alarm" ? 0.22 : 0.12);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(kind === "alarm" ? 0.08 : 0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.22);
  });
  setTimeout(() => void ctx.close(), 1500);
  return true;
}

/** A short burst of brand-colored confetti (skipped with reduced motion). */
function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current, x = c?.getContext("2d");
    if (!c || !x || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    c.width = c.offsetWidth; c.height = c.offsetHeight;
    const colors = ["#004AAD", "#4D8CFF", "#ffffff", "#FFD700"];
    const bits = Array.from({ length: 120 }, () => ({ x: c.width / 2, y: c.height / 3, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 10 - 4, r: Math.random() * 6 + 3, c: colors[Math.floor(Math.random() * colors.length)]!, a: Math.random() * 6 }));
    let raf = 0, frame = 0;
    const tick = () => {
      x.clearRect(0, 0, c.width, c.height);
      for (const b of bits) { b.vy += 0.35; b.x += b.vx; b.y += b.vy; b.a += 0.2; x.fillStyle = b.c; x.save(); x.translate(b.x, b.y); x.rotate(b.a); x.fillRect(-b.r / 2, -b.r / 4, b.r, b.r / 2); x.restore(); }
      if (++frame < 150) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}

/**
 * What Admin shows when a staff member signs in (once per browser session): any open Top priority task for them comes
 * first as a full-screen alert with its deadline; otherwise a celebration of their last completed task and their next
 * one. Also renders the bell (tasks due within 24 hours or overdue) for the header.
 */
export function AdminWelcome({ me, onOpenTasks }: { me: string; onOpenTasks: () => void }) {
  const fetchTasks = useServerFn(listTasks);
  const q = useQuery({ queryKey: ["department-tasks"], queryFn: () => fetchTasks() });
  const [snoozed, setSnoozed] = useState<Record<string, number>>(() => read(SNOOZE_KEY, {}));
  const [sound, setSound] = useState<boolean>(() => read(SOUND_KEY, !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches));
  const [open, setOpen] = useState(false);
  const [heard, setHeard] = useState(false);
  const tasks = q.data ?? [];
  const moment = useMemo(() => signInMoment(tasks, me, snoozed), [tasks, me, snoozed]);
  const alert = moment.urgent[0];

  useEffect(() => {
    if (!q.data) return;
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === me; sessionStorage.setItem(SEEN_KEY, me); } catch { /* storage blocked */ }
    if (alert || !seen) setOpen(!!(alert || moment.last || moment.next));
  }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && sound) setHeard(playTone(alert ? "alarm" : "cheer")); }, [open, alert?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const snooze = (t: DepartmentTask) => { const next = { ...snoozed, [t.id]: snoozeUntil(t) }; setSnoozed(next); write(SNOOZE_KEY, next); };
  const toggleSound = () => { const v = !sound; setSound(v); write(SOUND_KEY, v); };

  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={alert ? "Top priority task needs attention" : "Welcome back"} className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4">
      {!alert && <Confetti />}
      <div className={`relative w-full max-w-lg overflow-hidden rounded-2xl border-2 bg-card text-card-foreground shadow-2xl ${alert ? "border-destructive" : "border-primary"}`}>
        {alert && <div className="flex items-center gap-2 bg-destructive px-5 py-3 text-sm font-bold uppercase tracking-[2px] text-destructive-foreground"><AlarmClock className="h-5 w-5" />Needs immediate attention</div>}
        <div className="space-y-4 p-6">
          {alert ? <>
            <h2 className="text-2xl font-bold">{alert.title}</h2>
            {alert.due_at
              ? <p className={`text-lg font-semibold ${dueLabel(alert.due_at).overdue ? "text-destructive" : ""}`}>{dueLabel(alert.due_at).text} · {new Date(alert.due_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>
              : <p className="text-sm text-muted-foreground">No deadline set. Add one so reminders go out.</p>}
            {moment.urgent.length > 1 && <p className="text-sm text-muted-foreground">+{moment.urgent.length - 1} more Top priority task{moment.urgent.length === 2 ? "" : "s"} after this one.</p>}
          </> : <>
            <div className="flex items-center gap-2 text-primary"><PartyPopper className="h-6 w-6" /><span className="text-sm font-bold uppercase tracking-[2px]">Welcome back</span></div>
            {moment.last
              ? <p className="text-xl font-bold">You Came Through: {moment.last.title}<span className="block text-sm font-normal text-muted-foreground">Completed {new Date(moment.last.completed_at!).toLocaleDateString(undefined, { month: "long", day: "numeric" })}</span></p>
              : <p className="text-xl font-bold">Ready when you are.</p>}
            {moment.next && <div className="rounded-xl bg-muted p-4">
              <p className="text-xs font-bold uppercase tracking-[2px] text-primary">Your next task</p>
              <p className="mt-1 font-semibold">{moment.next.title}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><span className={importanceChip(moment.next.importance)}>{IMPORTANCE_LABEL[moment.next.importance ?? "normal"]}</span>{moment.next.due_at && dueLabel(moment.next.due_at).text}</p>
            </div>}
          </>}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button onClick={() => { setOpen(false); onOpenTasks(); }} variant={alert ? "destructive" : "default"}>Open task{alert ? "" : "s"}</Button>
            {alert ? <Button variant="outline" onClick={() => snooze(alert)}>Snooze 1 hour</Button> : <Button variant="ghost" onClick={() => setOpen(false)}>Let's go</Button>}
            {sound && !heard && <Button variant="ghost" size="sm" onClick={() => setHeard(playTone(alert ? "alarm" : "cheer"))}><Volume2 />Tap to hear</Button>}
            <Button variant="ghost" size="icon" className="ml-auto" aria-label={sound ? "Mute admin sounds" : "Turn admin sounds on"} onClick={toggleSound}>{sound ? <Volume2 /> : <VolumeX />}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Header bell: Top/High tasks due within 24 hours or overdue, for the signed-in staff member or their department. */
export function TaskBell({ me, onOpenTasks }: { me: string; onOpenTasks: () => void }) {
  const fetchTasks = useServerFn(listTasks);
  const q = useQuery({ queryKey: ["department-tasks"], queryFn: () => fetchTasks() });
  const [show, setShow] = useState(false);
  const soon = sortTasks((q.data ?? []).filter((t) => t.status !== "done" && t.due_at && (t.owner_id === me || !t.owner_id) && dueLabel(t.due_at).ms < 24 * 3600_000));
  return (
    <div className="relative">
      <Button variant="ghost" size="icon" aria-label={`${soon.length} task${soon.length === 1 ? "" : "s"} due soon`} onClick={() => setShow(!show)}>
        {soon.length ? <Bell /> : <BellOff className="opacity-60" />}
        {soon.length > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">{soon.length}</span>}
      </Button>
      {show && <div className="absolute right-0 z-50 mt-2 w-80 space-y-2 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[2px] text-primary">Due within 24 hours</p>
        {!soon.length && <p className="text-sm text-muted-foreground">Nothing due soon.</p>}
        {soon.slice(0, 8).map((t) => <button key={t.id} type="button" onClick={() => { setShow(false); onOpenTasks(); }} className="block w-full rounded-lg p-2 text-left text-sm hover:bg-accent/40">
          <span className="font-semibold">{t.title}</span>
          <span className={`block text-xs ${dueLabel(t.due_at!).overdue ? "text-destructive" : "text-muted-foreground"}`}>{IMPORTANCE_LABEL[t.importance ?? "normal"]} · {dueLabel(t.due_at!).text}</span>
        </button>)}
      </div>}
    </div>
  );
}
