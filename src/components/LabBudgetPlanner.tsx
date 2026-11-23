import { useMemo, useState, type CSSProperties } from "react";
import {
  Camera,
  Check,
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
import { downloadBudgetPdf } from "@/lib/budget-pdf";
import {
  BUDGET_BLUEPRINTS,
  QUICK_PICKS,
  allocateBudget,
  blueprintOf,
  budgetProgress,
  customExpenseRow,
  expenseActual,
  rowsFromAllocation,
  type AllocatedLine,
  type ExpenseRow,
  type ProjectKind,
} from "@/lib/financial-lab-budgets";
import { cn } from "@/lib/utils";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const whole = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

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

export function LabBudgetPlanner() {
  const [kind, setKind] = useState<ProjectKind>("music-video");
  const [target, setTarget] = useState("500");
  const [plan, setPlan] = useState<Plan>(() => openPlan("music-video", 500));
  const [active, setActive] = useState("");
  const [exporting, setExporting] = useState(false);

  const blueprint = blueprintOf(plan.kind);
  const totals = useMemo(() => budgetProgress(plan.rows, plan.target), [plan.rows, plan.target]);
  const targetNumber = Number(target) || 0;
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

  async function exportSheet() {
    setExporting(true);
    try {
      await downloadBudgetPdf({
        project: blueprint.name,
        target: plan.target,
        tip: blueprint.tip,
        allocated: plan.lines,
        rows: plan.rows,
      });
      toast.success("Budget sheet downloaded.");
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
            </div>
          </div>
          <span className="fl-chip">STEP 1–3</span>
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
                  onClick={() => setTarget(String(amount))}
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
                onChange={(event) => setTarget(event.target.value)}
                placeholder="500"
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
            <h3 className="mt-1 text-lg font-extrabold">Where {whole(plan.target)} should go</h3>
          </div>
          <span className="fl-chip ml-auto">{blueprint.name}</span>
        </div>

        <div className="fl-alloc-bar" aria-label="Allocation share">
          {plan.lines.map((line, index) => (
            <button
              key={line.id}
              type="button"
              className={cn("fl-alloc-seg", `fl-tone-${index % 6}`)}
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
          {plan.lines.map((line) => (
            <li key={line.id} data-on={active === line.id}>
              <div className="min-w-0">
                <div className="fl-alloc-name">{line.label}</div>
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

        <ul className="fl-check-list">
          {plan.rows.map((row) => (
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
                        actual: !row.paid && !row.actual ? String(row.budget || "") : row.actual,
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
                      onClick={() => setRows((rows) => rows.filter((entry) => entry.id !== row.id))}
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
            A branded one-page PDF for directors, venues and collaborators: the cap, the split, the
            checklist and the CTA tip.
          </p>
        </div>
        <button
          type="button"
          className="fl-tool-btn"
          onClick={() => void exportSheet()}
          disabled={exporting}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {exporting ? "Building your sheet…" : "Download budget PDF"}
        </button>
      </section>
    </div>
  );
}
