import { useState } from "react";
import { Check, ChevronDown, Copy, Disc3, ExternalLink, Lock, Radar, RotateCcw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PILLAR_HINT, pillarLabel, type healthReport, type PillarRow, type RepertoireCheck, type TrackReport } from "@/lib/health";
import { COUNTRIES, INTERNATIONAL, OTHER_COUNTRY, REGIONS, type Country, type Society } from "@/lib/repertoires";

export type Report = ReturnType<typeof healthReport>;
export type HealthActions = {
  onCountry: (code: string) => void;
  onRunAll: () => void;
  onRunOne: (trackId: string) => void;
  onMark: (trackId: string, society: string, status: RepertoireCheck["status"], workId?: string) => void;
  onClear: (trackId: string, society: string) => void;
  onFixField: (trackId: string, field: string) => void;
};
type Props = HealthActions & { report: Report; country: Country; running?: { done: number; total: number; trackId?: string | undefined } | undefined };

/** The score as a ring: Cobalt progress on a dark track. */
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
        <span className="mt-1 text-[11px] font-semibold uppercase tracking-[2px] text-ink-muted">Health</span>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-ink-border bg-ink-border/30 p-4">
      <div className="text-xs font-semibold uppercase tracking-[2px] text-ink-muted">{label}</div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
      <div className="text-xs text-ink-muted">{sub}</div>
    </div>
  );
}

function CountryPicker({ country, onCountry }: { country: Country; onCountry: (code: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[2px] text-ink-muted">
      Your country
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

const PILL = {
  confirmed: "bg-primary text-primary-foreground",
  missing: "bg-destructive/10 text-destructive",
  unchecked: "bg-muted text-muted-foreground",
} as const;
const PILL_TEXT = { confirmed: "Registered", missing: "Not listed", unchecked: "Not checked" } as const;

/** Copy the title, then open the society's search, so the user can paste it straight in. */
async function openSearch(society: Society, title: string) {
  try { await navigator.clipboard.writeText(title); toast.success(`"${title}" copied. Paste it into the ${society.name} search.`); } catch { /* opening still helps */ }
  window.open(society.url, "_blank", "noopener,noreferrer");
}

function SocietyRow({ trackId, title, society, check, actions }: { trackId: string; title: string; society: Society; check?: RepertoireCheck | undefined; actions: HealthActions }) {
  const [workId, setWorkId] = useState(check?.workId ?? "");
  const state = check?.status === "found" ? "confirmed" : check?.status === "not_listed" ? "missing" : "unchecked";
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">{society.name}</span>
          {state !== "unchecked" && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PILL[state]}`}>{PILL_TEXT[state]}</span>}
          {society.access === "member" && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Lock className="h-3 w-3" />Member login</span>}
        </div>
        {check?.status === "found" && (check.workId
          ? <div className="mt-1 text-xs text-muted-foreground">Work ID {check.workId}</div>
          : <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); actions.onMark(trackId, society.id, "found", workId); }}>
              <Input value={workId} onChange={(e) => setWorkId(e.target.value)} placeholder="Work ID (optional)" aria-label={`${society.name} work ID`} className="h-8 max-w-48 text-xs" />
              <Button type="submit" size="sm" variant="outline" className="h-8">Save</Button>
            </form>)}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void openSearch(society, title)}><Search />{society.access === "member" ? "Log in & check" : "Search"}</Button>
        {state === "unchecked" ? <>
          <Button type="button" size="sm" onClick={() => actions.onMark(trackId, society.id, "found")}><Check />Found it</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => actions.onMark(trackId, society.id, "not_listed")}><X />Not listed</Button>
        </> : <Button type="button" size="sm" variant="ghost" onClick={() => actions.onClear(trackId, society.id)} aria-label={`Undo ${society.name} check`}><RotateCcw />Undo</Button>}
      </div>
    </li>
  );
}

function PillarBlock({ row, track, country, actions }: { row: PillarRow; track: TrackReport["track"]; country: Country; actions: HealthActions }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-extrabold uppercase tracking-[2px] text-primary">{pillarLabel(row.pillar, country)}</h4>
        <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${PILL[row.state]}`}>{PILL_TEXT[row.state]}</span>
      </div>
      {row.dataIssues.map((i, k) => (
        <button key={k} type="button" onClick={() => i.field && actions.onFixField(track.id, i.field)} className="block text-left text-sm text-foreground hover:text-primary">
          ⚠️ {i.text} {i.field && <span className="font-semibold text-primary underline">Fix</span>}
        </button>
      ))}
      <ul className="space-y-2">
        {row.societies.map(({ society, check }) => <SocietyRow key={society.id} trackId={track.id} title={track.title} society={society} check={check} actions={actions} />)}
      </ul>
    </div>
  );
}

function LiveRecords({ r, onRun, running }: { r: TrackReport; onRun: () => void; running: boolean }) {
  const checked = r.streaming?.checkedAt ?? r.work?.checkedAt;
  const s = r.streaming?.hit, w = r.work?.hit;
  return (
    <div className="space-y-3 rounded-2xl bg-muted p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-extrabold uppercase tracking-[2px]">Live public records</h4>
        <Button type="button" size="sm" variant="outline" disabled={running} onClick={onRun}><Radar className={running ? "animate-spin" : ""} />{checked ? "Re-check" : "Look up"}</Button>
      </div>
      {!checked && <p className="text-sm text-muted-foreground">Look this song up on streaming and in MusicBrainz, the open music database, to check its ISRC, ISWC and writers.</p>}
      {checked && <>
        <div className="flex gap-3">
          {s?.cover ? <img src={s.cover} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" /> : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-ink"><Disc3 className="h-6 w-6 text-primary" /></div>}
          <div className="min-w-0 text-sm">
            <div className="font-bold">Streaming</div>
            {s ? <a href={s.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline">{s.title} · {s.artist}<ExternalLink className="h-3 w-3" /></a>
              : <span className="text-muted-foreground">Not found on streaming yet.</span>}
            {s?.isrc && <div className="text-xs text-muted-foreground">ISRC {s.isrc}</div>}
          </div>
        </div>
        <div className="text-sm">
          <div className="font-bold">{INTERNATIONAL.musicbrainz.name}</div>
          {w ? <div className="space-y-0.5">
            <a href={w.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline">{w.workTitle ?? w.recordingTitle}<ExternalLink className="h-3 w-3" /></a>
            <div className="text-xs text-muted-foreground">{w.iswcs.length ? `ISWC ${w.iswcs.join(" / ")}` : "No ISWC on record"}{w.writers.length ? ` · Writers: ${w.writers.join(", ")}` : ""}</div>
          </div> : <span className="text-muted-foreground">No public record yet. That's common for newer releases.</span>}
        </div>
        <div className="text-[11px] text-muted-foreground">Checked {new Date(checked).toLocaleDateString()}</div>
      </>}
    </div>
  );
}

function SongCard({ r, country, actions, running, open, onToggle }: { r: TrackReport; country: Country; actions: HealthActions; running: boolean; open: boolean; onToggle: () => void }) {
  const warn = r.findings.filter((f) => f.level === "warn");
  const action = r.issues.length + warn.length + r.pillars.filter((p) => p.state === "missing").length;
  const done = r.pillars.length && r.pillars.every((p) => p.state === "confirmed") && !action;
  const cover = r.streaming?.hit?.cover;
  return (
    <li className={`overflow-hidden rounded-2xl border bg-card transition ${action ? "border-destructive/40" : done ? "border-primary" : "border-border"}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-4 p-4 text-left">
        {cover ? <img src={cover} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-ink"><Disc3 className="h-5 w-5 text-primary" /></div>}
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{r.track.title || "Untitled"}</div>
          <div className="truncate text-sm text-muted-foreground">{r.track.artist}{r.track.metadata.isrc ? ` · ${r.track.metadata.isrc}` : ""}</div>
        </div>
        <div className="hidden gap-1.5 md:flex" aria-hidden>
          {r.pillars.map((p) => <span key={p.pillar} title={pillarLabel(p.pillar, country)} className={`h-2.5 w-8 rounded-full ${p.state === "confirmed" ? "bg-primary" : p.state === "missing" ? "bg-destructive" : "bg-muted-foreground/25"}`} />)}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${action ? "bg-destructive/10 text-destructive" : done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          {action ? `${action} to fix` : done ? "Healthy" : "Check status"}
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="grid gap-6 border-t border-border p-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-3">
            <LiveRecords r={r} running={running} onRun={() => actions.onRunOne(r.track.id)} />
            {warn.length > 0 && <ul className="space-y-1.5">
              {warn.map((f, k) => <li key={k}><button type="button" onClick={() => f.field && actions.onFixField(r.track.id, f.field === "writers" ? "writers-0-legalName" : f.field)} className="text-left text-sm hover:text-primary">⚠️ {f.text} {f.field && <span className="font-semibold text-primary underline">Fix</span>}</button></li>)}
            </ul>}
          </div>
          <div className="space-y-5">
            {r.pillars.map((p) => <PillarBlock key={p.pillar} row={p} track={r.track} country={country} actions={actions} />)}
            {!r.pillars.length && <p className="text-sm text-muted-foreground">Add your writers' PRO in My Catalog to track this song's registrations.</p>}
          </div>
        </div>
      )}
    </li>
  );
}

export function HealthReport({ report, country, running, ...actions }: Props) {
  const [open, setOpen] = useState<string | undefined>(report.rows.find((r) => r.issues.length)?.track.id ?? report.rows[0]?.track.id);
  const societies = [...new Map(Object.values(country.societies).flat().map((s) => [s!.id, s!])).values()];
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-ink p-6 text-ink-foreground md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Royalty Health Check</h2>
            <p className="mt-2 max-w-xl text-ink-muted">
              Your catalog checked against {societies.length ? societies.map((s) => s.name).join(", ") : "your own PRO"}, plus live streaming and MusicBrainz records.
            </p>
          </div>
          <CountryPicker country={country} onCountry={actions.onCountry} />
        </div>
        {country.note && <p className="mt-4 rounded-xl border border-ink-border px-4 py-2 text-sm text-ink-muted">{country.note}</p>}
        {report.rows.length > 0 && (
          <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-center">
            <ScoreRing value={report.score} />
            <div className="grid flex-1 gap-3 sm:grid-cols-3">
              <Stat label="Data complete" value={`${report.dataScore}%`} sub="Everything each society needs to match and pay you" />
              <Stat label="Registered" value={`${report.confirmed} of ${report.cells}`} sub="Confirmed in a society's records" />
              <Stat label="Need action" value={`${report.needsAction}`} sub={`of ${report.rows.length} song${report.rows.length === 1 ? "" : "s"}`} />
            </div>
          </div>
        )}
        {report.rows.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button type="button" size="lg" onClick={actions.onRunAll} disabled={!!running}><Radar className={running ? "animate-spin" : ""} />{running ? `Looking up ${running.done + 1} of ${running.total}…` : "Run live lookups"}</Button>
            <span className="text-xs text-ink-muted">Checks streaming and MusicBrainz for every song. Societies without an open lookup are tracked with Found it / Not listed.</span>
          </div>
        )}
      </section>

      {report.rows.length === 0 ? (
        <div className="rounded-2xl border border-border p-8 text-center"><p className="font-semibold">Add songs to My Catalog to run your free health check.</p></div>
      ) : <>
        <div className="grid gap-4 md:grid-cols-3">
          {report.byPillar.map((p) => (
            <div key={p.pillar} className="rounded-2xl border border-border bg-card p-5">
              <div className="text-sm font-extrabold uppercase tracking-[2px] text-primary">{pillarLabel(p.pillar, country)}</div>
              <p className="mt-1 text-sm text-muted-foreground">{PILLAR_HINT[p.pillar]}</p>
              <div className="mt-4 flex items-baseline justify-between text-sm"><span className="font-semibold">Registered</span><span>{p.confirmed} of {p.total}</span></div>
              <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${(p.confirmed / p.total) * 100}%` }} /></div>
              <div className="mt-3 flex items-baseline justify-between text-sm"><span className="font-semibold">Data complete</span><span>{p.dataOk} of {p.total}</span></div>
              <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-foreground transition-all" style={{ width: `${(p.dataOk / p.total) * 100}%` }} /></div>
            </div>
          ))}
        </div>

        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-xl font-bold">Your songs</h3>
            <button type="button" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
              onClick={() => { void navigator.clipboard?.writeText(report.rows.map((r) => r.track.title).join("\n")); toast.success("Song titles copied."); }}><Copy className="h-4 w-4" />Copy all titles</button>
          </div>
          <ul className="space-y-3">
            {report.rows.map((r) => <SongCard key={r.track.id} r={r} country={country} actions={actions} running={running?.trackId === r.track.id}
              open={open === r.track.id} onToggle={() => setOpen(open === r.track.id ? undefined : r.track.id)} />)}
          </ul>
        </div>
      </>}
    </div>
  );
}
