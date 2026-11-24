import { useId } from "react";
import type { AllocationSlice, CategorySpend } from "@/lib/financial-lab-budgets";
import type { BreakevenChart } from "@/lib/financial-lab-merch";
import type { RecoupmentProgress } from "@/lib/royalty-pipeline";
import { cn } from "@/lib/utils";

/**
 * The Financial Lab's five visuals: the allocation ring, the planned-vs-paid pairs, the breakeven crossing, the
 * per-stream pipeline split and the recoupment gauge. They read the same numbers the tools already print — every
 * figure here comes from the planners' own math — and they carry the Lab's four colours, never a fifth hue.
 */
const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0,
  });
const money4 = (n: number) => `$${n.toFixed(4)}`;
const pct = (n: number) => `${Math.round(n * 10) / 10}%`;
const count = (n: number) => n.toLocaleString("en-US");

/**
 * The one tone a line wears, in the ring and beside its name. Ring and list both call this, so a category's colour can
 * never drift between the graph and the row — and because the tone is a class, each theme paints it from the same place.
 * Platinum (tone 5) is the ring's own track metal, so the last line takes the darker stone instead.
 */
export const allocationTone = (index: number) => `fl-tone-${index % 6 === 5 ? 1 : index % 6}`;

/** The allocation donut: where each dollar of the project budget goes, resizing with the plan. */
export function AllocationDonut({
  slices,
  total,
  active,
}: {
  slices: AllocationSlice[];
  total: number;
  /** The line lit on the allocation bar, so the ring answers the same tap. */
  active: string;
}) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const filled = slices.some((slice) => slice.end > slice.start);
  return (
    <>
      <div className="fl-donut-row">
      <svg
        className="fl-donut"
        viewBox="0 0 120 120"
        role="img"
        aria-label={
          filled
            ? `Budget allocation: ${slices
                .filter((slice) => slice.budget > 0)
                .map((slice) => `${slice.label} ${pct(slice.percent)}`)
                .join(", ")}.`
            : "Budget allocation: nothing allocated yet."
        }
      >
        <circle className="fl-donut-track" cx="60" cy="60" r={radius} />
        <g transform="rotate(-90 60 60)">
          {slices.map((slice, index) => {
            const length = Math.max(0, (slice.end - slice.start) * circumference);
            if (length <= 0) return null;
            // A 2-unit breath between slices keeps two neighbours apart, and keeps the palest tone from reading as track.
            const drawn = length > 4 ? length - 2 : length;
            return (
              <circle
                key={slice.id}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                className={cn("fl-donut-seg", allocationTone(index))}
                data-on={active === slice.id}
                data-dim={!!active && active !== slice.id}
                strokeDasharray={`${drawn} ${circumference - drawn}`}
                strokeDashoffset={-slice.start * circumference}
              >
                <title>{`${slice.label} — ${money(slice.budget)} (${pct(slice.percent)})`}</title>
              </circle>
            );
          })}
        </g>
        <text className="fl-donut-value" x="60" y="59" textAnchor="middle">
          {money(total)}
        </text>
        <text className="fl-donut-caption" x="60" y="73" textAnchor="middle">
          ALLOCATED
        </text>
      </svg>
      </div>
      {!filled && (
        <p className="fl-chart-empty">
          No money allocated yet — name a target spend and generate the split.
        </p>
      )}
    </>
  );
}

/**
 * Estimated against spent, one pair of bars per category. Both bars share one scale, so the longer bar is always the
 * bigger number, and a paid line past its plan is flagged where the overspend is rather than only in the total.
 */
export function SpentPairs({
  groups,
  scale: sharedScale,
  showName = true,
}: {
  groups: CategorySpend[];
  /**
   * The scale the bars are drawn against. A pair shown on its own under its own category still measures against the
   * whole plan, so the longest bar is the biggest number whichever card it sits under.
   */
  scale?: number | undefined;
  /**
   * Off when the card above already names the category: the pair then carries its status alone, and the name stays on
   * the pair's own label for a screen reader instead of repeating what is already in the header (founder, 2026-11-24).
   */
  showName?: boolean;
}) {
  if (!groups.length)
    return (
      <p className="fl-chart-empty">
        Once a line has a planned amount, its pair appears here — planned beside what has been
        paid.
      </p>
    );
  const scale =
    sharedScale ?? Math.max(1, ...groups.map((group) => Math.max(group.planned, group.spent)));
  return (
    <div className="fl-pair-list">
      {groups.map((group) => (
        <div
          key={group.id}
          className="fl-pair"
          data-over={group.over > 0}
          data-noname={!showName}
          role="group"
          aria-label={`${group.label} — planned vs paid`}
        >
          <div className="fl-pair-head">
            {showName ? <span className="fl-pair-name">{group.label}</span> : null}
            <span className="fl-pair-flag">
              {group.over > 0
                ? `Over by ${money(group.over)}`
                : group.spent > 0
                  ? `${money(group.spent)} paid`
                  : "Nothing paid yet"}
            </span>
          </div>
          <div className="fl-pair-row" data-kind="planned">
            <span className="fl-pair-tag">Est.</span>
            <div className="fl-pair-track">
              <span style={{ width: `${(group.planned / scale) * 100}%` }} />
            </div>
            <b>{money(group.planned)}</b>
          </div>
          <div className="fl-pair-row" data-kind="spent">
            <span className="fl-pair-tag">Paid</span>
            <div className="fl-pair-track">
              <span style={{ width: `${(group.spent / scale) * 100}%` }} />
            </div>
            <b>{money(group.spent)}</b>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The breakeven crossing: revenue climbs with every unit sold, the run's cost stays flat, and everything past the
 * crossing is shaded Cobalt as profit. The current sales position is marked on the revenue line.
 */
export function BreakevenChartView({
  chart,
  unitsSold,
  price,
}: {
  chart: BreakevenChart | null;
  unitsSold: number;
  price: number;
}) {
  const gradientId = `fl-be-${useId().replace(/:/g, "")}`;
  if (!chart)
    return (
      <p className="fl-chart-empty">
        Set a selling price and a cost to make, and the breakeven crossing appears here.
      </p>
    );

  const width = 320;
  const height = 158;
  const left = 40;
  const right = 10;
  const top = 12;
  const bottom = 26;
  const x = (units: number) =>
    left + (Math.min(Math.max(0, units), chart.upto) / chart.upto) * (width - left - right);
  const y = (value: number) =>
    height - bottom - (Math.min(Math.max(0, value), chart.top) / chart.top) * (height - top - bottom);

  const breakeven = chart.breakevenUnits;
  const sold = Math.max(0, Math.min(unitsSold, chart.upto));
  const soldValue = sold * price;
  const crossingX = x(breakeven);
  const crossingY = y(chart.upfront);
  const endRevenueY = y(chart.upto * price);
  const endCostY = y(chart.upfront);
  // Centred over the crossing: the sky above the rising line is the one patch the label can never collide with.
  const labelAnchor = "middle";
  const labelX = crossingX;
  const half = chart.top / 2;

  return (
    <>
      <svg
        className="fl-breakeven"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Revenue against units sold. The run costs ${money(
          chart.upfront,
        )}, and costs are recovered at ${count(breakeven)} units.`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#004aad" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#4d8cff" stopOpacity="0.06" />
          </linearGradient>
        </defs>

        {[half, chart.top].map((value) => (
          <g key={value}>
            <line
              className="fl-breakeven-grid"
              x1={left}
              x2={width - right}
              y1={y(value)}
              y2={y(value)}
            />
            <text className="fl-breakeven-label" x={4} y={y(value) + 3}>
              {money(value)}
            </text>
          </g>
        ))}
        <line
          className="fl-breakeven-grid"
          x1={left}
          x2={width - right}
          y1={y(0)}
          y2={y(0)}
        />
        <text className="fl-breakeven-label" x={4} y={y(0) + 3}>
          $0
        </text>

        {/* Profit past the crossing: the revenue line above the flat cost line. */}
        <polygon
          className="fl-breakeven-profit"
          fill={`url(#${gradientId})`}
          points={`${crossingX},${crossingY} ${x(chart.upto)},${endRevenueY} ${x(
            chart.upto,
          )},${endCostY}`}
        />

        <line
          className="fl-breakeven-cost"
          x1={left}
          x2={x(chart.upto)}
          y1={endCostY}
          y2={endCostY}
        />
        <line
          className="fl-breakeven-revenue"
          x1={x(0)}
          y1={y(0)}
          x2={x(chart.upto)}
          y2={endRevenueY}
        />

        {sold > 0 && (
          <>
            <line
              className="fl-breakeven-sold"
              x1={x(sold)}
              x2={x(sold)}
              y1={y(0)}
              y2={y(soldValue)}
            />
            <circle className="fl-breakeven-sold-dot" cx={x(sold)} cy={y(soldValue)} r={3} />
          </>
        )}

        <circle className="fl-breakeven-dot" cx={crossingX} cy={crossingY} r={4.2} />
        <text
          className="fl-breakeven-label fl-breakeven-label-strong"
          x={labelX}
          y={crossingY - 24}
          textAnchor={labelAnchor}
        >
          {count(breakeven)} units
        </text>

        <text className="fl-breakeven-label" x={left} y={height - 8}>
          0
        </text>
        <text className="fl-breakeven-label" x={width - right} y={height - 8} textAnchor="end">
          {count(chart.upto)} units sold
        </text>
      </svg>
      <div className="fl-breakeven-key" aria-hidden="true">
        <span>
          <i data-tone="revenue" /> Revenue {money(price)} a unit
        </span>
        <span>
          <i data-tone="cost" /> Run cost {money(chart.upfront)}
        </span>
        <span>
          <i data-tone="profit" /> Profit past {count(breakeven)}
        </span>
      </div>
    </>
  );
}

/** Recoupment: the project cost as a filling arc, with the streams still to go underneath. */
export function RecoupGauge({
  progress,
  spotifyRate,
}: {
  progress: RecoupmentProgress;
  spotifyRate: number;
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  // Three quarters of a circle, drawn from the lower left, so the gauge reads like a dial rather than a pie.
  const arc = circumference * 0.75;
  const filled = progress.cost > 0 ? (arc * progress.percent) / 100 : 0;
  return (
    <div className="fl-gauge">
      <svg
        className="fl-gauge-ring"
        viewBox="0 0 120 120"
        role="img"
        aria-label={`${money(progress.earned)} of ${money(progress.cost)} earned back (${Math.round(
          progress.percent,
        )}%).`}
      >
        <circle
          className="fl-gauge-track"
          cx="60"
          cy="60"
          r={radius}
          transform="rotate(135 60 60)"
          strokeDasharray={`${arc} ${circumference}`}
        />
        {filled > 0 && (
          <circle
            className="fl-gauge-fill"
            cx="60"
            cy="60"
            r={radius}
            transform="rotate(135 60 60)"
            data-done={progress.done}
            strokeDasharray={`${filled} ${circumference - filled}`}
          />
        )}
        <text className="fl-gauge-pct" x="60" y="65" textAnchor="middle">
          {progress.cost > 0 ? `${Math.round(progress.percent)}%` : "—"}
        </text>
      </svg>

      <div className="fl-gauge-read">
        {/* A blank cost has nothing to measure against, so the earned figure would read as a share of zero. */}
        {progress.cost <= 0 ? (
          <>
            <strong>{money(progress.cost)}</strong>
            <span>No project cost yet</span>
            <em>Enter a project cost to follow the recovery.</em>
          </>
        ) : (
          <>
            <strong>{money(progress.earned)}</strong>
            <span>of {money(progress.cost)} earned back</span>
            {progress.done ? (
              <em>Project paid off — every dollar after this is profit.</em>
            ) : (
              <em>{money(progress.remaining)} still to recover</em>
            )}
          </>
        )}
        {progress.cost > 0 && !progress.done && progress.streamsLeft !== null && (
          <span className="fl-gauge-streams">
            About {count(progress.streamsLeft)} more Spotify streams at your cut of{" "}
            {money4(spotifyRate)} a stream.
          </span>
        )}
      </div>
    </div>
  );
}
