import { useEffect, useState } from "react";

/**
 * A glass tube of liquid Gold (light) or Platinum (Studio Mode). Fills from empty on mount, then eases to new
 * values. `live` adds the rippling surface, sloshing front and bubbles, for tubes tall enough to show them.
 */
export function HealthLiquid({ pct, className = "h-1.5", ticks, live }: { pct: number; className?: string; ticks?: boolean; live?: boolean }) {
  const [shown, setShown] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setShown(pct)); return () => cancelAnimationFrame(id); }, [pct]);
  return (
    <div className={`relative overflow-hidden rounded-full border border-border bg-[var(--meter-glass)] shadow-inner ${className}`}>
      <div className="health-liquid" style={{ width: `${shown}%` }}>
        {live && shown > 0 && <>
          <span className="health-wave" aria-hidden />
          {shown < 100 && <span className="health-front" aria-hidden />}
          {[8, 25, 42, 59, 76].map((left, i) => <span key={left} className="health-bubble" aria-hidden style={{ left: `${left}%`, animationDelay: `${i * 0.7}s` }} />)}
        </>}
      </div>
      {ticks && [25, 50, 75].map((t) => <span key={t} aria-hidden className="absolute inset-y-0 w-px bg-foreground/20" style={{ left: `${t}%` }} />)}
    </div>
  );
}

/**
 * My Catalog's master health meter: how ready the catalog is to register, ticked off by the catalog itself.
 * Registrations the user has ticked show underneath but don't move it. Clicking it opens the song furthest from ready.
 */
export function HealthMeter({ pct, ready, registered, total, next, onNext }: { pct: number; ready: number; registered: { done: number; total: number }; total: number; next?: string | undefined; onNext?: () => void }) {
  return (
    <button type="button" onClick={onNext} disabled={!next}
      aria-label={`Catalog health ${pct}% ready to register.${next ? ` Open ${next}, the song furthest from ready.` : ""}`}
      className="group grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background enabled:cursor-pointer">
      <span className="grid">
        <span className="text-[0.65rem] font-bold uppercase tracking-[2px] text-muted-foreground">Catalog health</span>
        <span className="text-5xl font-extrabold leading-none tabular-nums tracking-tight">{pct}<span className="text-lg">%</span></span>
        <span className="mt-1 text-[0.65rem] font-semibold text-muted-foreground">ready to register</span>
      </span>
      <span className="grid min-w-0 gap-1.5">
        <HealthLiquid pct={pct} ticks live className="h-7" />
        <span className="flex justify-between px-0.5 text-[0.6rem] tabular-nums text-muted-foreground" aria-hidden>{[0, 25, 50, 75, 100].map((t) => <span key={t}>{t}</span>)}</span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span><b className="text-foreground">{ready} of {total}</b> {total === 1 ? "song" : "songs"} ready to register</span>
          {registered.total > 0 && <span>Registered <b className="text-foreground">{registered.done} of {registered.total}</b></span>}
          {next ? <span className="font-semibold text-primary group-hover:underline">Fix next: {next} →</span> : total > 0 && <span className="font-semibold text-primary">{registered.done < registered.total ? "Every song is ready. Register them in the Royalty Health Hub." : "Every song is ready and registered."}</span>}
        </span>
      </span>
    </button>
  );
}
