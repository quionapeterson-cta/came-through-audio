import { Fragment, useState } from "react";
import { Check, Infinity as InfinityIcon, Minus, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/InfoTip";
import { EAGLE_ART } from "@/lib/eagle-status";
import { PLAN_FEATURES, PLAN_TIERS, TIER_LABEL, hasTier, rememberPlanIntent, type Feature, type PlanTier, type Tier } from "@/lib/plans";

export type PlanAction = { label: string; disabled?: boolean; onClick?: () => void };

const GROUPS = [...new Set(PLAN_FEATURES.map((f) => f.group))];

/**
 * The colours the chart draws in. `dark` is Primary Black with Electric Cobalt accents (Cobalt itself is only 2.4:1
 * on black); the light set is the original white-and-cobalt look.
 */
const TONES = {
  light: {
    accent: "text-primary", muted: "text-muted-foreground", border: "border-border",
    panel: "bg-primary/5", rule: "decoration-border", chip: "bg-muted text-muted-foreground",
    outline: "", minus: "text-muted-foreground/50",
  },
  dark: {
    accent: "text-brand-electric", muted: "text-ink-muted", border: "border-ink-border",
    panel: "bg-primary/10", rule: "decoration-ink-border", chip: "bg-ink-border text-ink-muted",
    // bg-transparent overrides the outline variant's white background, which left white text on white.
    outline: "border-ink-border bg-transparent text-ink-foreground shadow-none hover:bg-ink-border hover:text-ink-foreground", minus: "text-ink-muted/50",
  },
} as const;
type Tone = keyof typeof TONES;
type Palette = (typeof TONES)[Tone];

/** The chart's own surface. The reader picks it, and it fills the whole block, not just the price row. */
const SURFACE: Record<Tone, string> = {
  dark: "border-ink-border bg-ink text-ink-foreground",
  light: "border-border bg-background text-foreground",
};

/**
 * Plans as one comparison chart: every benefit is a row across all four plans, so the list visibly grows as the
 * price goes up. A filled check marks what a plan adds; a plain check is carried over from the plan before.
 * The highlighted column is the viewer's own plan, or "Most popular" when nobody is signed in.
 *
 * `tone` sets which surface the chart opens on: `dark` for the plans page, `light` for the homepage and the
 * workspace dialog. Either way the reader can flip it, and the whole block refills edge to edge.
 */
export function PlanComparison({ currentTier, action, note, tone = "light" }: { currentTier?: Tier | undefined; action: (p: PlanTier) => PlanAction; note?: string | undefined; tone?: Tone }) {
  const highlight: Tier = currentTier ?? "collaborate";
  const tag = currentTier ? "Your plan" : "Most popular";
  // The chart fills with one surface and everything inside uses the matching palette, so cobalt text never lands on ink.
  const [surfaceTone, setSurfaceTone] = useState<Tone>(tone);
  const t = TONES[surfaceTone];

  return (
    <div className={`rounded-3xl border p-5 sm:p-6 ${SURFACE[surfaceTone]}`}>
      <p className={`flex items-center justify-center gap-2 text-center text-lg font-extrabold uppercase tracking-[2px] ${t.accent}`}>
        <InfinityIcon className="h-6 w-6 shrink-0" strokeWidth={3} />Every feature. Unlimited. No per-song fees.
      </p>
      {note && <p className={`mt-2 text-center text-sm ${t.muted}`}>{note}</p>}

      {/* Light or dark, for the whole chart; the page around it keeps its own background. */}
      <div className="mt-4 flex items-center justify-end gap-2">
        <span className={`text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Card style</span>
        <div className={`inline-flex overflow-hidden rounded-full border ${t.border}`} role="group" aria-label="Tier card appearance">
          {(["light", "dark"] as const).map((mode) => (
            <button key={mode} type="button" onClick={() => setSurfaceTone(mode)} aria-pressed={surfaceTone === mode}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${surfaceTone === mode ? "bg-primary text-primary-foreground" : `${t.muted} hover:bg-primary/10`}`}>
              {mode === "light" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}{mode}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop: one aligned grid. */}
      <div className="mt-8 hidden grid-cols-[minmax(13rem,1.5fr)_repeat(4,minmax(0,1fr))] md:grid" role="table" aria-label="Plan comparison">
        <div role="columnheader" className={`flex items-end pb-4 pr-4 text-xs ${t.muted}`}>
          <span className="flex items-center gap-1.5"><NewCheck />New in this plan</span>
          <span className="ml-3 flex items-center gap-1.5"><Check className={`h-4 w-4 ${t.accent}`} strokeWidth={3} />Included</span>
        </div>
        {PLAN_TIERS.map((p) => (
          <Header key={p.tier} plan={p} on={p.tier === highlight} tag={tag} action={action(p)} t={t} />
        ))}
        {GROUPS.map((group) => (
          <Fragment key={group}>
            <div role="rowheader" className="col-span-5 grid grid-cols-subgrid">
              <div className={`border-b pb-2 pt-6 text-xs font-bold uppercase tracking-[2px] ${t.border} ${t.accent}`}>{group}</div>
              {PLAN_TIERS.map((p) => <div key={p.tier} className={`border-b ${t.border} ${p.tier === highlight ? `border-x-2 border-x-primary ${t.panel}` : ""}`} />)}
            </div>
            {PLAN_FEATURES.filter((f) => f.group === group).map((f) => (
              <div key={f.title} role="row" className="col-span-5 grid grid-cols-subgrid">
                <div role="cell" className={`border-b py-3 pr-4 ${t.border}`}><FeatureName feature={f} t={t} /></div>
                {PLAN_TIERS.map((p) => (
                  <div key={p.tier} role="cell" className={`flex items-center justify-center border-b py-1.5 ${t.border} ${p.tier === highlight ? `border-x-2 border-x-primary ${t.panel}` : ""}`}>
                    <Mark feature={f} tier={p.tier} t={t} />
                  </div>
                ))}
              </div>
            ))}
          </Fragment>
        ))}
        <div className="col-span-5 grid grid-cols-subgrid">
          <div />
          {PLAN_TIERS.map((p) => <div key={p.tier} className={p.tier === highlight ? `h-3 rounded-b-2xl border-x-2 border-b-2 border-primary ${t.panel}` : ""} />)}
        </div>
      </div>

      {/* Mobile: one card per plan, each with the full list so the comparison still reads. */}
      <div className="mt-6 space-y-6 md:hidden">
        {PLAN_TIERS.map((p) => {
          const on = p.tier === highlight;
          const a = action(p);
          return (
            <div key={p.tier} className={`rounded-2xl border p-5 ${on ? `border-2 border-primary ${t.panel}` : t.border}`}>
              {on && <Tag text={tag} />}
              <Price plan={p} t={t} />
              <Button className={`mt-4 w-full ${on ? "" : t.outline}`} variant={on ? "default" : "outline"} disabled={a.disabled} onClick={a.onClick}>{a.label}</Button>
              <ul className="mt-5 space-y-2.5">
                {PLAN_FEATURES.map((f) => (
                  <li key={f.title} className={`flex items-start gap-2 text-sm ${hasTier(p.tier, f.from) ? "" : `${t.muted} opacity-60`}`}>
                    <span className="mt-0.5"><Mark feature={f} tier={p.tier} t={t} /></span><FeatureName feature={f} t={t} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Header({ plan, on, tag, action, t }: { plan: PlanTier; on: boolean; tag: string; action: PlanAction; t: Palette }) {
  return (
    <div role="columnheader" className={`flex flex-col px-3 pb-4 pt-5 text-center ${on ? `rounded-t-2xl border-x-2 border-t-2 border-primary ${t.panel}` : ""}`}>
      <div className="h-6">{on && <Tag text={tag} />}</div>
      <Price plan={plan} t={t} />
      <Button className={`mt-4 w-full ${on ? "" : t.outline}`} variant={on ? "default" : "outline"} disabled={action.disabled} onClick={action.onClick}>{action.label}</Button>
    </div>
  );
}

function Price({ plan, t }: { plan: PlanTier; t: Palette }) {
  return (
    <>
      {/* The close-up eagle is the $89.99 plan's picture. The space is reserved on every column, so prices stay aligned. */}
      <div className="flex h-14 items-center justify-center">
        {plan.tier === "management" && <img src={EAGLE_ART.closeUp} alt="" aria-hidden className="h-14 w-14 object-contain" />}
      </div>
      {/* Two lines reserved for every name, so "Catalog Management" wrapping never pushes its price below the others. */}
      <div className={`mt-1 flex min-h-12 items-center justify-center font-bold leading-tight md:min-h-12 ${t.accent}`}>{TIER_LABEL[plan.tier]}</div>
      <div className="mt-2 text-3xl font-bold lg:text-4xl">{plan.price}<span className="text-base font-semibold">{plan.priceId ? "/yr" : ""}</span></div>
      <div className={`text-sm ${t.muted}`}>{plan.monthly}</div>
      {/* Reserved on Free too, so every price block is the same height and the buttons line up. */}
      <div className={`text-xs ${t.muted}`}>{plan.priceId ? "Billed annually" : " "}</div>
    </>
  );
}

function Tag({ text }: { text: string }) {
  return <span className="inline-block rounded-full bg-primary px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-primary-foreground">{text}</span>;
}

function FeatureName({ feature, t }: { feature: Feature; t: Palette }) {
  return (
    <InfoTip title={feature.title} text={feature.tip} className="text-left">
        <span className={`cursor-help text-sm font-semibold underline underline-offset-4 ${t.rule}`}>
          {feature.title}
          {feature.soon && <span className={`ml-2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider no-underline ${t.chip}`}>Coming soon</span>}
        </span>
    </InfoTip>
  );
}

function NewCheck() {
  return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" strokeWidth={3.5} /></span>;
}

function Mark({ feature, tier, t }: { feature: Feature; tier: Tier; t: Palette }) {
  if (!hasTier(tier, feature.from)) return <Minus className={`h-5 w-5 ${t.minus}`} aria-label="Not included" />;
  // An eagle marks the paperwork, wherever it is provided: contracts delivery on Split Sheet Generator in Catalog Plus,
  // Split Sheet E-Signature Request in Collaborate, and the contract rows in Catalog Management; every other Catalog
  // Management row gets the eye on the prize (founder art, 2026-11-03; extended to the lower tiers 2026-11-04).
  // Those files are square canvases with the eagle painted as a wide band across the middle (36% and 48% of the
  // height), so a square box with object-contain left the art about 20px tall. `object-cover` in a wide box crops the
  // transparent margins instead, which makes the eagle fill the cell at full size.
  // Eagle art is the mark wherever it appears, and nothing sits on top of it. Contracts delivery marks the paperwork
  // and signing rows (and 1-Click Agency Exports). The eye on the prize marks what Catalog Management alone has, plus
  // the rows marked `prize` wherever they are included (Royalty Utility Suite on Catalog & Collaborate).
  // Every other row carried over from a lower tier keeps the check it shows there (founder, 2026-11-04).
  const prize = feature.prize || (tier === "management" && feature.from === "management");
  const eagle = feature.paperwork ? EAGLE_ART.contractsDelivery : prize ? EAGLE_ART.eyeOnThePrize : null;
  if (eagle) {
    // A pair (founder, 2026-11-05): both eagles stay the full size a single one has; the second sits a step down and
    // right of the first, so the pair reads as one mark laid over another rather than two smaller marks side by side.
    const label = feature.from === tier ? "Included, new in this plan" : "Included";
    return (
      <span className="relative flex h-11 w-20 items-center justify-center md:h-16 md:w-32">
        <img src={eagle} alt={feature.eaglePair ? "" : label} aria-hidden={feature.eaglePair || undefined}
          className={`h-full w-full object-cover ${feature.eaglePair ? "-translate-x-1.5 -translate-y-1 opacity-90" : ""}`} />
        {feature.eaglePair && (
          <img src={eagle} alt={label}
            className="absolute inset-0 h-full w-full translate-x-1.5 translate-y-1 object-cover drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
        )}
      </span>
    );
  }
  if (feature.from === tier) return <span aria-label="New in this plan"><NewCheck /></span>;
  return <Check className={`h-6 w-6 ${t.accent}`} strokeWidth={3} aria-label="Included" />;
}

/**
 * Button for each plan, shared by /plans, the homepage and the workspace dialog. Signed out, a paid plan's button
 * remembers the pick and leads to signup; the workspace then opens that plan's checkout right after.
 */
export function planAction(p: PlanTier, o: { tier?: Tier | undefined; onBuy: (priceId: string) => void; onSignup: () => void }): PlanAction {
  // Paid tiers: create the account, then that tier's checkout opens (it needs the account to credit the payment).
  if (!o.tier) return { label: p.priceId ? "Sign up now" : "Sign up free", onClick: () => { rememberPlanIntent(p.priceId); o.onSignup(); } };
  if (o.tier === p.tier) return { label: "Current plan", disabled: true };
  if (hasTier(o.tier, p.tier) || !p.priceId) return { label: "Included", disabled: true };
  const priceId = p.priceId;
  return { label: o.tier === "free" ? "Get started" : "Upgrade", onClick: () => o.onBuy(priceId) };
}
