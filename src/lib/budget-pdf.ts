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
import type { PdfBrand } from "@/lib/brand-kit";
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

/** One editable "Actual" box, in millimetres from the page's top-left corner, exactly where jsPDF drew it. */
export type ActualBox = {
  page: number;
  left: number;
  top: number;
  width: number;
  height: number;
  value: string;
};

/** jsPDF works in mm from the top-left; a PDF form field is in points from the bottom-left. */
const MM_TO_PT = 72 / 25.4;
/** The drawn box each fillable "Actual" field sits in. */
const ACTUAL_H = 5.6;
const ACTUAL_W = 25;
/** Rows start this far above the footer's rule, so a long sheet pages instead of running into it. */
const ROW_LINE = 4.6;
const CHECK_BOTTOM = (pageH: number) => pageH - 26;

const columnsOf = (w: number) => ({
  budgeted: w - MARGIN - 62,
  actual: w - MARGIN - 32,
  status: w - MARGIN,
});

/**
 * The checklist's column labels and the rule under them. Returns where the first row's baseline goes — further down when
 * the row carries a form box, since that box is taller than a line of type and would otherwise cut the ACTUAL label.
 */
function columnHeader(pdf: JsPDF, w: number, y: number, gap = 3.5) {
  const cols = columnsOf(w);
  const columns: [string, number, "left" | "right"][] = [
    ["Item", MARGIN, "left"],
    ["Budgeted", cols.budgeted, "right"],
    ["Actual", cols.actual, "right"],
    ["Status", cols.status, "right"],
  ];
  for (const [name, x, align] of columns)
    font(pdf, "semibold", 7.5)
      .setTextColor(...MUTED)
      .text(name.toUpperCase(), x, y, { align, charSpace: 0.35 });
  pdf
    .setDrawColor(...RULE)
    .setLineWidth(0.25)
    .line(MARGIN, y - 3, w - MARGIN, y - 3);
  return y + gap;
}

/**
 * The Production Budget Planner's sheet: the official header, the cap / spent / remaining strip, the itemized
 * allocation, the live checklist with its Estimated or Paid state and its totals, and the CTA tip.
 *
 * With `boxes` given, each checklist row's Actual is a drawn box instead of printed text, and its geometry is collected
 * for `buildFillableBudgetPdfBytes` to put a form field in — so the download can be typed into.
 */
function layout(
  pdf: JsPDF,
  sheet: BudgetSheet,
  brand: PdfBrand | null | undefined,
  boxes?: ActualBox[],
) {
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  const cols = columnsOf(w);
  const totals = budgetProgress(sheet.rows, sheet.target);
  const bottom = CHECK_BOTTOM(h);

  let y = brandHeader(
    pdf,
    "Production Budget",
    sheet.project,
    `${money(sheet.target)} target  ·  ${headerDate()}`,
    brand ?? undefined,
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
      .setTextColor(...(value < 0 ? accentOf(pdf) : INK))
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
      .text(pctOfTarget(line), MARGIN + 112, y, { align: "right" });
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
  // The split's own total: what the categories above add up to. The checklist's total below follows the lines instead.
  font(pdf, "semibold", 10)
    .setTextColor(...accentOf(pdf))
    .text(money(sheet.allocated.reduce((n, line) => n + line.budget, 0)), w - MARGIN, y + 3.5, {
      align: "right",
    });
  y += 12;

  // The checklist. Every line prints; a sheet too long for one page continues on the next rather than dropping rows.
  y = sectionTitle(pdf, y, "Expense checklist");
  y = columnHeader(pdf, w, y, boxes ? 9.5 : 3.5);

  const rowH = 6.4;
  for (const row of sheet.rows) {
    if (y + rowH > bottom) {
      pdf.addPage();
      y = columnHeader(pdf, w, 26, boxes ? 9.5 : 3.5);
    }
    font(pdf, "regular", 9.5).setTextColor(...INK);
    // Stop the name short of the Budgeted column, so a long custom entry never prints over its own amount.
    const item = pdf.splitTextToSize(
      `${row.item || row.category}`,
      cols.budgeted - MARGIN - 22,
    ) as string[];
    pdf.text(item[0] ?? "—", MARGIN, y);
    font(pdf, "regular", 9.5)
      .setTextColor(...MUTED)
      .text(money(Number(row.budget) || 0), cols.budgeted, y, { align: "right" });

    // A paid line with no typed cost reads as its budget, exactly as it does on screen; a blank line stays blank.
    const actual = row.actual.trim() || (row.paid ? String(expenseActual(row)) : "");
    if (boxes) {
      const left = cols.actual - ACTUAL_W;
      const top = y - ACTUAL_H + 1.4;
      pdf
        .setFillColor(250, 251, 253)
        .setDrawColor(...RULE)
        .setLineWidth(0.2)
        .roundedRect(left, top, ACTUAL_W, ACTUAL_H, 1, 1, "FD");
      boxes.push({
        page: pdf.getNumberOfPages(),
        left,
        top,
        width: ACTUAL_W,
        height: ACTUAL_H,
        value: actual,
      });
    } else {
      font(pdf, "regular", 9.5)
        .setTextColor(...MUTED)
        .text(actual ? money(Number(actual) || 0) : "—", cols.actual, y, { align: "right" });
    }

    font(pdf, "semibold", 9)
      .setTextColor(...(row.paid ? accentOf(pdf) : MUTED))
      .text(row.paid ? "PAID" : "ESTIMATED", cols.status, y, { align: "right" });
    y += rowH;
  }

  // The checklist's own total: what the lines add up to, and what has actually been paid of it.
  if (y + 10 > bottom) {
    pdf.addPage();
    y = 28;
  }
  pdf
    .setDrawColor(...RULE)
    .setLineWidth(0.3)
    .line(MARGIN, y - 1, w - MARGIN, y - 1);
  y += 4;
  font(pdf, "semibold", 9.5)
    .setTextColor(...INK)
    .text("Total", MARGIN, y);
  font(pdf, "semibold", 9.5)
    .setTextColor(...accentOf(pdf))
    .text(money(totals.planned), cols.budgeted, y, { align: "right" });
  font(pdf, "semibold", 9.5)
    .setTextColor(...(totals.spent > totals.planned ? accentOf(pdf) : INK))
    .text(money(totals.spent), cols.actual, y, { align: "right" });
  font(pdf, "semibold", 8)
    .setTextColor(...MUTED)
    .text(`${totals.paidCount} of ${totals.total} paid`, cols.status, y, { align: "right" });
  y += 8;

  // The tip, in a panel that holds every line it draws (it used to end above its own last baseline).
  const tipLines = sheet.tip
    ? (pdf.splitTextToSize(sheet.tip, w - MARGIN * 2 - 20) as string[])
    : [];
  if (tipLines.length) {
    const tipH = 12 + tipLines.length * ROW_LINE;
    if (y + tipH > bottom) {
      pdf.addPage();
      y = 24;
    }
    pdf.setFillColor(...PANEL).roundedRect(MARGIN, y, w - MARGIN * 2, tipH, 2.5, 2.5, "F");
    pdf.setFillColor(...accentOf(pdf)).rect(MARGIN, y, 1.6, tipH, "F");
    label(pdf, "CTA TIP", MARGIN + 7, y + 6, accentOf(pdf), 7.5);
    font(pdf, "regular", 9).setTextColor(...INK);
    tipLines.forEach((line, index) => pdf.text(line, MARGIN + 7, y + 11 + index * ROW_LINE));
  }

  brandFooter(pdf, brand ?? undefined);
  return pdf;
}

/**
 * The sheet as printed: the same page every download has always been, with the checklist totals added and no line item
 * ever left out.
 */
export async function buildBudgetPdf(sheet: BudgetSheet, brand?: PdfBrand | null) {
  const pdf = await newBrandedPdf(brand ?? undefined);
  return layout(pdf, sheet, brand, undefined);
}

/**
 * The sheet as a form (founder, 2026-11-25): the Actual column becomes a real text field per line, prefilled with what
 * the planner already knows, so the member can type what was really paid into the PDF itself. jsPDF can't make fields,
 * so the finished page is reopened with pdf-lib and a borderless field is laid over each drawn box. A copy that loses
 * its fields is still a readable sheet, so the failure is logged, never shown as an error.
 */
export async function buildFillableBudgetPdfBytes(sheet: BudgetSheet, brand?: PdfBrand | null) {
  const pdf = await newBrandedPdf(brand ?? undefined);
  const boxes: ActualBox[] = [];
  layout(pdf, sheet, brand, boxes);
  const bytes = pdf.output("arraybuffer");
  try {
    const { PDFDocument, TextAlignment } = await import("pdf-lib");
    const doc = await PDFDocument.load(bytes);
    const form = doc.getForm();
    const pages = doc.getPages();
    const pageH = pdf.internal.pageSize.getHeight();
    boxes.forEach((box, index) => {
      const page = pages[box.page - 1];
      if (!page) return;
      const field = form.createTextField(`actual-${index + 1}`);
      field.addToPage(page, {
        x: box.left * MM_TO_PT,
        y: (pageH - box.top - box.height) * MM_TO_PT,
        width: box.width * MM_TO_PT,
        height: box.height * MM_TO_PT,
        borderWidth: 0,
      });
      field.setAlignment(TextAlignment.Right);
      if (box.value) field.setText(box.value);
    });
    return new Uint8Array(await doc.save());
  } catch (e) {
    console.warn("Budget PDF came out without its fillable actuals:", e);
    return new Uint8Array(bytes);
  }
}

export async function downloadBudgetPdf(sheet: BudgetSheet, brand?: PdfBrand | null) {
  const bytes = await buildFillableBudgetPdfBytes(sheet, brand);
  saveBlob(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    `${sheet.project} budget.pdf`,
  );
}
