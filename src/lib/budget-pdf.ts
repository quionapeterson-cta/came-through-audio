import type { jsPDF as JsPDF } from "jspdf";
import {
  accentOf,
  brandFooter,
  brandHeader,
  font,
  headerDate,
  INK,
  label,
  MARGIN,
  MUTED,
  newBrandedPdf,
  PANEL,
  RULE,
  sectionTitle,
} from "@/lib/brand-pdf";
import { saveBlob } from "@/lib/catalog";
import {
  budgetProgress,
  expenseActual,
  type AllocatedLine,
  type ExpenseRow,
} from "@/lib/financial-lab-budgets";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export type BudgetSheet = {
  project: string;
  target: number;
  tip: string;
  allocated: AllocatedLine[];
  rows: ExpenseRow[];
};

/**
 * The Production Budget Planner's one-page sheet: the official header, the cap / spent / remaining strip, the itemized
 * allocation, and the live checklist with its Estimated or Paid state. `brandFooter` adds the made-on line, so the
 * sheet carries the same footer as every other download.
 */
export async function buildBudgetPdf(sheet: BudgetSheet) {
  const pdf = await newBrandedPdf();
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  const totals = budgetProgress(sheet.rows, sheet.target);

  let y = brandHeader(
    pdf,
    "Production Budget",
    sheet.project,
    `${money(sheet.target)} target  ·  ${headerDate()}`,
  );

  // Cap, spent, remaining: the same three numbers the live header shows on screen.
  const boxW = (w - MARGIN * 2 - 8) / 3;
  const stats: [string, number][] = [
    ["Budget cap", sheet.target],
    ["Spent so far", totals.spent],
    ["Remaining", totals.remaining],
  ];
  stats.forEach(([name, value], index) => {
    const x = MARGIN + index * (boxW + 4);
    pdf.setFillColor(...PANEL).roundedRect(x, y, boxW, 18, 2.5, 2.5, "F");
    label(pdf, name.toUpperCase(), x + 4, y + 6, MUTED, 7);
    font(pdf, "bold", 13)
      .setTextColor(...(value < 0 ? ([176, 42, 42] as [number, number, number]) : INK))
      .text(money(value), x + 4, y + 14);
  });
  y += 26;

  // Allocation: where the target spend is meant to go, with each category's share of the cap.
  y = sectionTitle(pdf, y, "Where the money goes");
  const pctOfTarget = (line: AllocatedLine) =>
    sheet.target > 0 ? `${Math.round((line.budget / sheet.target) * 100)}%` : `${line.percent}%`;
  for (const line of sheet.allocated) {
    font(pdf, "regular", 10)
      .setTextColor(...INK)
      .text(line.label, MARGIN, y);
    font(pdf, "medium", 10)
      .setTextColor(...MUTED)
      .text(pctOfTarget(line), MARGIN + 112, y, {
        align: "right",
      });
    font(pdf, "semibold", 10)
      .setTextColor(...accentOf(pdf))
      .text(money(line.budget), w - MARGIN, y, { align: "right" });
    y += 6;
  }
  pdf
    .setDrawColor(...RULE)
    .setLineWidth(0.3)
    .line(MARGIN, y - 2.5, w - MARGIN, y - 2.5);
  font(pdf, "semibold", 10)
    .setTextColor(...INK)
    .text("Total planned", MARGIN, y + 3.5);
  font(pdf, "semibold", 10)
    .setTextColor(...accentOf(pdf))
    .text(money(sheet.allocated.reduce((n, line) => n + line.budget, 0)), w - MARGIN, y + 3.5, {
      align: "right",
    });
  y += 12;

  // The checklist. Rows are compact so a full plan stays on the page; extra rows are named rather than cut silently.
  y = sectionTitle(pdf, y, "Expense checklist");
  const columns: [string, number, "left" | "right"][] = [
    ["Item", MARGIN, "left"],
    ["Budgeted", w - MARGIN - 62, "right"],
    ["Actual", w - MARGIN - 32, "right"],
    ["Status", w - MARGIN, "right"],
  ];
  for (const [name, x, align] of columns)
    font(pdf, "semibold", 7.5)
      .setTextColor(...MUTED)
      .text(name.toUpperCase(), x, y, { align, charSpace: 0.35 });
  y += 5;
  pdf
    .setDrawColor(...RULE)
    .setLineWidth(0.25)
    .line(MARGIN, y - 3, w - MARGIN, y - 3);
  y += 3.5;

  const rowH = 6.4;
  // Leave room for the tip box and the footer before the rows are counted.
  const tipLines = sheet.tip
    ? (pdf.splitTextToSize(sheet.tip, w - MARGIN * 2 - 16) as string[])
    : [];
  const tipH = sheet.tip ? 12 + tipLines.length * 4.6 : 0;
  const available = h - 24 - tipH - 8 - y;
  const maxRows = Math.max(1, Math.floor(available / rowH));
  const shown = sheet.rows.length > maxRows ? sheet.rows.slice(0, maxRows - 1) : sheet.rows;

  for (const row of shown) {
    font(pdf, "regular", 9.5).setTextColor(...INK);
    const item = pdf.splitTextToSize(`${row.item || row.category}`, 108) as string[];
    pdf.text(item[0] ?? "—", MARGIN, y);
    font(pdf, "regular", 9.5)
      .setTextColor(...MUTED)
      .text(money(Number(row.budget) || 0), w - MARGIN - 62, y, { align: "right" });
    font(pdf, "regular", 9.5)
      .setTextColor(...MUTED)
      .text(row.paid ? money(expenseActual(row)) : "—", w - MARGIN - 32, y, { align: "right" });
    font(pdf, "semibold", 9)
      .setTextColor(...(row.paid ? accentOf(pdf) : MUTED))
      .text(row.paid ? "PAID" : "ESTIMATED", w - MARGIN, y, { align: "right" });
    y += rowH;
  }
  if (shown.length < sheet.rows.length)
    font(pdf, "regular", 9)
      .setTextColor(...MUTED)
      .text(
        `+ ${sheet.rows.length - shown.length} more line item${sheet.rows.length - shown.length === 1 ? "" : "s"} in the planner`,
        MARGIN,
        y,
      );
  y += 4;

  if (sheet.tip && tipLines.length) {
    y += 6;
    pdf.setFillColor(...PANEL).roundedRect(MARGIN, y, w - MARGIN * 2, tipH - 6, 2.5, 2.5, "F");
    pdf.setFillColor(...accentOf(pdf)).rect(MARGIN, y, 1.6, tipH - 6, "F");
    label(pdf, "CTA TIP", MARGIN + 7, y + 6, accentOf(pdf), 7.5);
    font(pdf, "regular", 9).setTextColor(...INK);
    tipLines.forEach((line, index) => pdf.text(line, MARGIN + 7, y + 11 + index * 4.6));
  }

  brandFooter(pdf);
  return pdf;
}

export async function downloadBudgetPdf(sheet: BudgetSheet) {
  const pdf = await buildBudgetPdf(sheet);
  saveBlob(pdf.output("blob"), `${sheet.project} budget.pdf`);
}
