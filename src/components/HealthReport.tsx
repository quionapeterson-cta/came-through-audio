import { Check, Disc3, ExternalLink, Radar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Pillar } from "@/lib/audit";
import { todoList, type healthReport, type RepertoireCheck, type TrackReport } from "@/lib/health";
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
  const checked = r.streaming?.checkedAt ?? r.work?.checkedAt;
  const s = r.streaming?.hit, w = r.work?.hit;
  return (
    <div className="space-y-3 rounded-2xl bg-muted p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-extrabold uppercase tracking-[2px]">What the world sees</h4>
        <Button type="button" size="sm" variant="outline" disabled={running} onClick={onRun}><Radar className={running ? "animate-spin" : ""} />{checked ? "Re-check" : "Look up"}</Button>
      </div>
      {!checked && <p className="text-sm text-muted-foreground">{running ? "Looking this song up…" : "We'll look this song up on streaming and in MusicBrainz, the open, volunteer music database."}</p>}
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
          <div className="font-bold">In MusicBrainz <span className="font-normal text-muted-foreground">(the open, volunteer music database)</span></div>
          {w ? <div className="space-y-0.5">
            <a href={w.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline">{w.workTitle ?? w.recordingTitle} on {INTERNATIONAL.musicbrainz.name}<ExternalLink className="h-3 w-3" /></a>
            <div className="text-xs text-muted-foreground">{w.iswcs.length ? `ISWC ${w.iswcs.join(" / ")}` : "No ISWC on record"}{w.writers.length ? ` · Writers: ${w.writers.join(", ")}` : ""}</div>
          </div> : <span className="text-muted-foreground">Not listed there. That's normal for independent releases and doesn't affect your royalties. Agencies like SoundExchange and The MLC don't let apps look songs up, so confirm those with the checklist steps.</span>}
        </div>
      </>}
    </div>
  );
}

const STEP = { fix: "Fix song info", register: "Register", confirm: "Confirm" } as const;

export function HealthReport({ report, country, running, canCatalog, onEmbed, ...actions }: Props) {
  const needsPro = (r: TrackReport) => r.issues.some((i) => i.field?.endsWith("-pro"));
  const rowOf = (id: string) => report.rows.find((r) => r.track.id === id)!;
  const todos = todoList(report).filter((t) => !(t.kind === "confirm" && t.pillar === "performance" && needsPro(rowOf(t.track.id))));
  const needsWork = (r: TrackReport) => !(r.pillars.length && r.pillars.every((p) => p.state === "confirmed") && !r.issues.length && !r.findings.some((f) => f.level === "warn"));
  const ready = report.rows.filter((r) => !needsWork(r)).length;
  const looked = report.rows.filter((r) => r.streaming || r.work).length;
  const counts = (["fix", "register", "confirm"] as const).map((k) => [k, todos.filter((t) => t.kind === k).length] as const);
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
        // Paid plans: shown only until the first song is saved. Free plans use the Royalty Inspector below instead.
        canCatalog ? (
          <div className="rounded-2xl border border-border p-8 text-center">
            <p className="text-lg font-semibold">Your songs are checked automatically.</p>
            <p className="mx-auto mt-1 max-w-xl text-muted-foreground">Every song you embed and save to My Catalog runs through the Royalty Health Check on its own. Embed your first song to see its report here.</p>
            <Button className="mt-4" onClick={onEmbed}>Embed a song</Button>
          </div>
        ) : null
      ) : null}
    </div>
  );
}
