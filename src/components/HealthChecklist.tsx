import { useEffect, useMemo, useState } from "react";
import { confirmAction } from "@/components/ConfirmHost";
import { Archive, Bell, Stethoscope, Check, CheckCircle2, ChevronDown, Copy, ExternalLink, Info, Pencil, PartyPopper, RotateCcw, Search, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Guide, LiveRecords, openSearch, type HealthActions } from "@/components/HealthReport";
import { ACCOUNT_REF, encouragement, INTL_KEY, printKey, registrationPrint, releaseGroups, searchKey, SINGLES_KEY, songChecklist, STAGE_LABEL, type ChecklistStep, type SongChecklist, type SongSort, type Stage } from "@/lib/health-checklist";
import { updateGuide } from "@/lib/register-guides";
import { listKey } from "@/lib/agency-lists";
import { InfoTip } from "@/components/InfoTip";
import type { GlossaryKey } from "@/lib/glossary";
import type { Pillar } from "@/lib/audit";
import { notShowingReasons } from "@/lib/health-reasons";
import { emptyStatus, isInspectorSong, type SongStatus } from "@/lib/health-songs";
import { performers } from "@/lib/metadata";
import { agencyScores, type TrackReport } from "@/lib/health";
import type { Country } from "@/lib/repertoires";

type Group = SongChecklist["group"];
// Specific lists first; there is no "All" list.
const GROUPS: { id: Group; label: string }[] = [
  { id: "attention", label: "Needs attention" },
  { id: "later", label: "Saved for later" },
  { id: "healthy", label: "100% Healthy" },
];
const STAGES: Stage[] = ["details", "register", "confirm"];
const PILLAR_TERM: Record<Pillar, GlossaryKey> = { performance: "performance", mechanical: "mechanical", digital: "digitalPerformance" };
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
  /** Opens this song's checklist (from a Royalty Health Report treatment step). The nonce lets the same song be asked for twice. */
  focusRequest?: { id: string; nonce: number } | undefined;
  /** Inside the Hub's checklist section, which already has the title. */
  bare?: boolean;
  /** Runs a Royalty Health Check on this song, or (`release`) on the album or EP it's on. */
  onCheck?: ((trackId: string, release?: boolean) => void) | undefined;
};

/** Every song's step-by-step path to 100% health, in three lists: needs attention, saved for later and healthy. */
export function HealthChecklist({ rows, country, statuses, onStatus, actions, runningId, canCatalog, onUpgrade, onEditInspector, onDeleteInspector, focusRequest, bare, onCheck }: Props) {
  const statusOf = (id: string) => statuses.find((s) => s.songRef === id) ?? emptyStatus(id);
  // Account-wide steps (international airplay) are ticked once and count on every song.
  const account = statusOf(ACCOUNT_REF);
  const setIntl = (on: boolean) => { const steps = { ...account.steps }; if (on) steps[INTL_KEY] = new Date().toISOString(); else delete steps[INTL_KEY]; onStatus({ ...account, steps }); };
  const lists = useMemo(() => rows.map((r) => ({ r, c: songChecklist(r, country, statusOf(r.track.id), account) })), [rows, country, statuses]); // eslint-disable-line react-hooks/exhaustive-deps
  const [group, setGroup] = useState<Group>("attention");
  const inGroup = lists.filter((x) => x.c.group === group);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SongSort>("least");
  const releases = useMemo(() => releaseGroups(inGroup, sort, query), [lists, group, sort, query]); // eslint-disable-line react-hooks/exhaustive-deps
  const [focus, setFocus] = useState<string>();
  // Until a song is picked, the first song of the first release; typing a search doesn't change it.
  const firstSong = useMemo(() => releaseGroups(inGroup, sort)[0]?.songs[0], [lists, group, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const focused = inGroup.find((x) => x.r.track.id === focus) ?? firstSong;
  // Releases start collapsed; the one holding the selected song opens, and a search opens every match.
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const focusedKey = releases.find((g) => g.songs.some((x) => x.r.track.id === focused?.r.track.id))?.key;
  const isOpen = (key: string) => opened[key] ?? (!!query.trim() || key === focusedKey);
  useEffect(() => {
    if (!focusRequest) return;
    const hit = lists.find((x) => x.r.track.id === focusRequest.id);
    if (!hit) return;
    setGroup(hit.c.group);
    setFocus(focusRequest.id);
    setTimeout(() => document.getElementById("song-health-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }, [focusRequest?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  // Open on the first list that has songs, so nobody lands on an empty tab.
  useEffect(() => {
    if (!lists.some((x) => x.c.group === group)) { const first = GROUPS.find((g) => lists.some((x) => x.c.group === g.id)); if (first) setGroup(first.id); }
  }, [lists.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rows.length) return null;
  return (
    <section className="space-y-4">
      <div>
        {!bare && <h3 className="text-2xl font-extrabold">Song Health Checklist</h3>}
        <p className="text-muted-foreground">Your catalog ticks off what each agency needs, so you can see how ready every song is to register. Then register it and confirm it shows up, at your own pace.</p>
        <p className="mt-2 flex gap-2 text-sm text-muted-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span><span className="font-semibold text-foreground">Fix it</span> corrects your Came Through Audio catalog, so your exports and 1-click agency files are right from now on. It doesn't change what SoundExchange, The MLC or your PRO already have. If the song is already registered there, log in and update it too; we'll add that step for you.</span></p>
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
          <div className="space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1">
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search songs…" aria-label="Search songs" className="pl-9" />
              </div>
              <select value={sort} onChange={(e) => setSort(e.target.value as SongSort)} aria-label="Sort releases"
                className="rounded-md border border-input bg-background px-2 text-sm">
                <option value="least">Least healthy</option>
                <option value="az">A–Z</option>
                <option value="recent">Recently updated</option>
              </select>
            </div>
            {!releases.length && <p className="p-4 text-center text-sm text-muted-foreground">No songs match "{query}".</p>}
            {releases.map((g) => {
              const open = isOpen(g.key);
              const left = g.songs.reduce((n, x) => n + x.c.total - x.c.done, 0);
              return (
                <div key={g.key} className="rounded-xl border border-border bg-card">
                  <button type="button" onClick={() => setOpened({ ...opened, [g.key]: !open })} aria-expanded={open} className="w-full p-3 text-left">
                    <div className="flex items-center gap-2">
                      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
                      <span className="min-w-0 flex-1 truncate font-bold">{g.name}{g.type && <span className="font-normal text-muted-foreground"> ({g.type})</span>}</span>
                      <span className="shrink-0 text-xs font-semibold">{g.pct}%</span>
                    </div>
                    <div className="ml-6 mt-1.5 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${g.pct}%` }} /></div>
                    <div className="ml-6 mt-1 text-xs text-muted-foreground">{g.songs.length} song{g.songs.length === 1 ? "" : "s"}{left ? ` · ${left} step${left === 1 ? "" : "s"} left` : ""}</div>
                  </button>
                  {open && (
                    <ul className="border-t border-border p-1.5">
                      {g.songs.map(({ r, c }) => {
                        const s = statusOf(r.track.id);
                        const due = s.list === "later" && s.remindOn && s.remindOn <= today();
                        const selected = focused?.r.track.id === r.track.id;
                        return (
                          <li key={r.track.id}>
                            <button type="button" aria-current={selected || undefined}
                              onClick={() => { setFocus(r.track.id); if (window.innerWidth < 1024) setTimeout(() => document.getElementById("song-health-detail")?.scrollIntoView({ behavior: "smooth" }), 50); }}
                              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${selected ? "bg-primary/10 font-semibold ring-1 ring-primary" : "hover:bg-muted"}`}>
                              {g.key !== SINGLES_KEY && r.track.metadata.trackNumber && <span className="w-5 shrink-0 text-xs text-muted-foreground">{r.track.metadata.trackNumber}</span>}
                              <span className="min-w-0 flex-1 truncate">{r.track.title || "Untitled"}</span>
                              {/* Songs checked in the Royalty Inspector (not in My Catalog) say so. */}
                              {isInspectorSong(r.track.id) && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Inspector</span>}
                              <span className="h-1.5 w-12 shrink-0 rounded-full bg-muted"><span className="block h-1.5 rounded-full bg-primary" style={{ width: `${c.pct}%` }} /></span>
                              <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                                {due ? <span className="font-semibold text-primary">Reminder</span> : group === "later" ? "Later" : c.done < c.total ? `${c.total - c.done} left` : "Done"}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                      {onCheck && g.type && <li className="p-1"><Button size="sm" variant="ghost" className="w-full justify-start" onClick={() => onCheck(g.songs[0]!.r.track.id, true)}><Stethoscope />Check this {g.type}</Button></li>}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
          {focused && <SongDetail key={focused.r.track.id} r={focused.r} c={focused.c} country={country} status={statusOf(focused.r.track.id)} onStatus={onStatus}
            actions={actions} running={runningId === focused.r.track.id} onEditInspector={onEditInspector} onDeleteInspector={onDeleteInspector} onIntl={setIntl} onCheck={onCheck} />}
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
    <div className="relative h-24 w-24 shrink-0" aria-label={`${pct}% ready to register`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--muted)" strokeWidth="12" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--primary)" strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-extrabold leading-none">{pct}%</span><span className="mt-1 text-[0.6rem] font-bold uppercase tracking-[1px] text-muted-foreground">ready</span></div>
    </div>
  );
}

function SongDetail({ r, c, country, status, onStatus, actions, running, onEditInspector, onDeleteInspector, onIntl, onCheck }: {
  r: TrackReport; c: SongChecklist; country: Country; status: SongStatus; onStatus: (s: SongStatus) => void; actions: HealthActions; running: boolean;
  onEditInspector: (id: string) => void; onDeleteInspector: (id: string) => void; onIntl: (on: boolean) => void; onCheck?: Props["onCheck"];
}) {
  const id = r.track.id;
  const inspector = isInspectorSong(id);
  const [later, setLater] = useState(false);
  const [note, setNote] = useState(status.note);
  const [remind, setRemind] = useState(status.remindOn ?? "");
  const fix = (field?: string) => { if (inspector) onEditInspector(id); else if (field) actions.onFixField(id, field); };
  /**
   * Saves step changes (null removes one) and an optional found / not-listed mark in one go. Catalog songs keep marks
   * in their own table; Inspector songs keep them in these steps, so they're written together and can't overwrite each other.
   */
  const apply: Apply = (changes, mark) => {
    const steps = { ...status.steps };
    if (mark && inspector) {
      delete steps[`found:${mark.society}`]; delete steps[`not_listed:${mark.society}`];
      if (mark.status) steps[`${mark.status}:${mark.society}`] = new Date().toISOString();
    }
    for (const [k, v] of Object.entries(changes)) { if (v === null) delete steps[k]; else steps[k] = v; }
    if (Object.keys(changes).length || (mark && inspector)) onStatus({ ...status, steps });
    if (mark && !inspector) { if (mark.status) actions.onMark(id, mark.society, mark.status); else actions.onClear(id, mark.society); }
  };
  const nextOpen = c.steps.find((s) => !s.done)?.id;

  return (
    <article id="song-health-detail" className="scroll-mt-4 rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-[2px] text-primary">Song health · {inspector ? "From the Royalty Inspector" : "From My Catalog"}</div>
          <h4 className="truncate text-2xl font-extrabold md:text-3xl">{r.track.title || "Untitled"}</h4>
          <p className="text-muted-foreground">{encouragement(c)}</p>
        </div>
        <Ring pct={c.pct} />
      </div>
      {/* One score per agency: each counts only the details that agency needs (founder, 2026-10-25). */}
      <ul className="mt-4 flex flex-wrap gap-2" aria-label="Score by agency">
        {agencyScores(r).map((a) => (
          <li key={a.pillar} title={a.waiting ?? (a.missing.length ? a.missing.map((i) => i.text).join(" · ") : `${a.society.name} has the details it needs`)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${a.waiting ? "border-dashed border-border text-muted-foreground" : a.data === 1 && a.registered ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
            {a.society.name} · {a.waiting ? "after release" : `${Math.round(a.data * 100)}% details`}{!a.waiting && (a.registered ? " · on file ✓" : " · not confirmed yet")}
          </li>
        ))}
      </ul>

      {c.group === "healthy" && (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-primary p-4 text-primary-foreground">
          <PartyPopper className="h-6 w-6 shrink-0" /><span className="font-semibold">Every step is done. Re-check after big changes, like a new co-writer or a re-release.</span>
        </div>
      )}

      {status.list === "later" && c.group !== "healthy" && (
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
              <h5 className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-[2px]"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">{si + 1}</span>{STAGE_LABEL[stage]}
                {stage === "register" && c.registered.total > 0 && <span className="ml-auto text-xs font-semibold normal-case tracking-normal text-muted-foreground">Registered {c.registered.done} of {c.registered.total}</span>}</h5>
              <ol className="space-y-2">
                {list.map((s) => <StepRow key={s.id} s={s} r={r} country={country} open={s.id === nextOpen} onFix={fix} apply={apply} actions={actions} onIntl={onIntl} />)}
              </ol>
            </div>
          );
        })}
      </div>

      {!inspector && <div className="mt-6"><LiveRecords r={r} running={running} onRun={() => actions.onRunOne(id)} /></div>}

      <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
        {onCheck && <Button size="sm" onClick={() => onCheck(id)}><Stethoscope />Run a Royalty Health Check</Button>}
        {status.list !== "later" && c.group !== "healthy" && <Button size="sm" variant="outline" onClick={() => setLater(!later)}><Archive />Save for later</Button>}
        {inspector && <>
          <Button size="sm" variant="outline" onClick={() => onEditInspector(id)}><Pencil />Edit song details</Button>
          <Button size="sm" variant="ghost" onClick={async () => { if (await confirmAction({ title: `Remove "${r.track.title}" from your checklist?`, action: "Remove" })) onDeleteInspector(id); }}><Trash2 />Remove</Button>
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

const CONFIRM_SONG = [
  { id: "writers", ask: "Are all the writers listed?", issue: "A writer is missing on the registration" },
  { id: "shares", ask: "Do the shares match your split?", issue: "The shares don't match your split" },
  { id: "publisher", ask: "Is the publisher right (or none, if you're self-published)?", issue: "The publisher on the registration isn't right" },
];
const CONFIRM_RECORDING = [
  { id: "artist", ask: "Is your artist name right?", issue: "The artist name on the registration isn't right" },
  { id: "isrc", ask: "Is the ISRC the same as yours?", issue: "The ISRC on the registration is different" },
  { id: "owner", ask: "Are you (or your label) listed as the rights owner?", issue: "The rights owner isn't listed" },
];

type Apply = (changes: Record<string, string | null>, mark?: { society: string; status: "found" | "not_listed" | null }) => void;

function StepRow({ s, r, country, open, onFix, apply, actions, onIntl }: {
  s: ChecklistStep; r: TrackReport; country: Country; open: boolean;
  onFix: (field?: string) => void; apply: Apply; actions: HealthActions; onIntl: (on: boolean) => void;
}) {
  const intl = s.id === "intl";
  const [expanded, setExpanded] = useState(open);
  const [confirming, setConfirming] = useState(false);
  const m = r.track.metadata;
  const check = s.society ? r.pillars.find((p) => p.pillar === s.pillar)?.societies.find((x) => x.society.id === s.society!.id)?.check : undefined;
  const notListed = s.stage === "confirm" && check?.status === "not_listed";
  const now = () => new Date().toISOString();
  // Ticking "registered" or "found" remembers the details as they are, so a later edit reopens the step as an update.
  const print = s.society && s.pillar ? { [printKey(s.society.id)]: registrationPrint(m, s.pillar) } : {};
  const registered = () => s.society && apply({ [`registered:${s.society.id}`]: now(), ...print });
  // Guided confirm: "it's there" asks what's on the registration, so a mismatch becomes a precise finding in the report.
  const [asking, setAsking] = useState(false);
  const questions = s.pillar === "digital" ? CONFIRM_RECORDING : CONFIRM_SONG;
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const markFound = () => {
    if (!s.society) return;
    const issues = questions.filter((q) => answers[q.id] === false).map((q) => q.issue);
    apply({ ...print, [listKey(s.society.id)]: issues.length ? JSON.stringify({ at: now(), issues }) : null }, { society: s.society.id, status: "found" });
    setAsking(false);
  };
  const untick = () => {
    setConfirming(false);
    if (intl) { onIntl(false); return; }
    if (!s.society) return;
    // Not registered means it can't be found there either, so unticking Register clears that mark too.
    if (s.stage === "register") apply({ [`registered:${s.society.id}`]: null, [printKey(s.society.id)]: null }, check ? { society: s.society.id, status: null } : undefined);
    else apply({}, { society: s.society.id, status: null });
  };
  const toggle = () => {
    if (intl) { if (s.done) setConfirming(true); else onIntl(true); return; }
    if (s.auto || !s.society) { onFix(s.field); return; }
    if (s.done) { setConfirming(true); return; }
    if (s.stage === "register") registered(); else markFound();
  };
  const reasons = s.society && s.pillar ? notShowingReasons(s.society, s.pillar) : undefined;
  const key = s.society && s.stage === "confirm" ? searchKey(s.society, m) : undefined;
  const copy = async (v: string) => { try { await navigator.clipboard.writeText(v); toast.success(`"${v}" copied.`); } catch { /* nothing to copy into */ } };

  return (
    <li className={`rounded-xl border p-4 ${!s.done && open ? "border-2 border-primary" : "border-border"}`}>
      <div className="flex gap-3">
        <button type="button" onClick={toggle} aria-pressed={s.done} aria-label={s.auto ? `${s.title}: ${s.done ? "done" : "fix it"}` : `${s.done ? "Untick" : "Tick"}: ${s.title}`}
          title={s.auto ? "Ticks itself when your catalog has everything this needs" : undefined}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded ${s.done ? "bg-primary text-primary-foreground" : "border-2 border-muted-foreground/60"}`}>
          {s.done && <Check className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1">
            <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-start justify-between gap-2 text-left">
              <span className={`font-semibold ${s.done ? "text-muted-foreground line-through" : ""}`}>{s.title}</span>
              <ChevronDown className={`mt-1 h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
            {s.stage === "register" && s.pillar && <InfoTip term={PILLAR_TERM[s.pillar]} className="mt-0.5" />}
            {intl && <InfoTip term="neighbouringRights" className="mt-0.5" />}
          </div>
          {confirming && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3 text-sm">
              <span className="font-medium">Untick "{s.title}"?</span>
              <Button size="sm" onClick={untick}>Untick</Button>
              <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>Keep it</Button>
            </div>
          )}
          {expanded && (
            <div className="mt-2 space-y-3 text-sm">
              {s.stage === "details" && s.done && s.society && <p className="text-muted-foreground">Your catalog has everything {s.society.name} asks for. Ticked automatically.</p>}
              {s.auto && s.id !== "iswc" && !s.done && <>
                {s.items?.length ? <ul className="space-y-1">{s.items.map((it, k) => <li key={k}>⚠️ {it.field ? <button type="button" onClick={() => onFix(it.field)} className="text-left underline decoration-primary underline-offset-2 hover:text-primary">{it.text}</button> : it.text}</li>)}</ul> : null}
                <FixIt onClick={() => onFix(s.field ?? s.items?.[0]?.field)} />
              </>}
              {s.id === "iswc" && <>
                <p className="text-muted-foreground">The ISWC is your song's ID. Your PRO or publisher assigns it after the song is registered, so this one comes last. Add it when you see it in your PRO account.</p>
                {!s.done && <FixIt label="Add the ISWC" onClick={() => onFix("iswc")} />}
              </>}
              {s.stage === "register" && s.society && s.pillar && (s.update ? (
                <div className="rounded-xl bg-muted p-4">
                  <p>You changed this song's details after registering it with {s.society.name}. Update the registration so it matches, or royalties can go to the wrong place.</p>
                  <ol className="mt-3 space-y-1.5">
                    {updateGuide(s.society, s.pillar).map((step, i) => <li key={i} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{i + 1}</span>{step}</li>)}
                  </ol>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void openSearch(s.society!, r.track.title)}><ExternalLink />Open {s.society.name}</Button>
                    <Button size="sm" variant="outline" onClick={registered}><Check />I've updated it</Button>
                  </div>
                </div>
              ) : (
                <Guide society={s.society} pillar={s.pillar} country={country} title={r.track.title} onExpert={actions.onExpert} onDone={s.done ? undefined : registered} />
              ))}
              {intl && <IntlGuide done={s.done} onDone={() => onIntl(true)} />}
              {intl && !isInspectorSong(r.track.id) && !performers(r.track.metadata).some((p) => !p.featured) && (
                <p className="text-muted-foreground">This song lists no session players or backup singers. Played and sang it all yourself? You're covered. Otherwise <button type="button" onClick={() => onFix("performers")} className="font-semibold text-primary underline">add who played on it</button> so every performer gets paid.</p>
              )}
              {s.stage === "confirm" && s.society && key && <>
                <p className="text-muted-foreground">{key.hint}{s.society.access === "member" ? ` Log in to your ${s.society.name} account first.` : ""} Then check that the writers, shares and IPI numbers match what you registered.</p>
                {key.value ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Your {key.by}: <span className="font-semibold">{key.value}</span></span>
                    <Button size="sm" variant="ghost" onClick={() => void copy(key.value)}><Copy />Copy</Button>
                    {key.also?.value && <>
                      <span>Your {key.also.by}: <span className="font-semibold">{key.also.value}</span></span>
                      <Button size="sm" variant="ghost" onClick={() => void copy(key.also!.value)}><Copy />Copy</Button>
                    </>}
                  </div>
                ) : (
                  <p>⚠️ Add the {key.by} first, so you can search for it. <button type="button" onClick={() => onFix(key.field)} className="font-semibold text-primary underline">Add it</button></p>
                )}
                {!s.done && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void openSearch(s.society!, key.value || r.track.title)}><Search />Open {s.society.name}<ExternalLink /></Button>
                    <Button size="sm" variant="outline" onClick={() => { setAnswers({}); setAsking(true); }}><CheckCircle2 />Yes, it's there</Button>
                    {!notListed && <Button size="sm" variant="outline" onClick={() => apply({}, { society: s.society!.id, status: "not_listed" })}>Not showing up</Button>}
                    {notListed && <Button size="sm" variant="ghost" onClick={() => apply({}, { society: s.society!.id, status: null })}><RotateCcw />Undo</Button>}
                  </div>
                )}
              </>}
              {s.stage === "confirm" && asking && !s.done && (
                <div className="space-y-3 rounded-lg border border-primary/40 p-4">
                  <p className="font-semibold">Great. Three quick checks against what {s.society!.name} shows:</p>
                  {questions.map((q) => (
                    <div key={q.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>{q.ask}</span>
                      <span className="flex gap-1">{([true, false] as const).map((v) => (
                        <Button key={String(v)} size="sm" variant={answers[q.id] === v ? "default" : "outline"} aria-pressed={answers[q.id] === v} onClick={() => setAnswers({ ...answers, [q.id]: v })}>{v ? "Yes" : "No"}</Button>
                      ))}</span>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={questions.some((q) => answers[q.id] === undefined)} onClick={markFound}><Check />Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>Cancel</Button>
                  </div>
                  {questions.some((q) => answers[q.id] === false) && <p className="text-xs text-muted-foreground">⚠️ We'll add this to your Royalty Health Report with the steps to update the registration.</p>}
                </div>
              )}
              {s.stage === "confirm" && reasons && !s.done && (
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

/** International airplay: one setup per account, through SoundExchange International Services or a PPL mandate. */
function IntlGuide({ done, onDone }: { done: boolean; onDone: () => void }) {
  return (
    <div className="rounded-xl bg-muted p-4">
      <p>When your recording plays on radio, TV or in venues outside the US, its performers and master owner are owed royalties. US radio doesn't pay these, so most artists miss them. You set this up once for your whole account.</p>
      <p className="mt-3 font-semibold">Pick one for each country (not both, each one is exclusive):</p>
      <ol className="mt-2 space-y-2">
        <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">1</span>
          <span><span className="font-semibold">SoundExchange International Services</span> (easiest). Once you're registered with SoundExchange, enroll in International Services in your SX Direct account, for every country or only the ones you choose.</span></li>
        <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">2</span>
          <span><span className="font-semibold">Join PPL</span><InfoTip term="ppl" /> (free, open to US artists). To have PPL collect outside the UK, sign their International Performer Mandate. It's signed as a deed, so print it and sign with a witness.</span></li>
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => window.open("https://www.soundexchange.com/international-partners/", "_blank", "noopener,noreferrer")}><ExternalLink />Open SoundExchange</Button>
        <Button size="sm" variant="outline" onClick={() => window.open("https://www.ppluk.com/royalties/what-do-i-need-to-join-ppl/", "_blank", "noopener,noreferrer")}><ExternalLink />Open PPL</Button>
        {!done && <Button size="sm" variant="outline" onClick={onDone}><Check />I've set this up</Button>}
      </div>
    </div>
  );
}

/** "Fix it" always says what it changes: the user's own catalog, not the agencies. */
function FixIt({ onClick, label = "Fix it" }: { onClick: () => void; label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={onClick}><Pencil />{label}</Button>
      <span className="text-xs text-muted-foreground">Updates your catalog</span>
    </div>
  );
}
