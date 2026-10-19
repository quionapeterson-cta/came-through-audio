import { useEffect, useMemo, useState } from "react";
import { Archive, Bell, Check, CheckCircle2, ChevronDown, ExternalLink, Pencil, PartyPopper, RotateCcw, Search, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Guide, LiveRecords, openSearch, type HealthActions } from "@/components/HealthReport";
import { encouragement, songChecklist, STAGE_LABEL, type ChecklistStep, type SongChecklist, type Stage } from "@/lib/health-checklist";
import { notShowingReasons } from "@/lib/health-reasons";
import { emptyStatus, isInspectorSong, type SongStatus } from "@/lib/health-songs";
import type { TrackReport } from "@/lib/health";
import type { Country } from "@/lib/repertoires";

type Group = SongChecklist["group"];
// Specific lists first; there is no "All" list.
const GROUPS: { id: Group; label: string }[] = [
  { id: "attention", label: "Needs attention" },
  { id: "later", label: "Saved for later" },
  { id: "healthy", label: "100% Healthy" },
];
const STAGES: Stage[] = ["details", "register", "confirm"];
const today = () => new Date().toISOString().slice(0, 10);

type Props = {
  rows: TrackReport[];
  country: Country;
  statuses: SongStatus[];
  onStatus: (s: SongStatus) => void;
  actions: HealthActions;
  runningId?: string | undefined;
  canCatalog: boolean;
  onUpgrade: () => void;
  onEditInspector: (id: string) => void;
  onDeleteInspector: (id: string) => void;
};

/** Every song's step-by-step path to 100% health, in three lists: needs attention, saved for later and healthy. */
export function HealthChecklist({ rows, country, statuses, onStatus, actions, runningId, canCatalog, onUpgrade, onEditInspector, onDeleteInspector }: Props) {
  const statusOf = (id: string) => statuses.find((s) => s.songRef === id) ?? emptyStatus(id);
  const lists = useMemo(() => rows.map((r) => ({ r, c: songChecklist(r, country, statusOf(r.track.id)) })), [rows, country, statuses]); // eslint-disable-line react-hooks/exhaustive-deps
  const [group, setGroup] = useState<Group>("attention");
  const inGroup = lists.filter((x) => x.c.group === group).sort((a, b) => b.c.pct - a.c.pct);
  const [focus, setFocus] = useState<string>();
  const focused = inGroup.find((x) => x.r.track.id === focus) ?? inGroup[0];
  // Open on the first list that has songs, so nobody lands on an empty tab.
  useEffect(() => {
    if (!lists.some((x) => x.c.group === group)) { const first = GROUPS.find((g) => lists.some((x) => x.c.group === g.id)); if (first) setGroup(first.id); }
  }, [lists.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rows.length) return null;
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-2xl font-extrabold">Song Health Checklist</h3>
        <p className="text-muted-foreground">Simple steps for each song. Tick them off at your own pace until every song is 100% healthy.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Song lists">
        {GROUPS.map((g) => {
          const n = lists.filter((x) => x.c.group === g.id).length;
          return <button key={g.id} type="button" role="tab" aria-selected={group === g.id} onClick={() => setGroup(g.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${group === g.id ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}>
            {g.label} · {n}{g.id === "healthy" && n > 0 ? " ✓" : ""}
          </button>;
        })}
      </div>

      {!inGroup.length ? (
        <div className="rounded-2xl border border-border p-8 text-center text-muted-foreground">
          {group === "healthy" ? "No songs at 100% yet. Finish a song's checklist and it moves here." : group === "later" ? "Nothing saved for later. Use \"Save for later\" on any song you're waiting on." : "Nothing needs attention. Nice work."}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <ul className="space-y-2">
            {inGroup.map(({ r, c }) => {
              const s = statusOf(r.track.id);
              const due = s.list === "later" && s.remindOn && s.remindOn <= today();
              return (
                <li key={r.track.id}>
                  <button type="button" onClick={() => { setFocus(r.track.id); if (window.innerWidth < 1024) setTimeout(() => document.getElementById("song-health-detail")?.scrollIntoView({ behavior: "smooth" }), 50); }}
                    className={`w-full rounded-xl border bg-card p-4 text-left ${focused?.r.track.id === r.track.id ? "border-2 border-primary" : "border-border hover:border-primary/50"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-bold">{r.track.title || "Untitled"}</span>
                      {isInspectorSong(r.track.id) && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Inspector</span>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{r.track.artist}</div>
                    <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary transition-[width]" style={{ width: `${c.pct}%` }} /></div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {group === "later" ? (s.note ? `Waiting on: ${s.note}` : "Saved for later") : `${c.pct}% healthy${c.pct < 100 ? ` · ${c.total - c.done} step${c.total - c.done === 1 ? "" : "s"} left` : ""}`}
                      {due && <span className="ml-1 font-semibold text-primary">· Reminder due</span>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          {focused && <SongDetail key={focused.r.track.id} r={focused.r} c={focused.c} country={country} status={statusOf(focused.r.track.id)} onStatus={onStatus}
            actions={actions} running={runningId === focused.r.track.id} onEditInspector={onEditInspector} onDeleteInspector={onDeleteInspector} />}
        </div>
      )}

      {!canCatalog && (
        <div className="rounded-xl border border-border p-4 text-sm">
          <span className="font-semibold">On a paid plan this runs itself.</span>{" "}
          <span className="text-muted-foreground">Every song you embed or save to My Catalog gets its checklist automatically, with live streaming and song-database lookups and no retyping.</span>{" "}
          <button type="button" onClick={onUpgrade} className="font-semibold text-primary underline">See plans</button>
        </div>
      )}
    </section>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 52, c = 2 * Math.PI * r;
  return (
    <div className="relative h-24 w-24 shrink-0" aria-label={`${pct}% healthy`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--muted)" strokeWidth="12" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--primary)" strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-2xl font-extrabold">{pct}%</div>
    </div>
  );
}

function SongDetail({ r, c, country, status, onStatus, actions, running, onEditInspector, onDeleteInspector }: {
  r: TrackReport; c: SongChecklist; country: Country; status: SongStatus; onStatus: (s: SongStatus) => void; actions: HealthActions; running: boolean;
  onEditInspector: (id: string) => void; onDeleteInspector: (id: string) => void;
}) {
  const id = r.track.id;
  const inspector = isInspectorSong(id);
  const [later, setLater] = useState(false);
  const [note, setNote] = useState(status.note);
  const [remind, setRemind] = useState(status.remindOn ?? "");
  const fix = (field?: string) => { if (inspector) onEditInspector(id); else if (field) actions.onFixField(id, field); };
  const tick = (key: string, on: boolean) => {
    const steps = { ...status.steps };
    if (on) steps[key] = new Date().toISOString(); else delete steps[key];
    onStatus({ ...status, steps });
  };
  const nextOpen = c.steps.find((s) => !s.done)?.id;

  return (
    <article id="song-health-detail" className="scroll-mt-4 rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-[2px] text-primary">Song health</div>
          <h4 className="truncate text-2xl font-extrabold md:text-3xl">{r.track.title || "Untitled"}</h4>
          <p className="text-muted-foreground">{encouragement(c)}</p>
        </div>
        <Ring pct={c.pct} />
      </div>

      {c.pct === 100 && (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-primary p-4 text-primary-foreground">
          <PartyPopper className="h-6 w-6 shrink-0" /><span className="font-semibold">Every step is done. Re-check after big changes, like a new co-writer or a re-release.</span>
        </div>
      )}

      {status.list === "later" && c.pct < 100 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4 text-sm">
          <div><span className="font-semibold">Saved for later.</span> {status.note && <span className="text-muted-foreground">Waiting on: {status.note}.</span>} {status.remindOn && <span className="text-muted-foreground"><Bell className="inline h-3.5 w-3.5" /> Reminder {new Date(`${status.remindOn}T12:00:00`).toLocaleDateString()}</span>}</div>
          <Button size="sm" variant="outline" onClick={() => onStatus({ ...status, list: "active" })}><Undo2 />Move back to Needs attention</Button>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {STAGES.map((stage, si) => {
          const list = c.steps.filter((s) => s.stage === stage);
          if (!list.length) return null;
          return (
            <div key={stage}>
              <h5 className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-[2px]"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">{si + 1}</span>{STAGE_LABEL[stage]}</h5>
              <ol className="space-y-2">
                {list.map((s) => <StepRow key={s.id} s={s} r={r} country={country} status={status} open={s.id === nextOpen} onFix={fix} onTick={tick} actions={actions} />)}
              </ol>
            </div>
          );
        })}
      </div>

      {!inspector && <div className="mt-6"><LiveRecords r={r} running={running} onRun={() => actions.onRunOne(id)} /></div>}

      <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
        {status.list !== "later" && c.pct < 100 && <Button size="sm" variant="outline" onClick={() => setLater(!later)}><Archive />Save for later</Button>}
        {inspector && <>
          <Button size="sm" variant="outline" onClick={() => onEditInspector(id)}><Pencil />Edit song details</Button>
          <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Remove "${r.track.title}" from your checklist?`)) onDeleteInspector(id); }}><Trash2 />Remove</Button>
        </>}
      </div>
      {later && (
        <form className="mt-3 grid gap-3 rounded-xl bg-muted p-4 sm:grid-cols-[1fr_11rem_auto] sm:items-end"
          onSubmit={(e) => { e.preventDefault(); onStatus({ ...status, list: "later", note: note.trim(), remindOn: remind || null }); setLater(false); }}>
          <label className="space-y-1 text-sm"><span className="font-medium">What are you waiting on? (optional)</span>
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. co-writer's IPI, PRO approval" /></label>
          <label className="space-y-1 text-sm"><span className="font-medium">Remind me on (optional)</span>
            <Input type="date" value={remind} min={today()} onChange={(e) => setRemind(e.target.value)} /></label>
          <Button type="submit">Save for later</Button>
        </form>
      )}
    </article>
  );
}

function StepRow({ s, r, country, status, open, onFix, onTick, actions }: {
  s: ChecklistStep; r: TrackReport; country: Country; status: SongStatus; open: boolean;
  onFix: (field?: string) => void; onTick: (key: string, on: boolean) => void; actions: HealthActions;
}) {
  const [expanded, setExpanded] = useState(open);
  const id = r.track.id;
  const check = s.society ? r.pillars.find((p) => p.pillar === s.pillar)?.societies.find((x) => x.society.id === s.society!.id)?.check : undefined;
  const notListed = s.stage === "confirm" && check?.status === "not_listed";
  const toggle = () => {
    if (s.auto || !s.society) { onFix(s.field); return; }
    if (s.stage === "register") onTick(`registered:${s.society.id}`, !s.done);
    else if (s.done) actions.onClear(id, s.society.id);
    else actions.onMark(id, s.society.id, "found");
  };
  const reasons = s.society && s.pillar ? notShowingReasons(s.society, s.pillar) : undefined;

  return (
    <li className={`rounded-xl border p-4 ${!s.done && open ? "border-2 border-primary" : "border-border"}`}>
      <div className="flex gap-3">
        <button type="button" onClick={toggle} aria-pressed={s.done} aria-label={s.auto ? `${s.title}: ${s.done ? "done" : "fix it"}` : `${s.done ? "Untick" : "Tick"}: ${s.title}`}
          title={s.auto ? "Ticks itself when the song details are complete" : undefined}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded ${s.done ? "bg-primary text-primary-foreground" : "border-2 border-muted-foreground/60"}`}>
          {s.done && <Check className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => setExpanded(!expanded)} className="flex w-full items-start justify-between gap-2 text-left">
            <span className={`font-semibold ${s.done ? "text-muted-foreground line-through" : ""}`}>{s.title}</span>
            {!s.done && <ChevronDown className={`mt-1 h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />}
          </button>
          {expanded && !s.done && (
            <div className="mt-2 space-y-3 text-sm">
              {s.stage === "details" && <>
                {s.items?.length ? <ul className="space-y-1">{s.items.map((it, k) => <li key={k}>⚠️ {it.text}</li>)}</ul> : null}
                {s.id === "isrc" && <p className="text-muted-foreground">The ISRC is your recording's ID. Most distributors assign one free when you release. Add it here once you have it.</p>}
                <Button size="sm" onClick={() => onFix(s.field ?? s.items?.[0]?.field)}><Pencil />Fix it</Button>
              </>}
              {s.id === "iswc" && <>
                <p className="text-muted-foreground">The ISWC is your song's ID. Your PRO or publisher assigns it after the song is registered, so this one comes last. Add it when you see it in your PRO account.</p>
                <Button size="sm" onClick={() => onFix("iswc")}><Pencil />Add the ISWC</Button>
              </>}
              {s.stage === "register" && s.society && s.pillar && <>
                <Guide society={s.society} pillar={s.pillar} country={country} title={r.track.title} onExpert={actions.onExpert} onDone={() => onTick(`registered:${s.society!.id}`, true)} />
              </>}
              {s.stage === "confirm" && s.society && <>
                <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                  <li>Open {s.society.name}{s.society.access === "member" ? " and log in to your account" : ""}, then search the exact title.</li>
                  <li>Check that the writers, shares and IPI numbers match what you registered.</li>
                  <li>Found it? Tick this step.</li>
                </ol>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void openSearch(s.society!, r.track.title)}><Search />Open {s.society.name}<ExternalLink /></Button>
                  <Button size="sm" variant="outline" onClick={() => actions.onMark(id, s.society!.id, "found")}><CheckCircle2 />Yes, it's there</Button>
                  {!notListed && <Button size="sm" variant="outline" onClick={() => actions.onMark(id, s.society!.id, "not_listed")}>Not showing up</Button>}
                  {notListed && <Button size="sm" variant="ghost" onClick={() => actions.onClear(id, s.society!.id)}><RotateCcw />Undo</Button>}
                </div>
              </>}
              {s.stage === "confirm" && reasons && (
                <details open={notListed} className="rounded-lg bg-muted p-4">
                  <summary className="cursor-pointer font-semibold text-primary">Not showing up yet? Relax, this is common.</summary>
                  <ul className="mt-2 space-y-1.5">{reasons.reasons.map((x) => <li key={x.title}><span className="font-semibold">{x.title}</span> <span className="text-muted-foreground">{x.text}</span></li>)}</ul>
                  <p className="mt-3 font-medium">{reasons.calm}</p>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

