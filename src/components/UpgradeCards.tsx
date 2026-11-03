import { Button } from "@/components/ui/button";
import { PLAN_TIERS, TIER_LABEL, type Tier } from "@/lib/plans";
import { UPGRADE_CARDS } from "@/lib/upgrade-cards";

const priceOf = (tier: Tier) => PLAN_TIERS.find((p) => p.tier === tier)?.price ?? "";

/** Free accounts see this after a diagnosis. Each button opens checkout for that tier. */
export function UpgradeCards({ onUpgrade }: { onUpgrade: (priceId: string) => void }) {
  return (
    <section aria-labelledby="upgrade-cards" className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[2px] text-primary">
          Your diagnosis is saved
        </p>
        <h3 id="upgrade-cards" className="mt-1 text-xl font-bold">
          Treatments that need a plan
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your report, your prescriptions and your Song Health Checklist stay free. These unlock the
          fixes that live in a catalog.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {UPGRADE_CARDS.map((c) => (
          <article
            key={c.tier}
            className="flex flex-col rounded-2xl border-2 border-border bg-card p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-[2px] text-muted-foreground">
              {TIER_LABEL[c.tier]} — {priceOf(c.tier)}/yr
            </p>
            <h4 className="mt-2 text-lg font-bold leading-snug">{c.title}</h4>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{c.body}</p>
            <Button className="mt-4" onClick={() => onUpgrade(c.priceId)}>
              {c.cta} — {priceOf(c.tier)}/yr
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">{c.includes}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
