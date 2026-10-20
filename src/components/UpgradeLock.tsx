import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLAN_TIERS, TIER_LABEL, type Tier } from "@/lib/plans";

/** "$24.99/yr (about $2.08 a month)": a plan's price straight from the pricing list, so copy never drifts from the chart. */
export function planPrice(tier: Tier) {
  const p = PLAN_TIERS.find((t) => t.tier === tier);
  if (!p) return "";
  const monthly = /\$[\d.]+/.exec(p.monthly)?.[0];
  return `${p.price}/yr${monthly ? ` (about ${monthly} a month)` : ""}`;
}

/**
 * The one locked-feature screen: what the feature does, which plan includes it and its price, one See plans button,
 * and a free option when there is one. Every gated area uses it, so they all look and read the same.
 */
export function UpgradeLock({ title, text, tier, onUpgrade, free, className = "mt-6" }: {
  title: string; text: string; tier: Exclude<Tier, "free">; onUpgrade: () => void;
  free?: { label: string; onClick: () => void } | undefined; className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-primary bg-card p-8 text-center sm:p-10 ${className}`}>
      <Lock className="h-8 w-8 text-primary" aria-hidden />
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="max-w-lg text-muted-foreground">{text}</p>
      <p className="text-sm font-semibold">Included with {TIER_LABEL[tier]} · {planPrice(tier)}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Button onClick={onUpgrade}>See plans</Button>
        {free && <Button variant="outline" onClick={free.onClick}>{free.label}</Button>}
      </div>
    </div>
  );
}
