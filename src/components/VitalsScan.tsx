import { useEffect, useState } from "react";
import { Activity, CheckCircle2, ClipboardList, Disc3, Loader2, Stethoscope } from "lucide-react";

/**
 * The nurse taking vitals (founder, 2026-11-11): a display-only module that sits on the Intake & records step, before
 * the Music Royalty Doctor sees the patient. It reads nothing and runs nothing — the Clinical Scan and every lookup stay exactly as
 * they were. Line art on Primary Black: an EKG trace, a low-opacity registry ticker, and four vitals that settle in turn.
 */
export const VITALS = [
  { label: "Taking the catalog's pulse…", Icon: Activity },
  { label: "Reading the writer chart…", Icon: ClipboardList },
  { label: "Checking release circulation…", Icon: Disc3 },
  { label: "Vitals ready for the Music Royalty Doctor", Icon: Stethoscope },
] as const;
/** The registries the ticker names. Decorative, so it stays out of the screen reader's way. */
const QUERIED = ["ASCAP", "BMI", "SESAC", "GMR", "The MLC", "SoundExchange", "Songview", "HFA"] as const;
/** Two beats of the trace across the whole window, so the scrolling loop has no seam. */
const BEAT = "M0 42 H44 L52 42 L58 14 L66 66 L74 42 H120 L128 42 L134 28 L140 54 L146 42 H196 L204 42 L210 10 L218 70 L226 42 H272 L280 42 L286 30 L292 52 L298 42 H400";

/**
 * What the vitals found (founder, 2026-11-11): the numbers the hub's black banner used to carry — songs set up to get
 * paid, the fix / register / confirm counts and how many songs the streaming lookup has reached. Read from the same
 * report the banner read; shown once the four vitals have settled, as a strip under them, so the approved monitor above
 * is untouched.
 */
export type VitalReadings = { ready: number; total: number; fix: number; register: number; confirm: number; looked: number };

export function VitalsScan({ step = 1400, readings }: { step?: number; readings?: VitalReadings | undefined }) {
  const [at, setAt] = useState(0);
  useEffect(() => {
    if (at >= VITALS.length) return;
    const t = setTimeout(() => setAt((n) => n + 1), step);
    return () => clearTimeout(t);
  }, [at, step]);
  const done = at >= VITALS.length;
  return (
    <section aria-label="Vitals" className="overflow-hidden rounded-xl border border-ink-border bg-ink text-ink-foreground shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-ink-border px-3 py-1.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-electric">Nurse · Vitals</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-muted">{done ? "Recorded" : "Taking vitals"}</p>
      </div>
      <div className="relative h-16 border-b border-ink-border">
        <svg viewBox="0 0 400 80" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <g className={`text-electric ${done ? "" : "vitals-trace"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
            <path d={BEAT} />
            <path d={BEAT} transform="translate(400 0)" />
          </g>
        </svg>
      </div>
      <div className="grid gap-3 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <ol className="space-y-1.5" role="status" aria-live="polite">
          {VITALS.map(({ label, Icon }, i) => (
            <li key={label} className={`flex items-center gap-2 text-xs ${i === at ? "font-semibold text-ink-foreground" : i < at ? "text-ink-muted" : "text-ink-muted/50"}`}>
              {i < at ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-electric" aria-hidden />
                : i === at ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-electric" aria-hidden />
                : <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
              <span>{label}</span>
            </li>
          ))}
        </ol>
        <div className="vitals-ticker hidden h-[4.75rem] sm:block" aria-hidden="true">
          <ul className={done ? "" : "vitals-ticker-list"}>
            {[...QUERIED, ...QUERIED].map((r, i) => <li key={`${r}-${i}`}>Querying {r}…</li>)}
          </ul>
        </div>
      </div>
      {done && readings && readings.total > 0 && (
        <dl className="grid grid-cols-2 gap-px border-t border-ink-border bg-ink-border sm:grid-cols-5">
          <Reading label="Set up to get paid" value={`${readings.ready} of ${readings.total}`} strong />
          <Reading label="To fix" value={readings.fix} />
          <Reading label="To register" value={readings.register} />
          <Reading label="To confirm" value={readings.confirm} />
          <Reading label="Streaming checked" value={`${readings.looked} of ${readings.total}`} />
        </dl>
      )}
    </section>
  );
}

function Reading({ label, value, strong = false }: { label: string; value: string | number; strong?: boolean }) {
  return (
    <div className="bg-ink px-3 py-2">
      <dt className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink-muted">{label}</dt>
      <dd className={`mt-0.5 text-sm font-bold tabular-nums ${strong ? "text-electric" : "text-ink-foreground"}`}>{value}</dd>
    </div>
  );
}
