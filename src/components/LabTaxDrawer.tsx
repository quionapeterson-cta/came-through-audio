import { ChevronDown, Download, Plus, ReceiptText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveBlob } from "@/lib/catalog";
import { paidPlanRows } from "@/lib/financial-lab-budgets";
import { readLabJson } from "@/lib/financial-lab-scenario";
import {
  MAX_TAX_ROWS,
  TAX_CATEGORIES,
  newTaxRow,
  pullBudgetLines,
  taxCategoryOf,
  taxFilledRows,
  taxKeptRows,
  taxRowAmount,
  taxSheetEstimate,
  taxSheetTotal,
  taxWorksheetCsv,
  type TaxCategoryId,
  type TaxRow,
  type TaxSheet,
} from "@/lib/financial-lab-tax";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function Row({
  row,
  index,
  onPatch,
  onRemove,
  canRemove,
}: {
  row: TaxRow;
  index: number;
  onPatch: (patch: Partial<TaxRow>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const category = taxCategoryOf(row.category);
  return (
    <li className="space-y-1.5 rounded-lg border border-border/60 p-2">
      <div className="flex items-start gap-1.5">
        <label className="sr-only" htmlFor={`${row.id}-category`}>
          Cost category for line {index + 1}
        </label>
        <select
          id={`${row.id}-category`}
          className="fl-input h-8 min-w-0 flex-1 text-xs"
          title={category?.label}
          value={row.category}
          onChange={(event) => onPatch({ category: event.target.value as TaxCategoryId | "" })}
        >
          <option value="">Choose a category…</option>
          {TAX_CATEGORIES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        {canRemove && (
          <button
            type="button"
            className="fl-check-del mt-1.5"
            aria-label={`Remove ${category?.label ?? "this line"}`}
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      {row.category === "other" && !row.sourceId ? (
        <>
          <label className="sr-only" htmlFor={`${row.id}-label`}>
            What the cost was
          </label>
          <Input
            id={`${row.id}-label`}
            className="fl-input h-8 min-w-0 text-xs"
            value={row.label}
            placeholder="What was it?"
            maxLength={80}
            onChange={(event) => onPatch({ label: event.target.value })}
          />
        </>
      ) : null}
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`${row.id}-amount`}>
          Amount spent on {category?.label ?? `line ${index + 1}`}
        </label>
        <Input
          id={`${row.id}-amount`}
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          className="fl-input fl-mono h-8 min-w-0"
          value={row.amount}
          placeholder="0.00"
          onChange={(event) => onPatch({ amount: event.target.value })}
        />
        <label
          className="flex shrink-0 items-center gap-1 text-[0.7rem] text-muted-foreground"
          title="Your own note that you hold the receipt, invoice or contract for this line."
        >
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-current"
            checked={row.kept}
            onChange={(event) => onPatch({ kept: event.target.checked })}
            aria-label={`Paperwork kept for ${category?.label ?? `line ${index + 1}`}`}
          />
          Receipt
        </label>
      </div>
      {row.sourceId && row.label ? (
        <p className="text-[0.7rem] text-muted-foreground">From your budget: {row.label}</p>
      ) : null}
      {category?.hint ? (
        <p className="text-[0.7rem] text-muted-foreground">{category.hint}</p>
      ) : null}
    </li>
  );
}

export function TaxDrawer({
  sheet,
  onChange,
  budgetKey,
  songTitle,
}: {
  sheet: TaxSheet;
  onChange: (next: TaxSheet | ((current: TaxSheet) => TaxSheet)) => void;
  /** Where this song's Budget Planner plan is kept, so its paid lines can be pulled across. */
  budgetKey?: string | undefined;
  songTitle?: string | undefined;
}) {
  const total = taxSheetTotal(sheet);
  const estimate = taxSheetEstimate(sheet);
  const filled = taxFilledRows(sheet.rows);
  const kept = taxKeptRows(sheet.rows);
  const rate = Number(sheet.rate) || 0;

  const patch = (id: string, next: Partial<TaxRow>) =>
    onChange((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === id ? { ...row, ...next } : row)),
    }));

  const remove = (id: string) =>
    onChange((current) => ({ ...current, rows: current.rows.filter((row) => row.id !== id) }));

  const add = () => {
    if (sheet.rows.length >= MAX_TAX_ROWS) {
      toast.error(`That's the most lines the worksheet holds (${MAX_TAX_ROWS}).`);
      return;
    }
    onChange((current) => ({ ...current, rows: [...current.rows, newTaxRow()] }));
  };

  function pull() {
    const rows = budgetKey ? paidPlanRows(readLabJson<unknown>(budgetKey)) : [];
    if (!rows.length) {
      toast.info(
        "No paid budget lines yet — tick a line as paid in the Budget Planner and it can come straight across.",
      );
      return;
    }
    const result = pullBudgetLines(sheet, rows);
    onChange(result.sheet);
    const parts = [
      result.added ? `${result.added} added` : "",
      result.updated ? `${result.updated} updated` : "",
      result.removed ? `${result.removed} removed` : "",
    ].filter(Boolean);
    toast.success(
      parts.length
        ? `Budget lines pulled: ${parts.join(", ")}.`
        : "Your worksheet already matches the paid budget lines.",
    );
  }

  function download() {
    if (total <= 0) {
      toast.error("Add an amount to at least one line first.");
      return;
    }
    saveBlob(
      new Blob([taxWorksheetCsv(sheet, { song: songTitle })], { type: "text/csv;charset=utf-8" }),
      `${songTitle?.trim() || "financial-lab"} tax worksheet.csv`,
    );
    toast.success(
      "Worksheet downloaded — an estimate to take to your tax professional, not a filing.",
    );
  }

  return (
    <details className="fl-drawer" id="fl-tax-drawer">
      <summary>
        <span className="flex items-center gap-2">
          <ReceiptText className="h-4 w-4" /> Artist Tax Write-Off Estimator
        </span>
        <ChevronDown className="fl-drawer-chevron h-4 w-4" />
      </summary>
      <div className="space-y-2">
        <p className="fl-hint !mt-0">
          Common costs artists track. Pick a category, type what you paid, and the deductible total
          adds itself up.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div className="fl-field">
            <Label htmlFor="tax-rate">Marginal rate (%)</Label>
            <Input
              id="tax-rate"
              type="number"
              min={0}
              max={100}
              step="0.1"
              inputMode="decimal"
              className="fl-input fl-mono h-8 min-w-0"
              value={sheet.rate}
              onChange={(event) => onChange({ ...sheet, rate: event.target.value })}
              placeholder="0"
            />
          </div>
          <div className="fl-field">
            <Label htmlFor="tax-year">Tax year</Label>
            <Input
              id="tax-year"
              inputMode="numeric"
              className="fl-input fl-mono h-8 min-w-0"
              value={sheet.year}
              onChange={(event) =>
                onChange({ ...sheet, year: event.target.value.replace(/\D/g, "").slice(0, 4) })
              }
              placeholder="2026"
            />
          </div>
        </div>

        {sheet.rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No lines yet. Add the costs you have already paid, and pull the rest across from your
            budget.
          </p>
        ) : (
          <ul className="space-y-2">
            {sheet.rows.map((row, index) => (
              <Row
                key={row.id}
                row={row}
                index={index}
                canRemove={sheet.rows.length > 1}
                onPatch={(next) => patch(row.id, next)}
                onRemove={() => remove(row.id)}
              />
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="fl-ghost-btn"
            onClick={add}
            disabled={sheet.rows.length >= MAX_TAX_ROWS}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add a line
          </button>
          <button type="button" className="fl-ghost-btn" onClick={pull}>
            Pull from my budget
          </button>
        </div>
        <p className="fl-hint !mt-0">
          Pulling uses the lines you ticked paid in the Budget Planner, at the cost you typed there.
          Pull again to keep them in step; your own lines stay as they are.
        </p>

        <div className="fl-drawer-result">
          <span>Deductible total</span>
          <strong>{money(total)}</strong>
        </div>
        <div className="fl-drawer-result">
          <span>Estimated tax savings</span>
          <strong>{money(estimate)}</strong>
        </div>
        <p className="fl-hint !mt-0">
          {filled} {filled === 1 ? "line" : "lines"} with an amount
          {kept ? ` · ${kept} with paperwork noted` : ""}
          {rate > 0 ? ` · ${rate}% rate` : ""}.
        </p>

        <button type="button" className="fl-ghost-btn" onClick={download}>
          <Download className="h-3.5 w-3.5" aria-hidden="true" /> Download worksheet (.csv)
        </button>
        <p className="fl-hint !mt-0">
          Estimate only. Your tax professional decides what qualifies and your actual rate.
        </p>
      </div>
    </details>
  );
}
