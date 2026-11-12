import { TERRITORY_EXTRA_OPTIONS } from "@/lib/repertoires";

/**
 * Territories of collection rights, laid out the way SoundExchange's own claim form does it (founder, 2026-11-12): the
 * United States is always on the claim, so it shows as a chip that cannot be removed, and the list adds what else the
 * recording earns in — Worldwide first. One extra territory is what the catalog holds, so picking another replaces it.
 */
export function TerritoriesField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const extra = (value ?? "").trim();
  // An answer this build doesn't list (an old saved value) stays selectable rather than silently clearing.
  const options = extra && !TERRITORY_EXTRA_OPTIONS.includes(extra) ? [extra, ...TERRITORY_EXTRA_OPTIONS] : TERRITORY_EXTRA_OPTIONS;
  return <div className="min-w-0 space-y-2">
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-full border border-input bg-muted px-2.5 py-1 text-xs text-muted-foreground">
        United States<span className="opacity-70">· included</span>
      </span>
      {extra && <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary">
        {extra}
        <button type="button" aria-label={`Remove ${extra}`} onClick={() => onChange("")}
          className="rounded-full px-1 text-primary/70 hover:text-primary">×</button>
      </span>}
    </div>
    <select id={id} value={extra} onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
      <option value="">Add a territory</option>
      {options.map((name) => <option key={name} value={name}>{name}</option>)}
    </select>
  </div>;
}
