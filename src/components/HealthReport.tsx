import { ScoreInfo } from "@/components/ScoreInfo";
import type { ReactNode } from "react";
import { Check, Disc3, ExternalLink, Radar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Pillar } from "@/lib/audit";
import { readings, type healthReport, type RepertoireCheck, type TrackReport } from "@/lib/health";
import { registerGuide } from "@/lib/register-guides";
import { COUNTRIES, INTERNATIONAL, OTHER_COUNTRY, REGIONS, inCountry, type Country, type Society } from "@/lib/repertoires";
import { InfoTip } from "@/components/InfoTip";

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
/** `action`: the Hub's "Run a Royalty Health Check" button, under the country picker. */
type Props = HealthActions & { report: Report; country: Country; running?: Running | undefined; canCatalog: boolean; onEmbed: () => void; action?: ReactNode;
  /** The score, counts and streaming line. The hub turns them off: they read out in the nurse's vitals (founder, 2026-11-11). */
  showScore?: boolean;
  /** Where you get paid is asked at check-in now, so the Hub hides the control (PLAN-royalty-health-hub-v2 section 2). */
  pickCountry?: boolean };

function ScoreRing({ value }: { value: number }) {
  const r = 52, c = 2 * Math.PI * r;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--ink-border)" strokeWidth="11" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--primary)" strokeWidth="11" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold leading-none tabular-nums">{value}<span className="text-base">%</span></span>
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-ink-muted">Set up</span>
      </div>
    </div>
  );
}

export function CountryPicker({ country, onCountry, label = "Where you get paid" }: { country: Country; onCountry: (code: string) => void; label?: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[2px] text-ink-muted">
      {label}
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
/** Copies what to search for (the title, ISRC or writer name), then opens the society's site. */
export async function openSearch(society: Society, value: string) {
  try { await navigator.clipboard.writeText(value); toast.success(`"${value}" copied. Paste it into the ${society.name} search.`); } catch { /* opening still helps */ }
  window.open(society.url, "_blank", "noopener,noreferrer");
}

export function Guide({ society, pillar, country, title, onExpert, onDone }: { society: Society; pillar: Pillar; country: Country; title: string; onExpert: () => void; onDone?: (() => void) | undefined }) {
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
        {onDone && <Button type="button" size="sm" variant="outline" onClick={onDone}><Check />It's registered now</Button>}
        <Button type="button" size="sm" variant="ghost" onClick={onExpert}>Have an expert do it</Button>
      </div>
    </div>
  );
}

export function LiveRecords({ r, onRun, running }: { r: TrackReport; onRun: () => void; running: boolean }) {
  const checked = r.streaming?.checkedAt;
  const s = r.streaming?.hit;
  return (
    <div className="space-y-3 rounded-2xl bg-muted p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-extrabold uppercase tracking-[2px]">What the world sees</h4>
        <span className="flex items-center">
          <Button type="button" size="sm" variant="outline" disabled={running} onClick={onRun}><Radar className={running ? "animate-spin" : ""} />Check streaming</Button>
          <InfoTip title="Check streaming" text="Looks this song up on Deezer, a streaming service with an open catalog: whether its ISRC is live on streaming and how the title and artist are credited there." />
        </span>
      </div>
      {!checked && <p className="text-sm text-muted-foreground">{running ? "Looking this song up…" : "We'll look this song up on streaming."}</p>}
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
        <p className="text-xs text-muted-foreground">Agencies like SoundExchange and The MLC don't let apps look songs up, so confirm those with the checklist steps.</p>
      </>}
    </div>
  );
}

const STEP = { fix: "Fix song info", register: "Register", confirm: "Confirm" } as const;

export function HealthReport({ report, country, running, canCatalog, onEmbed, action, pickCountry = true, showScore = true, ...actions }: Props) {
  const { todos, ready, looked } = readings(report.rows);
  const counts = (["fix", "register", "confirm"] as const).map((k) => [k, todos.filter((t) => t.kind === k).length] as const);
  const where = inCountry(country);

  return (
    <div className="space-y-6">
      {/* The header is a slim navigation bar now, not a masthead: the Hub's work sits under it (redesign 2026-11-11). */}
      <section className="overflow-hidden rounded-xl bg-ink px-5 py-4 text-ink-foreground md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight md:text-2xl">Royalty Health Hub</h2>
            <p className="mt-1 max-w-xl text-sm text-ink-muted">{canCatalog || report.rows.length
              ? "Make sure every song is registered and matched, so every royalty it earns can reach you."
              : "Enter a song's details below to see if it's registered and matched, so every royalty it earns can reach you."}</p>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">{pickCountry && <CountryPicker country={country} onCountry={actions.onCountry} />}{action}</div>
        </div>
        {showScore && report.rows.length > 0 && (
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center">
            <ScoreRing value={report.score} />
            <div className="flex-1 space-y-2.5">
              <p className="text-base font-bold leading-snug md:text-lg">{ready} of {report.rows.length} song{report.rows.length === 1 ? " is" : "s are"} fully set up to get paid{where}.</p>
              <div className="flex flex-wrap gap-1.5">
                {counts.map(([k, n], i) => <span key={k} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${n ? "border-ink-border" : "border-primary/50 text-ink-muted"}`}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${n ? "bg-primary text-primary-foreground" : "bg-ink-border"}`}>{n ? i + 1 : <Check className="h-2.5 w-2.5" />}</span>
                  {STEP[k]}{n ? ` · ${n}` : ""}
                </span>)}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <Radar className={`h-4 w-4 ${running ? "animate-spin text-primary" : ""}`} />
                {running ? `Looking up song ${running.done + 1} of ${running.total} on streaming…` : `Live lookups ran for ${looked} of ${report.rows.length} songs.`}
                {!running && <button type="button" onClick={actions.onRunAll} className="font-semibold text-ink-foreground underline hover:text-primary">Check streaming for all</button>}
              </div>
              <ScoreInfo className="max-w-2xl" />
            </div>
          </div>
        )}
        {country.note && <p className="mt-3 rounded-lg border border-ink-border px-3 py-1.5 text-xs text-ink-muted">{country.note}</p>}
      </section>

      {report.rows.length === 0 ? (
        // Paid plans: shown only until the first song is saved. Free plans use the Royalty Inspector below instead.
        canCatalog ? (
          <div className="rounded-xl border border-border p-6 text-center">
            <p className="text-base font-semibold">Your songs are checked automatically.</p>
            <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">Every song you embed and save to My Catalog is checked on its own. Embed your first song, then run a Royalty Health Check to get its report.</p>
            <Button className="mt-3" size="sm" onClick={onEmbed}>Embed a song</Button>
          </div>
        ) : null
      ) : null}
    </div>
  );
}
