import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowUpRight,
  CircleDollarSign,
  Gauge,
  Package,
  Receipt,
  Shirt,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { BreakevenChartView } from "@/components/LabCharts";
import {
  PRODUCT_PRESETS,
  breakevenChart,
  clampUnits,
  merchMath,
  parseSalesEntry,
  presetOf,
  type ProductKind,
} from "@/lib/financial-lab-merch";

const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0,
  });
const pctLabel = (n: number) => `${Math.round(n * 10) / 10}%`;

const PRODUCT_ICON: Record<ProductKind, LucideIcon> = {
  "smart-album": CircleDollarSign,
  tshirt: Shirt,
  hoodie: Shirt,
  hat: Shirt,
  vinyl: Package,
  cd: Package,
  custom: Package,
};

const STATE_COPY = {
  below: "Below breakeven",
  even: "Costs recovered",
  profit: "Pure profit",
} as const;

export function LabMerchCalculator({
  onMarginChange,
  onOpenRecoupment,
}: {
  /** Reports the live price and unit cost so the Lab's recoupment tool can price a shirt recovery. */
  onMarginChange?: (margin: { price: number; cost: number }) => void;
  /** Sends the member back to the recoupment tool that asked for a merch price. */
  onOpenRecoupment?: (() => void) | undefined;
} = {}) {
  // The panel opens empty: every figure here is the artist's own invoice, and a product chip fills a typical estimate
  // they can replace rather than one already sitting there as if it were theirs (founder, 2026-11-24).
  const [product, setProduct] = useState<ProductKind | "">("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [price, setPrice] = useState("");
  const [unitsSold, setUnitsSold] = useState(0);
  const [entry, setEntry] = useState("");

  const run = Math.max(0, Math.round(Number(quantity) || 0));
  const cost = Math.max(0, Number(unitCost) || 0);
  const retail = Math.max(0, Number(price) || 0);

  const math = useMemo(
    () => merchMath({ quantity: run, unitCost: cost, price: retail, unitsSold }),
    [run, cost, retail, unitsSold],
  );
  const chart = useMemo(
    () => breakevenChart({ quantity: run, unitCost: cost, price: retail }),
    [run, cost, retail],
  );

  useEffect(() => {
    onMarginChange?.({ price: retail, cost });
  }, [cost, retail, onMarginChange]);

  function chooseProduct(id: ProductKind) {
    const preset = presetOf(id);
    setProduct(id);
    setQuantity(String(preset.quantity));
    setUnitCost(String(preset.unitCost));
    setPrice(String(preset.price));
    // The run starts unsold: a preset that also claims half of it sold is a made-up result, not an invoice.
    setUnitsSold(0);
    setEntry("");
  }

  function sell(units: number) {
    setUnitsSold(clampUnits(units, run));
    setEntry("");
  }

  function changeRun(value: string) {
    setQuantity(value);
    const next = Math.max(0, Math.round(Number(value) || 0));
    setUnitsSold((current) => clampUnits(current, next));
    setEntry("");
  }

  function changeEntry(value: string) {
    setEntry(value);
    const parsed = parseSalesEntry(value, run);
    if (parsed !== null) setUnitsSold(parsed);
  }

  const milestones = [
    {
      id: "breakeven",
      label: "Breakeven",
      note: math.breakevenUnits === null ? "Set a price" : `${math.breakevenUnits} units`,
      on: math.atBreakeven,
      run: () => sell(math.breakevenUnits ?? 0),
    },
    {
      id: "half",
      label: "50% sold",
      note: `${Math.round(run * 0.5)} units`,
      // A run of zero would otherwise match both 50% and 75% and light them as chosen.
      on: run > 0 && math.unitsSold === Math.round(run * 0.5),
      run: () => sell(run * 0.5),
    },
    {
      id: "three-quarter",
      label: "75% sold",
      note: `${Math.round(run * 0.75)} units`,
      on: run > 0 && math.unitsSold === Math.round(run * 0.75),
      run: () => sell(run * 0.75),
    },
    {
      id: "sold-out",
      label: "Sold out",
      note: `${run} units`,
      on: math.soldOut && math.unitsSold > 0,
      run: () => sell(run),
    },
  ];

  const sliderValue = run > 0 ? (math.unitsSold / run) * 100 : 0;

  return (
    <div className="fl-tool space-y-3" aria-label="Merch and Sales Profit Calculator">
      <section className="fl-panel fl-crystal">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="fl-icon-badge">
              <Shirt className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-xl font-extrabold tracking-tight">
                Merch &amp; Sales Profit Calculator
              </h3>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Three numbers and one slider: what the run costs, the unit that pays it back and the
                cash left when you sell through.
              </p>
              {onOpenRecoupment && (
                <button type="button" className="fl-jump mt-2" onClick={onOpenRecoupment}>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  Back to Recoupment
                </button>
              )}
            </div>
          </div>
          <span className="fl-chip">{product ? presetOf(product).name : "No product yet"}</span>
        </div>

        <div className="mt-3">
          <div className="fl-step-label">
            <span className="fl-step-num">1</span> Select or enter a product
          </div>
          <div className="fl-pick-grid" role="group" aria-label="Product">
            {PRODUCT_PRESETS.map((item) => {
              const Icon = PRODUCT_ICON[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  className="fl-pill fl-pick"
                  data-on={product === item.id}
                  aria-pressed={product === item.id}
                  onClick={() => chooseProduct(item.id)}
                  title={item.hint}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </div>
          <p className="fl-hint">
            Pick one to fill a typical invoice, then replace it with what yours actually cost.
          </p>
        </div>

        <div className="mt-4">
          <div className="fl-step-label">
            <span className="fl-step-num">2</span> Enter your three numbers
          </div>
          <div className="fl-number-grid">
            <div className="fl-field">
              <label htmlFor="fl-merch-units">Total units made</label>
              <Input
                id="fl-merch-units"
                type="number"
                min={0}
                step="1"
                inputMode="numeric"
                className="fl-input fl-mono"
                value={quantity}
                onChange={(event) => changeRun(event.target.value)}
              />
              <span className="fl-field-hint">The whole run in hand.</span>
            </div>
            <div className="fl-field">
              <label htmlFor="fl-merch-cost">Cost to make (per unit)</label>
              <Input
                id="fl-merch-cost"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                className="fl-input fl-mono"
                value={unitCost}
                onChange={(event) => setUnitCost(event.target.value)}
              />
              <span className="fl-field-hint">What the printer charged each.</span>
            </div>
            <div className="fl-field">
              <label htmlFor="fl-merch-price">Selling price (per unit)</label>
              <Input
                id="fl-merch-price"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                className="fl-input fl-mono"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
              <span className="fl-field-hint">What a fan pays you.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="fl-panel fl-crystal" aria-label="Sales simulator">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="fl-eyebrow flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.2em]">
              <Gauge className="h-3.5 w-3.5" /> Sales simulator
            </div>
            <h3 className="mt-1 text-lg font-extrabold">How much will you sell?</h3>
          </div>
          {/* Without a price the state is a placeholder, so the chip never claims the costs came back. */}
          <span className="fl-chip" data-state={math.breakevenUnits === null ? undefined : math.state}>
            {math.breakevenUnits === null ? "Set a price" : STATE_COPY[math.state]}
          </span>
        </div>

        <div className="fl-milestones" role="group" aria-label="Sales milestones">
          {milestones.map((milestone) => (
            <button
              key={milestone.id}
              type="button"
                                className="fl-pill fl-milestone disabled:cursor-not-allowed disabled:opacity-50"
                  data-on={milestone.on}
                  aria-pressed={milestone.on}
                  disabled={run === 0}
                  onClick={milestone.run}
            >
              <strong>{milestone.label}</strong>
              <span>{milestone.note}</span>
            </button>
          ))}
        </div>

        <div className="fl-slider-block">
          <div className="fl-slider-head">
            <span className="fl-slider-read">
              <strong>{math.unitsSold}</strong> of {run || "—"} units sold
            </span>
            <span className="fl-slider-pct">{pctLabel(math.percent)}</span>
          </div>
          <input
            type="range"
            className="fl-slider"
            min={0}
            max={100}
            step={1}
            value={sliderValue}
            aria-label="Percentage of the run sold"
            style={{ "--fill": `${sliderValue}%` } as CSSProperties}
            disabled={run === 0}
            onChange={(event) => sell((run * Number(event.target.value)) / 100)}
          />
          <div className="fl-slider-ends" aria-hidden="true">
            <span>0</span>
            <span>Sold out ({run || 0})</span>
          </div>
        </div>

        <div className="fl-units-entry">
          <div className="fl-field">
            <label htmlFor="fl-merch-entry">Type exact units sold — or a percentage</label>
            <Input
              id="fl-merch-entry"
              className="fl-input fl-mono"
              value={entry}
              placeholder={`${math.unitsSold} units · or 35%`}
              inputMode="text"
              onChange={(event) => changeEntry(event.target.value)}
            />
          </div>
          <span className="fl-hint !mt-0">
            “35” sets 35 units, “35%” sets 35% of the run, and the slider follows.
          </span>
        </div>

        <div className="fl-telemetry-grid">
          <article className="fl-tel-card" aria-label="Upfront cost">
            <div className="fl-tel-label">
              <Receipt className="h-3.5 w-3.5" /> Upfront cost
            </div>
            <strong className="fl-tel-value">{money(math.upfront)}</strong>
            <span className="fl-tel-note">
              {run || 0} × {money(cost)} per unit
            </span>
          </article>

          <article className="fl-tel-card" aria-label="Safe zone and breakeven">
            <div className="fl-tel-label">
              <Users className="h-3.5 w-3.5" /> Safe zone (breakeven)
            </div>
            <strong className="fl-tel-value">
              {math.breakevenUnits === null ? "—" : `${math.breakevenUnits} units`}
            </strong>
            <span className="fl-tel-note">
              {math.breakevenPercent === null
                ? "Set a selling price to find it"
                : `${pctLabel(math.breakevenPercent)} of the run — $0 loss`}
            </span>
          </article>

          <article className="fl-tel-card" aria-label="Gross sales">
            <div className="fl-tel-label">
              <TrendingUp className="h-3.5 w-3.5" /> Gross sales
            </div>
            <strong className="fl-tel-value">{money(math.gross)}</strong>
            <span className="fl-tel-note">
              {math.unitsSold} × {money(retail)} retail
            </span>
          </article>

          <article
            className="fl-tel-card fl-profit"
            data-state={math.state}
            aria-label="Take-home cash profit"
          >
            <div className="fl-tel-label">
              <CircleDollarSign className="h-3.5 w-3.5" /> Take-home profit
            </div>
            <strong className="fl-hero-number">{money(math.profit)}</strong>
            <span className="fl-tel-note">
              {math.roi === null
                ? "Enter your production costs"
                : `${math.roi >= 0 ? "+" : ""}${pctLabel(math.roi)} ROI on the upfront bill`}
            </span>
            <span className="fl-profit-state">
              {math.state === "below" ? (
                <>
                  <span className="fl-cobalt-dot" aria-hidden="true" />
                  {math.unitsToBreakeven} more unit{math.unitsToBreakeven === 1 ? "" : "s"} to
                  recover costs
                </>
              ) : math.atBreakeven ? (
                <>Costs fully recovered — the next unit is pure profit.</>
              ) : math.state === "profit" ? (
                <>
                  <span className="fl-gold-dot" aria-hidden="true" />
                  {math.soldOut ? "Sold out and in profit." : `${money(math.profit)} in pocket.`}
                </>
              ) : (
                <>Add your costs and selling price to see the profit.</>
              )}
            </span>
          </article>
        </div>

        <div className="mt-3">
          <div className="fl-step-label">
            <span className="fl-step-num">3</span> Break even point
          </div>
          <BreakevenChartView chart={chart} unitsSold={math.unitsSold} price={retail} />
        </div>

        <p className="fl-hint">
          Cash view only: it leaves out sales tax, shipping, payment fees and comped units, so the
          number you keep can be lower than this one.
        </p>
      </section>
    </div>
  );
}
