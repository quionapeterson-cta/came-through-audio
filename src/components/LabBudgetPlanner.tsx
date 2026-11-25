import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowUpRight,
  Camera,
  Check,
  ChevronDown,
  Clapperboard,
  Download,
  Megaphone,
  Mic2,
  PartyPopper,
  Plus,
  Shirt,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AllocationDonut, SpentPairs, allocationTone } from "@/components/LabCharts";
import { downloadBudgetPdf } from "@/lib/budget-pdf";
import { downloadBudgetSheetCsv, downloadBudgetXlsx, type SheetFlavor } from "@/lib/budget-xlsx";
import { myBrand } from "@/lib/brand-load";
import {
  BUDGET_BLUEPRINTS,
  QUICK_PICKS,
  allocateBudget,
  allocationSlices,
  blueprintOf,
  budgetProgress,
  categorySpend,
  customExpenseRow,
  expenseActual,
  planFromStore,
  planStore,
  rowsFromAllocation,
  type AllocatedLine,
  type ExpenseRow,
  type ProjectKind,
} from "@/lib/financial-lab-budgets";
import { readLabJson, writeLabJson } from "@/lib/financial-lab-scenario";
import { cn } from "@/lib/utils";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const whole = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/**
 * The three ways to take the sheet with you. A plain click menu, not a Radix dropdown: a dropdown opens on pointer-down, so
 * the pointerup that finishes the same click landed on its first item and downloaded it before the member could choose
 * (founder, 2026-11-25). A popover opens on click, so the menu is only there once the click is finished.
 */
const FORMATS: { id: "pdf" | SheetFlavor; name: string; hint: string }[] = [
  {
    id: "pdf",
    name: "Fillable PDF",
    hint: "Type what you paid into the Actual boxes, and tick each line as you pay it",
  },
  {
    id: "sheets",
    name: "Google Sheet",
    hint: "A .csv for Google Sheets, with the totals as live formulas",
  },
  { id: "excel", name: "Excel sheet", hint: "A .xlsx workbook with the formulas built in" },
];

const PROJECT_ICON: Record<ProjectKind, LucideIcon> = {
  "music-video": Clapperboard,
  "release-party": PartyPopper,
  "single-rollout": Megaphone,
  "studio-master": Mic2,
  "merch-run": Shirt,
  "photo-shoot": Camera,
};

type Plan = {
  kind: ProjectKind;
  target: number;
  lines: AllocatedLine[];
  rows: ExpenseRow[];
};

/**
 * A regenerated plan keeps the money already spent: a line with the same category carries its paid mark and its typed
 * actual cost across, and the artist's own custom entries come along untouched. Only the allocation is rewritten.
 */
function openPlan(kind: ProjectKind, target: number, previous: ExpenseRow[] = []): Plan {
  const lines = allocateBudget(target, blueprintOf(kind));
  const kept = new Map(previous.filter((row) => !row.custom).map((row) => [row.category, row]));
  const rows = lines.map((line) => {
    const row = rowsFromAllocation([line])[0]!;
    const before = kept.get(line.label);
    return before ? { ...row, paid: before.paid, actual: before.actual } : row;
  });
  return {
    kind,
    target,
    lines,
    rows: [...rows, ...previous.filter((row) => row.custom)],
  };
}

/**
 * The plan this song opens on: the one the member last edited when there is a readable copy, otherwise a fresh
 * allocation of the target. The allocation itself is never stored — it is worked out from the project and the
 * target again, so the ring and the rows can never disagree about the same money.
 */
function startPlan(storageKey: string | undefined, target: number): { key: string; plan: Plan } {
  const saved = storageKey ? planFromStore(readLabJson<unknown>(storageKey)) : null;
  return {
    key: storageKey ?? "",
    plan: saved
      ? {
          kind: saved.kind,
          target: saved.target,
          lines: allocateBudget(saved.target, blueprintOf(saved.kind)),
          rows: saved.rows,
        }
      : openPlan("music-video", target),
  };
}

export function LabBudgetPlanner({
  target,
  onTarget,
  onOpenRecoupment,
  onOpenTax,
  storageKey,
  taxRate,
}: {
  /** The target spend lives in the Lab so the recoupment tool can prefill from it. */
  target: string;
  onTarget: (value: string) => void;
  /** Sends the member to the recoupment tool that reads this target spend. */
  onOpenRecoupment?: (() => void) | undefined;
  /** Sends the member to the tax worksheet that pulls these paid lines across. */
  onOpenTax?: (() => void) | undefined;
  /** Where this song's plan is kept, so a refresh brings back the lines that were ticked paid. */
  storageKey?: string | undefined;
  /** The rate in the tax worksheet, shown as an after-tax estimate beside what has been paid. */
  taxRate?: number | undefined;
}) {
  const planKey = storageKey ?? "";
  const [state, setState] = useState(() => startPlan(storageKey, Number(target) || 0));
  const [kind, setKind] = useState<ProjectKind>(state.plan.kind);
  // A new song opens its own plan before this render commits, so one song's paid lines never flash under another.
  if (state.key !== planKey) {
    const next = startPlan(storageKey, Number(target) || 0);
    setState(next);
    setKind(next.plan.kind);
  }
  const plan = state.plan;
  function setPlan(next: Plan | ((current: Plan) => Plan)) {
    setState((current) => ({
      ...current,
      plan: typeof next === "function" ? next(current.plan) : next,
    }));
  }
  const [active, setActive] = useState("");
  const [exporting, setExporting] = useState(false);
  const [formats, setFormats] = useState(false);

  // Every edit is written back for this song, so the next visit starts from the same plan — and the tax worksheet's
  // "Pull from my budget" has paid lines to read even when this tab was never opened.
  useEffect(() => {
    if (!state.key) return;
    const timer = window.setTimeout(() => writeLabJson(state.key, planStore(state.plan)), 350);
    return () => window.clearTimeout(timer);
  }, [state]);

  const blueprint = blueprintOf(plan.kind);
  const totals = useMemo(() => budgetProgress(plan.rows, plan.target), [plan.rows, plan.target]);
  const slices = useMemo(() => allocationSlices(plan.lines), [plan.lines]);
  const spends = useMemo(() => categorySpend(plan.rows), [plan.rows]);
  /** One scale for every pair, wherever it sits, so the longest bar is still the biggest number on the page. */
  const pairScale = useMemo(
    () => Math.max(1, ...spends.map((group) => Math.max(group.planned, group.spent))),
    [spends],
  );
  /**
   * The checklist by category, in the order the plan lists them, carrying each category's own planned-vs-paid pair — so
   * a bar sits with the line it measures instead of a screen above it (founder, 2026-11-24).
   */
  const checkGroups = useMemo(() => {
    const order = new Map<string, { id: string; label: string; rows: ExpenseRow[] }>();
    for (const row of plan.rows) {
      const label = row.category.trim() || "Custom";
      const id = label.toLowerCase();
      const found = order.get(id);
      if (found) found.rows.push(row);
      else order.set(id, { id, label, rows: [row] });
    }
    return [...order.values()].map((group) => ({
      ...group,
      spend: spends.find((entry) => entry.id === group.id),
    }));
  }, [plan.rows, spends]);
  const allocated = useMemo(() => slices.reduce((sum, slice) => sum + slice.budget, 0), [slices]);
  const targetNumber = Number(target) || 0;
  const rate = Math.max(0, Math.min(100, taxRate ?? 0));
  const stale =
    plan.kind !== kind || Math.round(plan.target * 100) !== Math.round(targetNumber * 100);

  function setRows(updater: (rows: ExpenseRow[]) => ExpenseRow[]) {
    setPlan((current) => ({ ...current, rows: updater(current.rows) }));
  }

  function patchRow(id: string, patch: Partial<ExpenseRow>) {
    setRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function generate() {
    if (targetNumber <= 0) {
      toast.error("Enter a target spend first.");
      return;
    }
    const next = openPlan(kind, Math.round(targetNumber * 100) / 100, plan.rows);
    setPlan(next);
    setActive("");
    const paidKept = next.rows.filter((row) => row.paid).length;
    toast.success(
      `${blueprintOf(kind).name} plan built for ${whole(targetNumber)}${paidKept ? ` — ${paidKept} paid line${paidKept === 1 ? "" : "s"} kept` : ""}.`,
    );
  }

  async function exportSheet(format: "pdf" | SheetFlavor) {
    setExporting(true);
    try {
      const sheet = {
        project: blueprint.name,
        target: plan.target,
        tip: blueprint.tip,
        allocated: plan.lines,
        rows: plan.rows,
      };
      if (format === "pdf") {
        // A member's own brand kit on the sheet when they have one they may print with (Catalog Management, or a paid
        // kit); otherwise this returns null and the PDF keeps the Came Through Audio header.
        const brand = await myBrand("lab");
        await downloadBudgetPdf(sheet, brand);
        toast.success(
          "Fillable budget PDF downloaded — type what you actually paid, and the totals follow in Adobe Acrobat or Reader.",
        );
        return;
      }
      if (format === "sheets") {
        downloadBudgetSheetCsv(sheet);
        toast.success(
          "Google Sheet downloaded as a .csv — open sheets.new, then File → Import → Upload, and the totals recalculate.",
        );
        return;
      }
      await downloadBudgetXlsx(sheet);
      toast.success(
        "Excel sheet downloaded — type an Actual and Excel recalculates spent, remaining and the total.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't build the budget sheet.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fl-tool space-y-3" aria-label="Production Budget Planner">
      <section className="fl-panel fl-crystal">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="fl-icon-badge">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-xl font-extrabold tracking-tight">Production Budget Planner</h3>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Pick the project, name the spend and CTA allocates it line by line — then track
                every item from estimated to paid.
              </p>
              {(onOpenRecoupment || onOpenTax) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {onOpenRecoupment && (
                    <button type="button" className="fl-jump" onClick={onOpenRecoupment}>
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      Back to Recoupment
                    </button>
                  )}
                  {onOpenTax && (
                    <button type="button" className="fl-jump" onClick={onOpenTax}>
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      Artist Tax Write-Off Estimator
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          <span className="fl-chip">STEP 1–5</span>
        </div>

        <div className="mt-3">
          <div className="fl-step-label">
            <span className="fl-step-num">1</span> Pick a project type
          </div>
          <div className="fl-pick-grid" role="group" aria-label="Project type">
            {BUDGET_BLUEPRINTS.map((item) => {
              const Icon = PROJECT_ICON[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  className="fl-pill fl-pick"
                  data-on={kind === item.id}
                  aria-pressed={kind === item.id}
                  onClick={() => setKind(item.id)}
                  title={item.blurb}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <div className="fl-step-label">
            <span className="fl-step-num">2</span> Enter your target spend
          </div>
          <div className="fl-spend-row">
            <div className="fl-quick-pills">
              {QUICK_PICKS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className="fl-pill"
                  data-on={Math.round(targetNumber) === amount}
                  aria-pressed={Math.round(targetNumber) === amount}
                  onClick={() => onTarget(String(amount))}
                >
                  {whole(amount)}
                </button>
              ))}
            </div>
            <div className="fl-field fl-custom-spend">
              <label htmlFor="fl-budget-target">Custom amount ($)</label>
              <Input
                id="fl-budget-target"
                type="number"
                min={0}
                step="1"
                inputMode="decimal"
                className="fl-input fl-mono"
                value={target}
                onChange={(event) => onTarget(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="fl-tool-btn" onClick={generate}>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Generate my CTA allocation
          </button>
          <span className="fl-hint !mt-0">
            {stale
              ? `Showing the ${blueprint.name.toLowerCase()} plan for ${whole(plan.target)} — generate to apply ${whole(targetNumber)}.`
              : "Dollars, percentages and the checklist always match. Paid lines keep their actual cost when you regenerate."}
          </span>
        </div>
      </section>

      <section className="fl-panel fl-crystal" aria-label="CTA allocation">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="fl-eyebrow flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.2em]">
              <Sparkles className="h-3.5 w-3.5" /> CTA expert allocation
            </div>
            <h3 className="mt-1 text-lg font-extrabold">
              Where {plan.target > 0 ? whole(plan.target) : "your budget"} should go
            </h3>
          </div>
          <span className="fl-chip ml-auto">{blueprint.name}</span>
        </div>

        <div className="fl-step-label mt-3">
          <span className="fl-step-num">3</span> Review and adjust the CTA allocation
        </div>
        <p className="fl-hint">
          The ring, the bar and the rows below are the same split: tap a category to light it up,
          then carry any change into the checklist underneath.
        </p>

        <AllocationDonut slices={slices} total={allocated} active={active} />

        <div className="fl-alloc-bar" aria-label="Allocation share">
          {plan.lines.map((line, index) => (
            <button
              key={line.id}
              type="button"
              className={cn("fl-alloc-seg", allocationTone(index))}
              data-on={active === line.id}
              data-dim={!!active && active !== line.id}
              style={{ flexGrow: Math.max(0.001, line.budget) } as CSSProperties}
              onClick={() => setActive((current) => (current === line.id ? "" : line.id))}
              aria-pressed={active === line.id}
              title={`${line.label} — ${money(line.budget)}`}
            >
              <span>{line.percent}%</span>
            </button>
          ))}
        </div>

        <ul className="fl-alloc-list">
          {plan.lines.map((line, index) => (
            <li key={line.id} className={allocationTone(index)} data-on={active === line.id}>
              <div className="min-w-0">
                <div className="fl-alloc-name">
                  {/* The same tone this line wears in the ring, so the row and its slice read as one colour. */}
                  <span
                    className={cn("fl-alloc-swatch", allocationTone(index))}
                    aria-hidden="true"
                  />
                  {line.label}
                </div>
                <p className="fl-alloc-note">{line.note}</p>
              </div>
              <div className="fl-alloc-money">
                <strong>{money(line.budget)}</strong>
                <span>{line.percent}%</span>
              </div>
            </li>
          ))}
        </ul>

        <p className="fl-tip">
          <strong>CTA tip:</strong> {blueprint.tip}
        </p>
      </section>

      <section className="fl-panel fl-crystal" aria-label="Live expense tracker">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="fl-icon-badge">
              <Check className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-xl font-extrabold tracking-tight">Live expense checklist</h3>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Adjust any line, add your own and flip it to paid as the money leaves your account.
              </p>
            </div>
          </div>
          <span className="fl-chip ml-auto">
            {totals.paidCount} of {totals.total} paid
          </span>
        </div>

        <div className="fl-budget-head">
          <div className="fl-budget-stat">
            <span>Budget cap</span>
            <strong>{money(plan.target)}</strong>
          </div>
          <div className="fl-budget-stat">
            <span>Spent so far</span>
            <strong>{money(totals.spent)}</strong>
          </div>
          <div className="fl-budget-stat" data-low={totals.remaining < 0}>
            <span>Remaining balance</span>
            <strong>{money(totals.remaining)}</strong>
          </div>
        </div>
        <div
          className="fl-budget-track"
          role="progressbar"
          aria-label="Share of the budget spent"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(totals.spentPercent)}
        >
          <span className="fl-budget-fill" style={{ width: `${totals.spentPercent}%` }} />
        </div>
        {rate > 0 && totals.spent > 0 ? (
          <p className="fl-hint">
            At the {rate}% rate in your write-off worksheet, the {money(totals.spent)} you have paid
            is about {money(totals.spent * (1 - rate / 100))} after an estimated{" "}
            {money((totals.spent * rate) / 100)} back. An estimate, not a refund.
          </p>
        ) : null}

        <div className="mt-3">
          <div className="fl-step-label">
            <span className="fl-step-num">4</span> Planned vs paid
          </div>
          <p className="fl-hint">
            Each pair is one category: the plan on top, the money that has actually left your
            account underneath.
          </p>
          {spends.length === 0 ? <SpentPairs groups={[]} /> : null}
        </div>

        {checkGroups.map((group) => (
          <div key={group.id} className="fl-check-group">
            <ul className="fl-check-list">
              {group.rows.map((row) => (
                <li key={row.id} className={cn("fl-check", row.paid && "fl-check-paid")}>
                  <div className="fl-check-top">
                    <span className="fl-check-cat">{row.category}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="fl-check-toggle"
                        data-paid={row.paid}
                        aria-pressed={row.paid}
                        onClick={() =>
                          patchRow(row.id, {
                            paid: !row.paid,
                            actual:
                              !row.paid && !row.actual ? String(row.budget || "") : row.actual,
                          })
                        }
                      >
                        {row.paid ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                        {row.paid ? "Paid" : "Estimated"}
                      </button>
                      {plan.rows.length > 1 && (
                        <button
                          type="button"
                          className="fl-check-del"
                          aria-label={`Remove ${row.item || row.category}`}
                          onClick={() =>
                            setRows((rows) => rows.filter((entry) => entry.id !== row.id))
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="fl-check-grid">
                    <div className="fl-field">
                      <label htmlFor={`${row.id}-item`}>Item name</label>
                      <Input
                        id={`${row.id}-item`}
                        className="fl-row-input"
                        value={row.item}
                        placeholder={row.category}
                        onChange={(event) => patchRow(row.id, { item: event.target.value })}
                      />
                    </div>
                    <div className="fl-field">
                      <label htmlFor={`${row.id}-budget`}>Budgeted ($)</label>
                      <Input
                        id={`${row.id}-budget`}
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        className="fl-row-input fl-mono"
                        value={row.budget === 0 ? "" : String(row.budget)}
                        placeholder="0"
                        onChange={(event) =>
                          patchRow(row.id, { budget: Number(event.target.value) || 0 })
                        }
                      />
                    </div>
                    <div className="fl-field">
                      <label htmlFor={`${row.id}-actual`}>Actual ($)</label>
                      <Input
                        id={`${row.id}-actual`}
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        className="fl-row-input fl-mono"
                        value={row.actual}
                        placeholder={row.paid ? String(expenseActual(row)) : "—"}
                        onChange={(event) => patchRow(row.id, { actual: event.target.value })}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {group.spend ? (
              <SpentPairs groups={[group.spend]} scale={pairScale} showName={false} />
            ) : null}
          </div>
        ))}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="fl-ghost-btn"
            onClick={() => setRows((rows) => [...rows, customExpenseRow()])}
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add a custom entry
          </button>
          <span className="fl-hint !mt-0">
            A paid line uses its actual cost, or its budgeted amount until you type one.
          </span>
        </div>
      </section>

      <section className="fl-panel fl-crystal fl-export" aria-label="Download budget sheet">
        <div className="min-w-0">
          <div className="fl-step-label">
            <span className="fl-step-num">5</span> Download the budget sheet
          </div>
          <p className="fl-hint !mt-1">
            Take the sheet with you: a fillable PDF for directors, venues and collaborators, or a
            spreadsheet whose totals recalculate as you type what you really paid — Google Sheets
            opens the .csv, Excel the .xlsx.
          </p>
        </div>
        <Popover open={formats} onOpenChange={setFormats}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="fl-tool-btn"
              disabled={exporting}
              aria-haspopup="menu"
              aria-expanded={formats}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {exporting ? "Building your sheet…" : "Download budget sheet"}
              <ChevronDown className="h-4 w-4 opacity-70" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={8} className="w-80 p-2">
            <p className="px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Choose a format
            </p>
            <div role="menu" aria-label="Budget sheet formats">
              {FORMATS.map((format) => (
                <button
                  key={format.id}
                  type="button"
                  role="menuitem"
                  className="flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:opacity-60"
                  disabled={exporting}
                  onClick={() => {
                    setFormats(false);
                    void exportSheet(format.id);
                  }}
                >
                  <span className="font-semibold">{format.name}</span>
                  <span className="text-xs text-muted-foreground">{format.hint}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </section>
    </div>
  );
}
