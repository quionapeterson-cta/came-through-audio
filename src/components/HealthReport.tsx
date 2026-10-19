import { useState } from "react";
import { Check, Disc3, ExternalLink, Lock, Radar, RotateCcw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Pillar } from "@/lib/audit";
import { PILLAR_HINT, pillarLabel, pillarTerm, todoList, type healthReport, type RepertoireCheck, type TodoItem, type TrackReport } from "@/lib/health";
import { registerGuide } from "@/lib/register-guides";
import { COUNTRIES, INTERNATIONAL, OTHER_COUNTRY, REGIONS, inCountry, type Country, type Society } from "@/lib/repertoires";

export type Report = ReturnType<typeof healthReport>;
export type HealthActions = {
  onCountry: (code: string) => void;
  onRunAll: () => void;
  onRunOne: (trackId: string) => void;
  onMark: (trackId: string, society: string, status: RepertoireCheck["status"], workId?: string) => void;
  onClear: (trackId: string, society: string) => void;
  onFixField: (trackId: string, field: string) => void;
  onExpert: () => void;
};
type Running = { done: number; total: number; trackId?: string | undefined };
type Props = HealthActions & { report: Report; country: Country; running?: Running | undefined; canCatalog: boolean; onEmbed: () => void };

function ScoreRing({ value }: { value: number }) {
  const r = 52, c = 2 * Math.PI * r;
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--ink-border)" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--primary)" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold leading-none">{value}<span className="text-xl">%</span></span>
        <span className="mt-1 text-[11px] font-semibold uppercase tracking-[2px] text-ink-muted">Set up</span>
      </div>
    </div>
  );
}

function CountryPicker({ country, onCountry }: { country: Country; onCountry: (code: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[2px] text-ink-muted">
      Where you get paid
      <select value={country.code} onChange={(e) => onCountry(e.target.value)} aria-label="Your country"
        className="h-11 min-w-56 rounded-xl border border-ink-border bg-ink px-3 text-sm font-semibold normal-case tracking-normal text-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {REGIONS.map((region) => (
          <optgroup key={region} label={region}>
            {COUNTRIES.filter((c) => c.region === region).sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </optgroup>
        ))}
        <option value={OTHER_COUNTRY.code}>My country isn't listed</option>
      </select>
    </label>
  );
}

/** Copy the title, then open the society's search, so the user can paste it straight in. */
async function openSearch(society: Society, title: string) {
  try { await navigator.clipboard.writeText(title); toast.success(`"${title}" copied. Paste it into the ${society.name} search.`); } catch { /* opening still helps */ }
  window.open(society.url, "_blank", "noopener,noreferrer");
}

function Guide({ society, pillar, country, title, onExpert, onDone }: { society: Society; pillar: Pillar; country: Country; title: string; onExpert: () => void; onDone: () => void }) {
  const g = registerGuide(society, pillar, country);
  return (
    <div className="mt-3 rounded-xl bg-muted p-4 text-sm">
      <p>{g.pays}</p>
      <p className="mt-1 text-muted-foreground"><span className="font-semibold text-foreground">Who registers:</span> {g.who}</p>
      <ol className="mt-3 space-y-1.5">
        {g.steps.map((step, i) => <li key={i} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{i + 1}</span>{step}</li>)}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => void openSearch(society, title)}><ExternalLink />Open {society.name}</Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}><Check />It's registered now</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onExpert}>Have an expert do it</Button>
      </div>
    </div>
  );
}

/** One plain question per song and society: is it registered there? */
function RegistrationRow({ track, pillar, society, check, country, actions }: { track: TrackReport["track"]; pillar: Pillar; society: Society; check?: RepertoireCheck | undefined; country: Country; actions: HealthActions }) {
  const [workId, setWorkId] = useState(check?.workId ?? "");
  const mark = (status: RepertoireCheck["status"], id?: string) => actions.onMark(track.id, society.id, status, id);
  if (check?.status === "found") return (
    <li className="flex flex-col gap-2 rounded-xl border border-primary/40 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 font-semibold"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-4 w-4" /></span>Registered with {society.name}
        {check.workId && <span className="text-xs font-normal text-muted-foreground">· Work ID {check.workId}</span>}</div>
      <div className="flex flex-wrap items-center gap-2">
        {!check.workId && <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); mark("found", workId); }}>
          <Input value={workId} onChange={(e) => setWorkId(e.target.value)} placeholder="Work ID (optional)" aria-label={`${society.name} work ID`} className="h-8 w-40 text-xs" />
          <Button type="submit" size="sm" variant="outline" className="h-8">Save</Button>
        </form>}
        <Button type="button" size="sm" variant="ghost" onClick={() => actions.onClear(track.id, society.id)}><RotateCcw />Undo</Button>
      </div>
    </li>
  );
  if (check?.status === "not_listed") return (
    <li className="rounded-xl border border-destructive/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive"><X className="h-4 w-4" /></span>Not registered with {society.name} yet</div>
        <Button type="button" size="sm" variant="ghost" onClick={() => actions.onClear(track.id, society.id)}><RotateCcw />Undo</Button>
      </div>
      <Guide society={society} pillar={pillar} country={country} title={track.title} onExpert={actions.onExpert} onDone={() => mark("found")} />
    </li>
  );
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border p-3 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="font-semibold">Is it registered with {society.name}?</div>
        <div className="text-xs text-muted-foreground">{society.access === "member" ? <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" />Check in your {society.name} member account</span> : `Search ${society.name}'s public records`}</div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void openSearch(society, track.title)}><Search />Check for me</Button>
        <Button type="button" size="sm" onClick={() => mark("found")}><Check />Yes, it's there</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => mark("not_listed")}><X />No, it's not</Button>
      </div>
    </li>
  );
}

function LiveRecords({ r, onRun, running }: { r: TrackReport; onRun: () => void; running: boolean }) {
  const checked = r.streaming?.checkedAt ?? r.work?.checkedAt;
  const s = r.streaming?.hit, w = r.work?.hit;
  return (
    <div className="space-y-3 rounded-2xl bg-muted p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-extrabold uppercase tracking-[2px]">What the world sees</h4>
        <Button type="button" size="sm" variant="outline" disabled={running} onClick={onRun}><Radar className={running ? "animate-spin" : ""} />{checked ? "Re-check" : "Look up"}</Button>
      </div>
      {!checked && <p className="text-sm text-muted-foreground">{running ? "Looking this song up…" : "We'll look this song up on streaming and in MusicBrainz, the open music database."}</p>}
      {checked && <>
        <div className="flex gap-3">
          {s?.cover ? <img src={s.cover} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" /> : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-ink"><Disc3 className="h-6 w-6 text-primary" /></div>}
          <div className="min-w-0 text-sm">
            <div className="font-bold">On streaming</div>
            {s ? <a href={s.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline">{s.title} · {s.artist}<ExternalLink className="h-3 w-3" /></a>
              : <span className="text-muted-foreground">Not found on streaming yet.</span>}
            {s?.isrc && <div className="text-xs text-muted-foreground">ISRC {s.isrc}</div>}
          </div>
        </div>
        <div className="text-sm">
          <div className="font-bold">In the public song database</div>
          {w ? <div className="space-y-0.5">
            <a href={w.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline">{w.workTitle ?? w.recordingTitle} on {INTERNATIONAL.musicbrainz.name}<ExternalLink className="h-3 w-3" /></a>
            <div className="text-xs text-muted-foreground">{w.iswcs.length ? `ISWC ${w.iswcs.join(" / ")}` : "No ISWC on record"}{w.writers.length ? ` · Writers: ${w.writers.join(", ")}` : ""}</div>
          </div> : <span className="text-muted-foreground">No public record yet. That's common for newer releases.</span>}
        </div>
      </>}
    </div>
  );
}

/** A writer with no PRO can't be registered for airplay pay yet, so that question waits until the PRO is added. */
const needsPro = (r: TrackReport) => r.issues.some((i) => i.field?.endsWith("-pro"));

function SongCard({ r, country, actions, running }: { r: TrackReport; country: Country; actions: HealthActions; running: boolean }) {
  const warn = r.findings.filter((f) => f.level === "warn");
  const fixes = [...r.issues.map((i) => ({ text: i.text, field: i.field })), ...warn.map((f) => ({ text: f.text, field: f.field === "writers" ? "writers-0-legalName" : f.field }))];
  const ready = r.pillars.length > 0 && r.pillars.every((p) => p.state === "confirmed") && !fixes.length;
  const cover = r.streaming?.hit?.cover;
  return (
    <li className={`overflow-hidden rounded-2xl border bg-card ${ready ? "border-primary" : "border-border"}`}>
      <div className="flex w-full items-center gap-4 p-4">
        {cover ? <img src={cover} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-ink"><Disc3 className="h-5 w-5 text-primary" /></div>}
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{r.track.title || "Untitled"}</div>
          <div className="truncate text-sm text-muted-foreground">{r.track.artist}</div>
        </div>
        <div className="hidden gap-1.5 md:flex" aria-hidden>
          {r.pillars.map((p) => <span key={p.pillar} title={pillarLabel(p.pillar, country)} className={`h-2.5 w-8 rounded-full ${p.state === "confirmed" ? "bg-primary" : p.state === "missing" ? "bg-destructive" : "bg-muted-foreground/25"}`} />)}
        </div>
        <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${ready ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
          {ready ? "Set up to get paid" : `${r.pillars.filter((p) => p.state === "confirmed").length} of ${r.pillars.length} set up`}
        </span>
      </div>
      {(
        <div className="grid gap-6 border-t border-border p-4 lg:grid-cols-[1fr_1.5fr]">
          <div className="space-y-3">
            <LiveRecords r={r} running={running} onRun={() => actions.onRunOne(r.track.id)} />
            {fixes.length > 0 && <div className="rounded-2xl border border-border p-4">
              <h4 className="mb-2 text-sm font-extrabold uppercase tracking-[2px]">Fix your song info</h4>
              <ul className="space-y-1.5 text-sm">
                {fixes.map((f, k) => <li key={k}><button type="button" onClick={() => f.field && actions.onFixField(r.track.id, f.field)} className="text-left hover:text-primary">⚠️ {f.text} {f.field && <span className="font-semibold text-primary underline">Fix</span>}</button></li>)}
              </ul>
            </div>}
          </div>
          <div className="space-y-5">
            {r.pillars.map((p) => {
              // Writers belong to one PRO; with none listed, ask about the first likely one rather than all of them.
              const list = p.pillar === "performance" && p.societies.length > 1 && !p.societies.some((s) => s.check) ? p.societies.slice(0, 1) : p.societies;
              return (
                <div key={p.pillar} className="space-y-2">
                  <div>
                    <h4 className="text-sm font-extrabold uppercase tracking-[2px] text-primary">{pillarLabel(p.pillar, country)}</h4>
                    <p className="text-xs text-muted-foreground">{pillarTerm(p.pillar, country)}. {PILLAR_HINT[p.pillar]}</p>
                  </div>
                  {p.pillar === "performance" && needsPro(r)
                    ? <p className="text-sm">⚠️ Add each writer's PRO first, then check the registration here.</p>
                    : <ul className="space-y-2">{list.map(({ society, check }) => <RegistrationRow key={society.id} track={r.track} pillar={p.pillar} society={society} check={check} country={country} actions={actions} />)}</ul>}
                </div>
              );
            })}
            {!r.pillars.length && <p className="text-sm text-muted-foreground">Add your writers and their PRO in My Catalog to see where this song needs to be registered.</p>}
          </div>
        </div>
      )}
    </li>
  );
}

const STEP = { fix: "Fix song info", register: "Register", confirm: "Confirm" } as const;

function TodoRow({ item, country, actions }: { item: TodoItem; country: Country; actions: HealthActions }) {
  const [guide, setGuide] = useState(false);
  if (item.kind === "fix") return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0 text-sm"><span className="font-bold">{item.track.title}</span><span className="text-muted-foreground"> · {item.text}</span></div>
      {item.field && <Button type="button" size="sm" variant="outline" onClick={() => actions.onFixField(item.track.id, item.field!)}>Fix</Button>}
    </li>
  );
  const label = pillarLabel(item.pillar, country).toLowerCase();
  return (
    <li className="py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm">
          <span className="font-bold">{item.track.title}</span>
          <span className="text-muted-foreground">{item.kind === "register" ? ` · Register with ${item.society.name} to collect ${label}` : ` · Is it registered with ${item.society.name}?`}</span>
        </div>
        {item.kind === "register"
          ? <Button type="button" size="sm" onClick={() => setGuide(!guide)}>{guide ? "Hide steps" : "Show me how"}</Button>
          : <div className="flex shrink-0 gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void openSearch(item.society, item.track.title)}><Search />Check</Button>
              <Button type="button" size="sm" onClick={() => actions.onMark(item.track.id, item.society.id, "found")}>Yes</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => actions.onMark(item.track.id, item.society.id, "not_listed")}>No</Button>
            </div>}
      </div>
      {guide && item.kind === "register" && <Guide society={item.society} pillar={item.pillar} country={country} title={item.track.title} onExpert={actions.onExpert} onDone={() => actions.onMark(item.track.id, item.society.id, "found")} />}
    </li>
  );
}

export function HealthReport({ report, country, running, canCatalog, onEmbed, ...actions }: Props) {
  const rowOf = (id: string) => report.rows.find((r) => r.track.id === id)!;
  const todos = todoList(report).filter((t) => !(t.kind === "confirm" && t.pillar === "performance" && needsPro(rowOf(t.track.id))));
  const [showAll, setShowAll] = useState(false);
  const needsWork = (r: TrackReport) => !(r.pillars.length && r.pillars.every((p) => p.state === "confirmed") && !r.issues.length && !r.findings.some((f) => f.level === "warn"));
  const [focus, setFocus] = useState<string | undefined>(() => (report.rows.find(needsWork) ?? report.rows[0])?.track.id);
  const focused = report.rows.find((r) => r.track.id === focus) ?? report.rows[0];
  const ready = report.rows.filter((r) => !needsWork(r)).length;
  const looked = report.rows.filter((r) => r.streaming || r.work).length;
  const counts = (["fix", "register", "confirm"] as const).map((k) => [k, todos.filter((t) => t.kind === k).length] as const);
  const shown = showAll ? todos : todos.slice(0, 5);
  const where = inCountry(country);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-ink p-6 text-ink-foreground md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Royalty Health Check</h2>
            <p className="mt-2 max-w-xl text-ink-muted">{canCatalog || report.rows.length
              ? "Make sure every song is registered and matched, so every royalty it earns can reach you."
              : "Enter a song's details below to see if it's registered and matched, so every royalty it earns can reach you."}</p>
          </div>
          <CountryPicker country={country} onCountry={actions.onCountry} />
        </div>
        {report.rows.length > 0 && (
          <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-center">
            <ScoreRing value={report.score} />
            <div className="flex-1 space-y-4">
              <p className="text-2xl font-bold leading-snug md:text-3xl">{ready} of {report.rows.length} song{report.rows.length === 1 ? " is" : "s are"} fully set up to get paid{where}.</p>
              <div className="flex flex-wrap gap-2">
                {counts.map(([k, n], i) => <span key={k} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${n ? "border-ink-border" : "border-primary/50 text-ink-muted"}`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${n ? "bg-primary text-primary-foreground" : "bg-ink-border"}`}>{n ? i + 1 : <Check className="h-3 w-3" />}</span>
                  {STEP[k]}{n ? ` · ${n}` : ""}
                </span>)}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
                <Radar className={`h-4 w-4 ${running ? "animate-spin text-primary" : ""}`} />
                {running ? `Looking up song ${running.done + 1} of ${running.total} on streaming and MusicBrainz…` : `Live lookups ran for ${looked} of ${report.rows.length} songs.`}
                {!running && <button type="button" onClick={actions.onRunAll} className="font-semibold text-ink-foreground underline hover:text-primary">Re-check all</button>}
              </div>
            </div>
          </div>
        )}
        {country.note && <p className="mt-6 rounded-xl border border-ink-border px-4 py-2 text-sm text-ink-muted">{country.note}</p>}
      </section>

      {report.rows.length === 0 ? (
        // Paid plans: shown only until the first song is saved. Free plans use the Quick Song Inspector below instead.
        canCatalog ? (
          <div className="rounded-2xl border border-border p-8 text-center">
            <p className="text-lg font-semibold">Your songs are checked automatically.</p>
            <p className="mx-auto mt-1 max-w-xl text-muted-foreground">Every song you embed and save to My Catalog runs through the Royalty Health Check on its own. Embed your first song to see its report here.</p>
            <Button className="mt-4" onClick={onEmbed}>Embed a song</Button>
          </div>
        ) : null
      ) : <>
        <section className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-xl font-bold">{todos.length ? "Your next steps" : "You're all set"}</h3>
            {todos.length > 0 && <span className="text-sm text-muted-foreground">{todos.length} to go</span>}
          </div>
          {todos.length === 0
            ? <p className="mt-2 text-muted-foreground">Every song is registered and matched{where}. Re-check after each new release.</p>
            : <>
              <ul className="mt-2 divide-y divide-border">{shown.map((t, i) => <TodoRow key={`${t.kind}-${t.track.id}-${i}`} item={t} country={country} actions={actions} />)}</ul>
              {todos.length > 5 && <button type="button" onClick={() => setShowAll(!showAll)} className="mt-2 text-sm font-semibold text-primary underline">{showAll ? "Show fewer" : `Show all ${todos.length} steps`}</button>}
            </>}
        </section>

        <div>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xl font-bold">Focus on one song</h3>
            <select value={focused?.track.id} onChange={(e) => setFocus(e.target.value)} aria-label="Choose a song"
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-80">
              {report.rows.map((r) => <option key={r.track.id} value={r.track.id}>{needsWork(r) ? "⚠️ " : "✓ "}{r.track.title || "Untitled"}{r.track.artist ? ` · ${r.track.artist}` : ""}</option>)}
            </select>
          </div>
          {focused && <ul><SongCard key={focused.track.id} r={focused} country={country} actions={actions} running={running?.trackId === focused.track.id} /></ul>}
        </div>
      </>}
    </div>
  );
}
