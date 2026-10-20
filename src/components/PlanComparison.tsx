import { Fragment } from "react";
import { Check, Infinity as InfinityIcon, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/InfoTip";
import { PLAN_FEATURES, PLAN_TIERS, TIER_LABEL, hasTier, rememberPlanIntent, type Feature, type PlanTier, type Tier } from "@/lib/plans";

export type PlanAction = { label: string; disabled?: boolean; onClick?: () => void };

const GROUPS = [...new Set(PLAN_FEATURES.map((f) => f.group))];

/**
 * Plans as one comparison chart: every benefit is a row across all four plans, so the list visibly grows as the
 * price goes up. A filled check marks what a plan adds; a plain check is carried over from the plan before.
 * The highlighted column is the viewer's own plan, or "Most popular" when nobody is signed in.
 */
export function PlanComparison({ currentTier, action }: { currentTier?: Tier | undefined; action: (p: PlanTier) => PlanAction }) {
  const highlight: Tier = currentTier ?? "collaborate";
  const tag = currentTier ? "Your plan" : "Most popular";

  return (
    <>
      <p className="flex items-center justify-center gap-2 text-center text-lg font-extrabold uppercase tracking-[2px] text-primary">
        <InfinityIcon className="h-6 w-6 shrink-0" strokeWidth={3} />Every feature. Unlimited. No per-song fees.
      </p>

      {/* Desktop: one aligned grid. */}
      <div className="mt-8 hidden grid-cols-[minmax(13rem,1.5fr)_repeat(4,minmax(0,1fr))] md:grid" role="table" aria-label="Plan comparison">
        <div role="columnheader" className="flex items-end pb-4 pr-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><NewCheck />New in this plan</span>
          <span className="ml-3 flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" strokeWidth={3} />Included</span>
        </div>
        {PLAN_TIERS.map((p) => (
          <Header key={p.tier} plan={p} on={p.tier === highlight} tag={tag} action={action(p)} />
        ))}
        {GROUPS.map((group) => (
          <Fragment key={group}>
            <div role="rowheader" className="col-span-5 grid grid-cols-subgrid">
              <div className="border-b border-border pb-2 pt-6 text-xs font-bold uppercase tracking-[2px] text-primary">{group}</div>
              {PLAN_TIERS.map((p) => <div key={p.tier} className={`border-b border-border ${p.tier === highlight ? "border-x-2 border-x-primary bg-primary/5" : ""}`} />)}
            </div>
            {PLAN_FEATURES.filter((f) => f.group === group).map((f) => (
              <div key={f.title} role="row" className="col-span-5 grid grid-cols-subgrid">
                <div role="cell" className="border-b border-border py-3 pr-4"><FeatureName feature={f} /></div>
                {PLAN_TIERS.map((p) => (
                  <div key={p.tier} role="cell" className={`flex items-center justify-center border-b border-border py-3 ${p.tier === highlight ? "border-x-2 border-x-primary bg-primary/5" : ""}`}>
                    <Mark feature={f} tier={p.tier} />
                  </div>
                ))}
              </div>
            ))}
          </Fragment>
        ))}
        <div className="col-span-5 grid grid-cols-subgrid">
          <div />
          {PLAN_TIERS.map((p) => <div key={p.tier} className={p.tier === highlight ? "h-3 rounded-b-2xl border-x-2 border-b-2 border-primary bg-primary/5" : ""} />)}
        </div>
      </div>

      {/* Mobile: one card per plan, each with the full list so the comparison still reads. */}
      <div className="mt-6 space-y-6 md:hidden">
        {PLAN_TIERS.map((p) => {
          const on = p.tier === highlight;
          const a = action(p);
          return (
            <div key={p.tier} className={`rounded-2xl p-5 ${on ? "border-2 border-primary bg-primary/5" : "border border-border"}`}>
              {on && <Tag text={tag} />}
              <Price plan={p} />
              <Button className="mt-4 w-full" variant={on ? "default" : "outline"} disabled={a.disabled} onClick={a.onClick}>{a.label}</Button>
              <ul className="mt-5 space-y-2.5">
                {PLAN_FEATURES.map((f) => (
                  <li key={f.title} className={`flex items-start gap-2 text-sm ${hasTier(p.tier, f.from) ? "" : "text-muted-foreground/60"}`}>
                    <span className="mt-0.5"><Mark feature={f} tier={p.tier} /></span><FeatureName feature={f} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Header({ plan, on, tag, action }: { plan: PlanTier; on: boolean; tag: string; action: PlanAction }) {
  return (
    <div role="columnheader" className={`flex flex-col px-3 pb-4 pt-5 text-center ${on ? "rounded-t-2xl border-x-2 border-t-2 border-primary bg-primary/5" : ""}`}>
      <div className="h-6">{on && <Tag text={tag} />}</div>
      <Price plan={plan} />
      <Button className="mt-4 w-full" variant={on ? "default" : "outline"} disabled={action.disabled} onClick={action.onClick}>{action.label}</Button>
    </div>
  );
}

function Price({ plan }: { plan: PlanTier }) {
  return (
    <>
      {/* Two lines reserved for every name, so "Catalog Management" wrapping never pushes its price below the others. */}
      <div className="mt-1 flex min-h-12 items-center justify-center font-bold leading-tight text-primary md:min-h-12">{TIER_LABEL[plan.tier]}</div>
      <div className="mt-2 text-3xl font-bold lg:text-4xl">{plan.price}<span className="text-base font-semibold">{plan.priceId ? "/yr" : ""}</span></div>
      <div className="text-sm text-muted-foreground">{plan.monthly}</div>
      {/* Reserved on Free too, so every price block is the same height and the buttons line up. */}
      <div className="text-xs text-muted-foreground">{plan.priceId ? "Billed annually" : " "}</div>
    </>
  );
}

function Tag({ text }: { text: string }) {
  return <span className="inline-block rounded-full bg-primary px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-primary-foreground">{text}</span>;
}

function FeatureName({ feature }: { feature: Feature }) {
  return (
    <InfoTip title={feature.title} text={feature.tip} className="text-left">
        <span className="cursor-help text-sm font-semibold underline decoration-border decoration-dotted underline-offset-4">
          {feature.title}
          {feature.soon && <span className="ml-2 whitespace-nowrap rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground no-underline">Coming soon</span>}
        </span>
    </InfoTip>
  );
}

function NewCheck() {
  return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" strokeWidth={3.5} /></span>;
}

function Mark({ feature, tier }: { feature: Feature; tier: Tier }) {
  if (!hasTier(tier, feature.from)) return <Minus className="h-4 w-4 text-muted-foreground/50" aria-label="Not included" />;
  if (feature.from === tier) return <span aria-label="New in this plan"><NewCheck /></span>;
  return <Check className="h-5 w-5 text-primary" strokeWidth={3} aria-label="Included" />;
}

/**
 * Button for each plan, shared by /plans, the homepage and the workspace dialog. Signed out, a paid plan's button
 * remembers the pick and leads to signup; the workspace then opens that plan's checkout right after.
 */
export function planAction(p: PlanTier, o: { tier?: Tier | undefined; onBuy: (priceId: string) => void; onSignup: () => void }): PlanAction {
  if (!o.tier) return { label: p.priceId ? "Sign up to start" : "Sign up free", onClick: () => { rememberPlanIntent(p.priceId); o.onSignup(); } };
  if (o.tier === p.tier) return { label: "Current plan", disabled: true };
  if (hasTier(o.tier, p.tier) || !p.priceId) return { label: "Included", disabled: true };
  const priceId = p.priceId;
  return { label: o.tier === "free" ? "Get started" : "Upgrade", onClick: () => o.onBuy(priceId) };
}
