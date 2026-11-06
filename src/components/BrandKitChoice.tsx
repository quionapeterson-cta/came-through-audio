import type { KitChoice } from "@/hooks/useBrandKits";

/**
 * Which kit brands this download (founder, 2026-11-06). With one kit there is nothing to choose, so it draws nothing at
 * all; the server still decides, and a kit outside their allowance falls back to their first.
 */
export function BrandKitChoice({ kits, kitId, onChange }: { kits: KitChoice[]; kitId: string | undefined; onChange: (id: string) => void }) {
  if (kits.length < 2) return null;
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      Brand kit
      <select
        value={kitId ?? kits[0]!.id}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Which brand kit to use"
        className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {kits.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
      </select>
    </label>
  );
}
