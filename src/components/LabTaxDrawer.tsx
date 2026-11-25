import { ChevronDown, Download, Plus, ReceiptText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTaxTables } from "@/components/use-tax-tables";
import { saveBlob } from "@/lib/catalog";
import { paidPlanRows } from "@/lib/financial-lab-budgets";
import { readLabJson } from "@/lib/financial-lab-scenario";
import {
  MAX_TAX_ROWS,
  SELF_EMPLOYMENT_CHOICES,
  TAX_CATEGORIES,
  newTaxRow,
  pullBudgetLines,
  selfEmploymentOf,
  taxCategoryOf,
  taxFilledRows,
  taxKeptRows,
  taxRowAmount,
  taxSheetEstimate,
  taxSheetIncomeRate,
  taxSheetPlanningYear,
  taxSheetSelfEmploymentRate,
  taxSheetTable,
  taxSheetTotal,
  taxWorksheetCsv,
  type SelfEmploymentChoice,
  type TaxCategoryId,
  type TaxRow,
  type TaxSheet,
} from "@/lib/financial-lab-tax";
import {
  FILING_STATUSES,
  bracketLabel,
  bracketsFor,
  filingStatusLabel,
  usd,
  type FilingStatus,
} from "@/lib/tax-brackets";

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
  const { tables, live, checkedAt } = useTaxTables();
  const table = taxSheetTable(sheet, tables);
  const planningYear = taxSheetPlanningYear(sheet);
  const brackets = sheet.status ? bracketsFor(table, sheet.status) : [];
  const incomeRate = taxSheetIncomeRate(sheet);
  const seRate = taxSheetSelfEmploymentRate(sheet, tables);
  const total = taxSheetTotal(sheet);
  const estimate = taxSheetEstimate(sheet, tables);
  const incomeTax = (total * incomeRate) / 100;
  const seSavings = (total * seRate) / 100;
  const filled = taxFilledRows(sheet.rows);
  const kept = taxKeptRows(sheet.rows);
  const choice = SELF_EMPLOYMENT_CHOICES.find(
    (item) => item.id === selfEmploymentOf(sheet.selfEmployment),
  )!;
  // A rate saved before the table existed (or typed by hand on an older sheet) stays selectable, never silently dropped.
  const rateKnown = brackets.some((bracket) => bracket.rate === incomeRate);

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
      new Blob([taxWorksheetCsv(sheet, { song: songTitle, tables })], {
        type: "text/csv;charset=utf-8",
      }),
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
      <div className="space-y-3">
        <p className="fl-hint !mt-0">
          Four steps: set the year and how you file, pick the income range you&apos;re in, add what
          you spent, then say whether to count self-employment tax. The deductible total and the
          estimate add themselves up.
        </p>

        <div className="space-y-1.5">
          <div className="fl-step-label">
            <span className="fl-step-num">1</span> Set the tax year and how you file
          </div>
          <div className="grid grid-cols-2 gap-2">
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
                placeholder={String(planningYear)}
              />
            </div>
            <div className="fl-field">
              <Label htmlFor="tax-status">Filing status</Label>
              <select
                id="tax-status"
                className="fl-input h-8 min-w-0 text-xs"
                value={sheet.status}
                onChange={(event) =>
                  onChange({ ...sheet, status: event.target.value as FilingStatus | "" })
                }
              >
                <option value="">Choose…</option>
                {FILING_STATUSES.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="fl-hint !mt-0">
            {table.year} federal brackets · {table.source}.
            {planningYear !== table.year
              ? ` No ${planningYear} table is published here yet, so ${table.year} is used.`
              : ""}
            {sheet.year ? "" : " Leave the year blank to plan on the current year."}
          </p>
          {live && checkedAt ? (
            <p className="fl-hint !mt-0">
              Bracket tables checked with the Cloudflare Worker on{" "}
              {new Date(checkedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
              .
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <div className="fl-step-label">
            <span className="fl-step-num">2</span> Pick the range your income falls in
          </div>
          <div className="fl-field">
            <Label htmlFor="tax-bracket">
              {sheet.status
                ? `${filingStatusLabel(sheet.status)} · marginal rate`
                : "Marginal rate"}
            </Label>
            <select
              id="tax-bracket"
              className="fl-input h-8 min-w-0 text-xs"
              title={sheet.status ? undefined : "Pick a filing status to see its ranges."}
              value={rateKnown ? String(incomeRate) : ""}
              disabled={!sheet.status}
              onChange={(event) => onChange({ ...sheet, rate: event.target.value })}
            >
              <option value="">
                {sheet.status ? "Choose your income range…" : "Pick a filing status first"}
              </option>
              {brackets.map((bracket) => (
                <option key={bracket.rate} value={bracket.rate}>
                  {`${bracket.rate}% · ${bracketLabel(bracket)}`}
                </option>
              ))}
              {incomeRate > 0 && !rateKnown ? (
                <option value={String(incomeRate)}>
                  {`${incomeRate}% · not in the ${table.year} table`}
                </option>
              ) : null}
            </select>
          </div>
          <p className="fl-hint !mt-0">
            The marginal rate is the tax on your next dollar, which is what a write-off is worth.
            Pick the row your taxable income falls in — your tax professional has the final say.
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="fl-step-label">
            <span className="fl-step-num">3</span> Add what you spent
          </div>
          <p className="fl-hint !mt-0">
            Common costs artists track. Pick a category, type what you paid, and the deductible
            total adds itself up.
          </p>
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
            Pulling uses the lines you ticked paid in the Budget Planner, at the cost you typed
            there. Pull again to keep them in step; your own lines stay as they are.
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="fl-step-label">
            <span className="fl-step-num">4</span> Choose whether to count self-employment tax
          </div>
          <div className="fl-field">
            <Label htmlFor="tax-self-employment">Self-employment tax</Label>
            <select
              id="tax-self-employment"
              className="fl-input h-8 min-w-0 text-xs"
              value={selfEmploymentOf(sheet.selfEmployment)}
              onChange={(event) =>
                onChange({ ...sheet, selfEmployment: event.target.value as SelfEmploymentChoice })
              }
            >
              {SELF_EMPLOYMENT_CHOICES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <p className="fl-hint !mt-0">
            {choice.hint} The {table.year} Social Security cap is {usd(table.selfEmployment.cap)} of
            net self-employment earnings.
          </p>
        </div>

        <div className="fl-drawer-result">
          <span>Deductible total</span>
          <strong>{money(total)}</strong>
        </div>
        <div className="fl-drawer-result">
          <span>Income tax at {incomeRate > 0 ? `${incomeRate}%` : "—"}</span>
          <strong>{money(incomeTax)}</strong>
        </div>
        {seRate > 0 ? (
          <div className="fl-drawer-result">
            <span>Self-employment tax at {seRate}%</span>
            <strong>{money(seSavings)}</strong>
          </div>
        ) : null}
        <div className="fl-drawer-result">
          <span>Estimated tax savings</span>
          <strong>{money(estimate)}</strong>
        </div>
        <p className="fl-hint !mt-0">
          {filled} {filled === 1 ? "line" : "lines"} with an amount
          {kept ? ` · ${kept} with paperwork noted` : ""}
          {incomeRate > 0 ? ` · ${incomeRate}% rate` : ""}
          {seRate > 0 ? ` + ${seRate}% self-employment` : ""}.
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
