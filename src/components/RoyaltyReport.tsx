import { ScoreInfo } from "@/components/ScoreInfo";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, FileDown, Lock, PlayCircle, Stethoscope } from "lucide-react";
import { Explainer } from "@/components/Explainer";
import { Button } from "@/components/ui/button";
import { ArtDefs, BodyDiagram, MiniRhythm, MONITOR, OrganIcon, RHYTHM, Scan, Tool } from "@/components/royalty-art";
import { CLEAR_DX, CLEAR_WHAT, STATE_LABEL, type Checkup, type Finding, type Organ, type OrganId, type OrganState, type StepAction, type TreatmentStep, sinceLast } from "@/lib/royalty-checkup";

type Props = {
  checkup: Checkup;
  since: ReturnType<typeof sinceLast>;
  date: string;
  country: string;
  countryPicker?: ReactNode;
  running?: boolean;
  canExport: boolean;
  onRunCheckup: () => void;
  onPdf?: (() => void) | undefined;
  onAction: (a: StepAction) => void;
  onExpert: () => void;
  onReminder: (calendar: "google" | "ics") => void;
  /** Shown when a co-writer is missing their PRO or IPI. */
  onAskCowriter?: (() => void) | undefined;
  /** What this check covered ("Song A", "Summer Tape (EP)", "Whole catalog"), and the way back to the Hub. */
  scope?: string | undefined;
  onBack?: (() => void) | undefined;
  /** Songs not released yet: their Release checklist, shown as a pre-distribution reading (PLAN-pre-distribution). */
  prerelease?: { id: string; title: string; pct: number; items: { title: string; done: boolean; optional?: boolean | undefined }[] }[] | undefined;
};

const KEY: [OrganState, string, string][] = [
  ["healthy", "Healthy · steady rhythm", "bg-primary"],
  ["watch", "Watch · uneven rhythm", ""],
  ["treat", "Needs treatment · irregular rhythm", ""],
  ["noflow", "No flow · no signal", ""],
];
const VITALS: [OrganId, string][] = [["heart", "Heart"], ["lungs", "Breathing"], ["kidneys", "Filtering"], ["brain", "Reflexes"]];
const VITAL_WORD: Record<OrganState, string> = { healthy: "Healthy", watch: "Watch", treat: "Needs treatment", noflow: "No flow" };

/** The button under a treatment step. One-click agency files stay on Catalog & Collaborate. */
function stepButton(a: StepAction, canExport: boolean): { label: string; locked?: boolean } {
  switch (a.kind) {
    case "field": return { label: "Open the field" };
    case "download": return canExport ? { label: "Download the file" } : { label: "Get the 1-click file", locked: true };
    case "portal": return { label: `Open ${a.name}` };
    case "tick": return { label: "Open the checklist" };
    case "split": return { label: "Send a split sheet" };
    case "join": return { label: "See the PRO list" };
    case "distributor": return { label: "Copy the message" };
    case "changes": return { label: "Open the song" };
    case "upload": return { label: "Upload agency lists" };
  }
}

/** The Royalty Health Report: the clickable body, the main finding with its ℞ treatment, and a full report per organ. */
export function RoyaltyReport({ checkup, since, date, country, countryPicker, running, canExport, onRunCheckup, onPdf, onAction, onExpert, onReminder, onAskCowriter, scope, onBack, prerelease }: Props) {
  const { organs, lead } = checkup;
  const first = lead?.organ ?? organs.find((o) => o.state !== "healthy")?.id ?? organs[0]!.id;
  const [selected, setSelected] = useState<OrganId>(first);
  useEffect(() => { if (!organs.some((o) => o.id === selected)) setSelected(first); }, [organs]); // eslint-disable-line react-hooks/exhaustive-deps
  const reportRef = useRef<HTMLDivElement>(null);
  const open = (id: OrganId, scroll = true) => { setSelected(id); if (scroll) setTimeout(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 30); };
  const organ = organs.find((o) => o.id === selected) ?? organs[0]!;
  const ring = Math.round((checkup.score / 100) * 188.5 * 10) / 10;
  const [explain, setExplain] = useState<Finding | null>(null);
  // 100% royalty health: the score pulses green (the night sky is for a fully completed catalog, in My Catalog).

  return (
    <div className="rr space-y-8">
      <ArtDefs />
      {onBack && <Button variant="ghost" className="-mb-4" onClick={onBack}><ChevronLeft />Back to the Hub</Button>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="rr-eyebrow text-primary">Checkup · {date} · {scope ? `${scope}${scope.startsWith("Whole") || scope.includes("(") ? ` · ${checkup.songs} song${checkup.songs === 1 ? "" : "s"}` : ""}` : `${checkup.songs} song${checkup.songs === 1 ? "" : "s"}`} · {country}</div>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">Royalty Health Report</h2>
          <p className="mt-1 text-muted-foreground">A checkup on every way your music gets paid, and exactly how to fix what's blocking it.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {countryPicker}
          {onPdf && <Button variant="outline" onClick={onPdf}><FileDown />Download PDF</Button>}
          <Button onClick={onRunCheckup} disabled={running}><Stethoscope />{running ? "Checking…" : "Run it again"}</Button>
        </div>
      </div>

      {!!prerelease?.length && (
        <section aria-label="Pre-distribution reading" className="rounded-2xl border-2 border-dashed border-primary/60 bg-primary/5 p-5">
          <h3 className="flex flex-wrap items-center gap-2 text-lg font-extrabold"><span className="rounded bg-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-[2px] text-ink-foreground">Pre-release</span>Pre-distribution reading</h3>
          <p className="mt-1 text-sm text-muted-foreground">Not out yet, so these are read for what to have ready before you distribute. Nothing that only applies after release counts against them.</p>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {prerelease.map((p) => (
              <li key={p.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-baseline justify-between gap-3"><span className="truncate font-bold">{p.title}</span><span className="shrink-0 text-sm font-semibold text-primary">{p.pct}% ready to distribute</span></div>
                <ul className="mt-2 space-y-1 text-sm">
                  {p.items.map((i) => <li key={i.title} className="flex items-start gap-2">{i.done ? <span className="text-primary">✓</span> : <span>{i.optional ? "○" : "⚠️"}</span>}<span className={i.done ? "text-muted-foreground" : ""}>{i.title}</span></li>)}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rr-hero" aria-label="Checkup summary">
        <figure className="rr-body">
          <BodyDiagram organs={organs} selected={selected} onSelect={(id) => open(id)} />
          <figcaption className="rr-hint">Tap an organ to open its report</figcaption>
        </figure>
        <div className="flex min-w-0 flex-col gap-5">
          <div className={`rr-score${checkup.score === 100 ? " rr-score-win" : ""}`}>
            <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="30" fill="none" stroke="var(--rr-hero-line)" strokeWidth="7" />
              <circle className="rr-gauge" cx="36" cy="36" r="30" fill="none" stroke="var(--rr-prestige)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${ring} 188.5`} transform="rotate(-90 36 36)" /></svg>
            <div><div className="text-3xl font-extrabold leading-none">{checkup.score}%</div>
              <div className="rr-muted text-sm">Overall health{since ? ` · ${since.delta >= 0 ? "up" : "down"} ${Math.abs(since.delta)} since your last report` : ""}</div></div>
          </div>
          <ScoreInfo />
          <div className="rr-monitor" aria-label={`Royalty rhythm: ${RHYTHM[checkup.rhythm].label}`}>
            <span className="rr-eyebrow" style={{ color: "var(--rr-pink)" }}>Royalty<br />rhythm</span>
            <svg viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true"><path key={checkup.rhythm} className="rr-ekg" d={MONITOR[checkup.rhythm]} fill="none" stroke={RHYTHM[checkup.rhythm].color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" /></svg>
            <span className="rr-muted text-right text-xs"><b className="block text-sm text-white">{RHYTHM[checkup.rhythm].label.split(" · ")[0]}</b>{organs.filter((o) => o.state !== "healthy").length || "No"} organ{organs.filter((o) => o.state !== "healthy").length === 1 ? "" : "s"} to treat</span>
          </div>
          <div className="rr-vitals">
            {VITALS.map(([id, label]) => {
              const o = organs.find((x) => x.id === id);
              return o && <button type="button" key={id} onClick={() => open(id)} className="rr-vital text-left hover:border-white/40">
                <OrganIcon organ={o} className="h-7 w-7" /><span><b className="block text-sm">{label}</b><span className="rr-muted text-xs">{VITAL_WORD[o.state]}</span></span>
              </button>;
            })}
          </div>

          <div className="rr-eyebrow" style={{ color: "var(--rr-pink)" }}>Main finding</div>
          {lead ? <>
            <h3 className="-mt-3 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">{lead.dx}</h3>
            <p className="rr-muted -mt-2 max-w-[60ch] text-lg">{lead.what} <b className="text-white">Cause:</b> {lead.cause}</p>
            <div className="rr-pad">
              <div className="flex items-center gap-2"><span className="rr-rx" aria-hidden="true">℞</span><span className="rr-eyebrow" style={{ color: "var(--rr-prestige)" }}>Treatment plan</span></div>
              <ol className="rr-num mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {lead.steps.map((s) => <li key={s.title} className="rr-muted flex flex-col gap-2 text-sm"><span><b className="font-semibold text-white">{s.title}.</b> {s.text}</span></li>)}
              </ol>
              {lead.note && <p className="rr-muted mt-3 text-sm italic">{lead.note}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setExplain(lead)}><PlayCircle />Watch the 30-second explainer</Button>
              <Button variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10" onClick={() => open(lead.organ)}>Open the {organs.find((o) => o.id === lead.organ)?.name.toLowerCase()} report</Button>
              <Button variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10" onClick={onExpert}>Let our agents do it</Button>
            </div>
          </> : <>
            <h3 className="-mt-3 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">{CLEAR_DX}</h3>
            <p className="rr-muted -mt-2 max-w-[60ch] text-lg">{CLEAR_WHAT} Next checkup suggested in 90 days.</p>
          </>}
          {since && (since.healed.length > 0 || since.fresh > 0) && <div className="flex flex-wrap gap-2 text-xs">
            {since.healed.length > 0 && <span className="rounded-full border px-3 py-1.5" style={{ borderColor: "var(--rr-hero-line)" }}><b>Healed:</b> {since.healed.join(", ")}</span>}
            {since.fresh > 0 && <span className="rounded-full border px-3 py-1.5" style={{ borderColor: "var(--rr-hero-line)" }}><b>New:</b> {since.fresh} finding{since.fresh === 1 ? "" : "s"}</span>}
          </div>}
          <p className="rr-muted text-xs">Based on your catalog, the steps you've confirmed and live streaming lookups. Agency databases can't be searched automatically yet; upload your agency lists to confirm for real.</p>
        </div>
      </section>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-2xl font-extrabold">Organ reports</h3><p className="text-sm text-muted-foreground">Select an organ to see its full report</p></div>
        <div className="rr-key mt-3 text-muted-foreground" aria-label="Colour key">
          {KEY.map(([s, label, cls]) => <span key={s} className="inline-flex items-center gap-2"><i className={cls} style={s === "watch" ? { background: "var(--rr-prestige)", outline: "1px solid var(--rr-c32)" } : s === "treat" ? { background: "var(--rr-heart)" } : s === "noflow" ? { border: "1.5px dashed var(--rr-hollow)" } : undefined} />{label}</span>)}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {organs.map((o) => (
            <button key={o.id} type="button" aria-pressed={o.id === selected} onClick={() => open(o.id, false)}
              className="rr-card flex min-h-36 flex-col gap-2 rounded-2xl border border-border bg-card p-4 text-left">
              <OrganIcon organ={o} /><span className="font-bold leading-tight">{o.name}</span><span className="text-xs leading-snug text-muted-foreground">{o.system}</span>
              <span className={`rr-pill rr-pill-${o.state} mt-auto`}>{STATE_LABEL[o.state]}{o.findings.length ? ` · ${new Set(o.findings.flatMap((f) => f.songs.map((s) => s.id))).size}` : ""}</span>
            </button>
          ))}
        </div>
        <div ref={reportRef} className="scroll-mt-4">
          <OrganReport key={organ.id} organ={organ} organs={organs} canExport={canExport} onAction={onAction} onOpen={(id) => open(id, false)} onExpert={onExpert} onReminder={onReminder} onExplain={setExplain} onAskCowriter={onAskCowriter} />
        </div>
      </div>
      <Explainer finding={explain} organ={explain ? organs.find((o) => o.id === explain.organ) : undefined} onClose={() => setExplain(null)} />
    </div>
  );
}

function OrganReport({ organ, organs, canExport, onAction, onOpen, onExpert, onReminder, onExplain, onAskCowriter }: { organ: Organ; organs: Organ[]; canExport: boolean; onAction: (a: StepAction) => void; onOpen: (id: OrganId) => void; onExpert: () => void; onReminder: (calendar: "google" | "ics") => void; onExplain: (f: Finding) => void; onAskCowriter?: (() => void) | undefined }) {
  const i = organs.findIndex((o) => o.id === organ.id);
  const prev = organs[(i + organs.length - 1) % organs.length]!, next = organs[(i + 1) % organs.length]!;
  const main = organ.findings[0];
  return (
    <article className="rr-rise mt-4 overflow-hidden rounded-3xl border border-border bg-card" aria-live="polite">
      <div className="rr-head grid grid-cols-[72px_minmax(0,1fr)] items-center gap-5 p-5 md:grid-cols-[112px_minmax(0,1fr)_auto] md:p-7">
        <OrganIcon organ={organ} className="h-[72px] w-[72px] md:h-28 md:w-28" />
        <div>
          <div className="rr-eyebrow" style={{ color: "var(--rr-cobalt-text)" }}>{organ.name} report · {organ.system}</div>
          <h4 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight md:text-3xl">{main?.dx ?? "Healthy and strong."}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{main?.what ?? "Everything we check for this organ passed."}</p>
        </div>
        <div className="col-span-2 flex flex-col items-start gap-1 md:col-span-1 md:items-end">
          <span className={`rr-pill rr-pill-${organ.state}`}>{STATE_LABEL[organ.state]}</span>
          <MiniRhythm state={organ.state} />
          <span className="text-[11px] text-muted-foreground">{RHYTHM[organ.state].label}</span>
        </div>
      </div>

      <div className="space-y-8 p-5 md:p-7">
        {organ.findings.length ? <>
          <div>
            <div className="rr-eyebrow mb-3" style={{ color: "var(--rr-cobalt-text)" }}>Scan results · {organ.findings.length} finding{organ.findings.length === 1 ? "" : "s"}</div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {organ.findings.map((f) => <a key={f.id} href={`#finding-${f.id}`} className="flex flex-col gap-2 no-underline">
                <Scan condition={f.scan} /><b className="leading-snug text-foreground">{f.dx}</b><span className="text-sm text-muted-foreground">{f.songs.length} song{f.songs.length === 1 ? "" : "s"} · {f.songs[0]!.why}{f.songs.length > 1 && f.songs.some((s) => s.why !== f.songs[0]!.why) ? " and more" : ""}</span>
              </a>)}
            </div>
          </div>
          {organ.findings.map((f, n) => <FindingBlock key={f.id} f={f} n={organ.findings.length > 1 ? n + 1 : 0} canExport={canExport} onAction={onAction} onExplain={() => onExplain(f)} />)}
          <div>
            <div className="rr-eyebrow mb-3">More ways to fix it</div>
            <div className="flex flex-wrap gap-2">
              {onAskCowriter && (organ.id === "heart" || organ.id === "brain") && <Button variant="outline" onClick={onAskCowriter}>Ask a co-writer for their PRO and IPI</Button>}
              <Button variant="outline" onClick={() => onReminder("google")}>Add a confirm reminder to Google Calendar</Button>
              <Button variant="outline" onClick={() => onReminder("ics")}>Apple or Outlook calendar (.ics)</Button>
              <Button variant="outline" onClick={onExpert}>Let our agents register them</Button>
            </div>
          </div>
        </> : <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><div className="flex flex-col gap-2"><Scan organ={organ} label="CLEAR SCAN" /><b>Healthy and strong.</b><span className="text-sm text-muted-foreground">Nothing to treat.</span></div></div>
          <div>
            <div className="rr-eyebrow mb-3" style={{ color: "var(--rr-cobalt-text)" }}>Checklist · what we examined</div>
            <ul className="grid gap-2 sm:grid-cols-2">{organ.checks.map((c) => <li key={c} className="rr-check rr-tint flex gap-3 rounded-xl p-3 text-sm">{c}</li>)}</ul>
          </div>
        </>}
      </div>
      <div className="flex justify-between gap-2 px-5 pb-5 md:px-7 md:pb-7">
        <Button variant="outline" onClick={() => onOpen(prev.id)}><ChevronLeft />{prev.name}</Button>
        <Button variant="outline" onClick={() => onOpen(next.id)}>{next.name}<ChevronRight /></Button>
      </div>
    </article>
  );
}

function FindingBlock({ f, n, canExport, onAction, onExplain }: { f: Finding; n: number; canExport: boolean; onAction: (a: StepAction) => void; onExplain: () => void }) {
  const locked = f.steps.some((s) => s.action?.kind === "download") && !canExport;
  return (
    <section id={`finding-${f.id}`} className="scroll-mt-4 space-y-5">
      <div className="rr-divider flex flex-wrap items-center justify-between gap-2 pb-3">
        <h5 className="text-lg font-extrabold">{n > 0 ? `Finding ${n} · ` : ""}{f.dx}</h5>
        <Button size="sm" variant="outline" onClick={onExplain}><PlayCircle />Watch the 30-second explainer</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rr-fact rounded-2xl p-4"><div className="rr-eyebrow" style={{ color: "var(--rr-cobalt-text)" }}>Symptom</div><p className="mt-2 text-sm">{f.symptom}</p></div>
        <div className="rr-fact rounded-2xl p-4"><div className="rr-eyebrow" style={{ color: "var(--rr-cobalt-text)" }}>Cause</div><p className="mt-2 text-sm">{f.cause}</p></div>
        <div className="rr-fact rounded-2xl p-4"><div className="rr-eyebrow" style={{ color: "var(--rr-cobalt-text)" }}>Songs affected</div>
          <ul className="mt-1 text-sm">{f.songs.slice(0, 8).map((s) => <li key={s.id + s.why} className="flex justify-between gap-2 border-t border-border py-1.5 first:border-t-0">
            {s.field ? <button type="button" className="truncate text-left font-medium text-primary underline-offset-2 hover:underline" onClick={() => onAction({ kind: "field", trackId: s.id, field: s.field! })}>⚠️ {s.title}</button>
              : <button type="button" className="truncate text-left font-medium text-primary underline-offset-2 hover:underline" onClick={() => onAction({ kind: "changes", trackId: s.id })}>{s.title}</button>}
            <small className="shrink-0 text-right text-xs text-muted-foreground">{s.why}</small></li>)}
            {f.songs.length > 8 && <li className="pt-1 text-xs text-muted-foreground">and {f.songs.length - 8} more</li>}</ul></div>
      </div>
      <div>
        <div className="flex items-center gap-2"><span className="rr-rx" aria-hidden="true">℞</span><span className="rr-eyebrow">Treatment plan · fix it at the agency, not just here</span></div>
        <ol className="rr-num mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {f.steps.map((s) => <Step key={s.title} s={s} canExport={canExport} onAction={onAction} />)}
        </ol>
        {locked && <p className="mt-2 text-xs text-muted-foreground">One-click agency files come with Catalog &amp; Collaborate and Catalog Management. On other plans, each song's checklist shows the same fields to copy by hand.</p>}
        {f.note && <p className="mt-3 border-l-[3px] pl-3 text-sm italic text-muted-foreground" style={{ borderColor: "var(--rr-prestige)" }}>{f.note}</p>}
      </div>
    </section>
  );
}

function Step({ s, canExport, onAction }: { s: TreatmentStep; canExport: boolean; onAction: (a: StepAction) => void }) {
  const b = s.action && stepButton(s.action, canExport);
  return (
    <li className="relative flex flex-col gap-3 rounded-2xl border border-border p-4">
      <div className="absolute right-4 top-4"><Tool kind={s.action?.kind} /></div>
      <b className="text-[15px] leading-snug">{s.title}</b>
      <span className="text-sm text-muted-foreground">{s.text}</span>
      {b && <Button className="mt-auto" variant={s.action!.kind === "field" ? "default" : "outline"} onClick={() => onAction(s.action!)}>{b.locked && <Lock />}{b.label}</Button>}
    </li>
  );
}
