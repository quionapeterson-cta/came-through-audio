import type { jsPDF as JsPDF } from "jspdf";
import type { PDFDict, PDFRef } from "pdf-lib";
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

/**
 * One control in the fillable copy, in millimetres from the page's top-left corner, exactly where jsPDF drew (or would
 * have drawn) it: a line's Actual cell, a Paid tick, or one of the totals that follows them.
 */
export type FormCell = {
  /** The field's own name in the finished AcroForm. */
  name: string;
  kind: "text" | "check";
  page: number;
  left: number;
  top: number;
  width: number;
  height: number;
  value?: string;
  checked?: boolean;
  align?: "left" | "right";
  size?: number;
  /** Draws the cell's own frame, so the box the member sees is the field itself and not a printed rule. */
  framed?: boolean;
  /** Acrobat's calculation action: run whenever a field it reads changes. */
  calculate?: string;
};

/** jsPDF works in mm from the top-left; a PDF form field is in points from the bottom-left. */
const MM_TO_PT = 72 / 25.4;
/** The drawn box each fillable "Actual" field sits in. */
const ACTUAL_H = 5.6;
const ACTUAL_W = 25;
/** The Paid tick box on each line of the fillable copy. */
const TICK = 4;
/** Rows start this far above the footer's rule, so a long sheet pages instead of running into it. */
const ROW_LINE = 4.6;
const CHECK_BOTTOM = (pageH: number) => pageH - 26;

const columnsOf = (w: number) => ({
  budgeted: w - MARGIN - 62,
  actual: w - MARGIN - 32,
  status: w - MARGIN,
});

/**
 * The numbers the fillable copy works out for itself. Acrobat's JavaScript is an old engine, so this is plain ES5 with
 * its own helpers repeated in each script: a calculation action runs on its own, in its own scope.
 */
const JS_NUMBER =
  'function ctaNumber(v){var s=String(v),out="",i,ch;for(i=0;i<s.length;i++){ch=s.charAt(i);if((ch>="0"&&ch<="9")||ch==="."||ch==="-"){out+=ch;}}var n=parseFloat(out);return isNaN(n)?0:n;}';
const JS_MONEY =
  'function ctaMoney(n){var neg=n<0;if(neg){n=-n;}var p=n.toFixed(2).split("."),w=p[0],out="",c=0,i;for(i=w.length-1;i>=0;i--){out=w.charAt(i)+out;c++;if(c%3===0&&i>0){out=","+out;}}return (neg?"-$":"$")+out+"."+p[1];}';
const JS_HELPERS = `${JS_NUMBER}\n${JS_MONEY}`;
const JS_SUM = (lines: number) =>
  `var ctaTotal=0,ctaI,ctaF;for(ctaI=1;ctaI<=${lines};ctaI++){ctaF=this.getField("actual-"+ctaI);if(ctaF){ctaTotal+=ctaNumber(ctaF.value);}}`;

/** Spent so far: what every typed Actual adds up to. */
export const spentScript = (lines: number) =>
  `${JS_HELPERS}\n${JS_SUM(lines)}\nevent.value=ctaMoney(ctaTotal);`;

/** Remaining: the cap the file was built with, less what the Actuals add up to. */
export const remainingScript = (lines: number, cap: number) =>
  `${JS_HELPERS}\n${JS_SUM(lines)}\nevent.value=ctaMoney(${Number(cap) || 0}-ctaTotal);`;

/**
 * The paid count: a line counts once it has an amount typed against it, exactly as the spreadsheets count it, or once
 * its box is ticked — so typing is enough, and a member who prefers the box is counted the same way.
 */
export const paidCountScript = (lines: number) =>
  `var ctaPaid=0,ctaI,ctaT,ctaA;for(ctaI=1;ctaI<=${lines};ctaI++){ctaT=this.getField("paid-"+ctaI);ctaA=this.getField("actual-"+ctaI);if((ctaT&&ctaT.value!=="Off")||(ctaA&&ctaA.value!=="")){ctaPaid++;}}event.value=ctaPaid+" of ${lines} paid";`;

/**
 * The checklist's column labels and the rule under them. Returns where the first row's baseline goes — further down when
 * the row carries a form box, since that box is taller than a line of type and would otherwise cut the ACTUAL label.
 */
function columnHeader(pdf: JsPDF, w: number, y: number, gap = 3.5, form = false) {
  const cols = columnsOf(w);
  const columns: [string, number, "left" | "right"][] = [
    ["Item", MARGIN, "left"],
    ["Budgeted", cols.budgeted, "right"],
    ["Actual", cols.actual, "right"],
    [form ? "Paid" : "Status", cols.status, "right"],
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
 * With `cells` given the sheet is drawn as a form instead of a print: each line's Actual is a real input cell, its Paid
 * a tick box, and the numbers that depend on them (spent, remaining, the checklist's actual total, the paid count) are
 * fields Acrobat recalculates rather than figures frozen at download (founder, 2026-11-25). Their geometry is collected
 * for `buildFillableBudgetPdfBytes` to lay the fields over.
 */
function layout(
  pdf: JsPDF,
  sheet: BudgetSheet,
  brand: PdfBrand | null | undefined,
  cells?: FormCell[],
) {
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  const cols = columnsOf(w);
  const totals = budgetProgress(sheet.rows, sheet.target);
  const bottom = CHECK_BOTTOM(h);
  const form = !!cells;
  const lines = sheet.rows.length;
  const caps = Number(sheet.target) || 0;

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
    // The cap never moves once the sheet is made; spent and remaining do, so on the form they are cells that total up.
    if (!cells || index === 0) {
      font(pdf, "bold", 13)
        .setTextColor(...(value < 0 ? accentOf(pdf) : INK))
        .text(money(value), x + 4, y + 14);
    } else {
      cells.push({
        name: index === 1 ? "spent" : "remaining",
        kind: "text",
        page: pdf.getNumberOfPages(),
        left: x + 3.2,
        top: y + 8,
        width: boxW - 7,
        height: 7.4,
        align: "left",
        size: 13,
        // Nothing is printed here: a figure frozen at download would be wrong the moment one is typed in a viewer that
        // does not calculate, so the cell is left for the calculation (or for the member) to fill.
        ...(index === 1 ? { calculate: spentScript(lines) } : {}),
      });
    }
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
  y = columnHeader(pdf, w, y, form ? 9.5 : 3.5, form);

  const rowH = 6.4;
  let line = 0;
  for (const row of sheet.rows) {
    if (y + rowH > bottom) {
      pdf.addPage();
      y = columnHeader(pdf, w, 26, form ? 9.5 : 3.5, form);
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
    line += 1;
    if (cells) {
      // The cell itself is the field — no printed rule underneath it, so the box the member clicks is the input.
      cells.push({
        name: `actual-${line}`,
        kind: "text",
        page: pdf.getNumberOfPages(),
        left: cols.actual - ACTUAL_W,
        top: y - ACTUAL_H + 1.4,
        width: ACTUAL_W,
        height: ACTUAL_H,
        value: actual,
        align: "right",
        size: 9,
        framed: true,
      });
      // The line's state is a tick the member works, not a word printed when the file was made: a line with an amount
      // typed against it already counts as paid, and the tick is there for a member filling in a viewer that does not
      // calculate.
      const boxTop = y - 3.4;
      pdf
        .setDrawColor(...RULE)
        .setLineWidth(0.3)
        .rect(cols.status - TICK, boxTop, TICK, TICK);
      cells.push({
        name: `paid-${line}`,
        kind: "check",
        page: pdf.getNumberOfPages(),
        left: cols.status - TICK,
        top: boxTop,
        width: TICK,
        height: TICK,
        checked: row.paid,
      });
    } else {
      font(pdf, "regular", 9.5)
        .setTextColor(...MUTED)
        .text(actual ? money(Number(actual) || 0) : "—", cols.actual, y, { align: "right" });
      font(pdf, "semibold", 9)
        .setTextColor(...(row.paid ? accentOf(pdf) : MUTED))
        .text(row.paid ? "PAID" : "ESTIMATED", cols.status, y, { align: "right" });
    }
    y += rowH;
  }

  // The checklist's own total: what the lines add up to, and what has actually been paid of it.
  if (y + 12 > bottom) {
    pdf.addPage();
    y = cells ? 36 : 28;
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
  if (cells) {
    // The actual total is a cell, not a frozen figure: Acrobat fills it from the Actuals above and keeps it current.
    cells.push({
      name: "actual-total",
      kind: "text",
      page: pdf.getNumberOfPages(),
      left: cols.actual - ACTUAL_W,
      top: y - 4.2,
      width: ACTUAL_W,
      height: 6,
      align: "right",
      size: 9.5,
      framed: true,
      calculate: spentScript(lines),
    });
    // Its box starts clear of the Actual total's: a field paints its own white background, so an overlap would eat
    // the last of the total's figures.
    cells.push({
      name: "paid-count",
      kind: "text",
      page: pdf.getNumberOfPages(),
      left: cols.actual + 2,
      top: y - 4.2,
      width: cols.status - cols.actual - 2,
      height: 6,
      align: "right",
      size: 8,
      calculate: paidCountScript(lines),
    });
  } else {
    font(pdf, "semibold", 9.5)
      .setTextColor(...(totals.spent > totals.planned ? accentOf(pdf) : INK))
      .text(money(totals.spent), cols.actual, y, { align: "right" });
    font(pdf, "semibold", 8)
      .setTextColor(...MUTED)
      .text(`${totals.paidCount} of ${totals.total} paid`, cols.status, y, { align: "right" });
  }
  y += 8;

  // The form's own note: where the sums happen, said in the file rather than only on the page that made it.
  if (cells) {
    font(pdf, "regular", 7.5)
      .setTextColor(...MUTED)
      .text("Actuals and ticks total themselves in Adobe Acrobat or Reader.", MARGIN, y - 2);
    y += 3.5;
  }

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
    tipLines.forEach((text, index) => pdf.text(text, MARGIN + 7, y + 11 + index * ROW_LINE));
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
 * The sheet as a form (founder, 2026-11-25): the Actual column is a real text field per line, the line's state is a tick
 * box, and every figure that depends on them is a field Acrobat recalculates, so typing what was really paid never
 * leaves the sheet saying ESTIMATED or showing the total it had at download. jsPDF can't make fields, so the finished
 * pages are reopened with pdf-lib. A copy that loses its fields is still a readable sheet, so the failure is logged,
 * never shown as an error.
 */
export async function buildFillableBudgetPdfBytes(sheet: BudgetSheet, brand?: PdfBrand | null) {
  const pdf = await newBrandedPdf(brand ?? undefined);
  const cells: FormCell[] = [];
  layout(pdf, sheet, brand, cells);
  const bytes = pdf.output("arraybuffer");
  try {
    const { PDFDocument, PDFName, PDFString, StandardFonts, TextAlignment, rgb } =
      await import("pdf-lib");
    const doc = await PDFDocument.load(bytes);
    const form = doc.getForm();
    const pages = doc.getPages();
    const pageH = pdf.internal.pageSize.getHeight();
    const order: PDFRef[] = [];
    const rule = rgb(RULE[0] / 255, RULE[1] / 255, RULE[2] / 255);
    for (const cell of cells) {
      const page = pages[cell.page - 1];
      if (!page) continue;
      const box = {
        x: cell.left * MM_TO_PT,
        y: (pageH - cell.top - cell.height) * MM_TO_PT,
        width: cell.width * MM_TO_PT,
        height: cell.height * MM_TO_PT,
      };
      if (cell.kind === "check") {
        const field = form.createCheckBox(cell.name);
        field.addToPage(page, { ...box, borderWidth: 0 });
        if (cell.checked) field.check();
        continue;
      }
      const field = form.createTextField(cell.name);
      field.addToPage(page, {
        ...box,
        borderWidth: cell.framed ? 0.6 : 0,
        ...(cell.framed ? { borderColor: rule, backgroundColor: rgb(1, 1, 1) } : {}),
      });
      if (cell.size) field.setFontSize(cell.size);
      field.setAlignment(cell.align === "right" ? TextAlignment.Right : TextAlignment.Left);
      if (cell.value) field.setText(cell.value);
      if (cell.calculate) {
        const dict = (field.acroField as unknown as { dict: PDFDict }).dict;
        dict.set(
          PDFName.of("AA"),
          doc.context.obj({
            C: doc.context.obj({ S: "JavaScript", JS: PDFString.of(cell.calculate) }),
          }),
        );
        order.push(field.ref);
      }
    }
    // Acrobat recalculates in this order, so a total is worked out after the Actuals it reads.
    if (order.length) form.acroForm.dict.set(PDFName.of("CO"), doc.context.obj(order));
    // Every field gets a real appearance stream (founder, 2026-11-25): without one the boxes have no border and the
    // prefilled Actuals show nowhere outside Acrobat, which is what made the old copy look like a printed rule.
    form.updateFieldAppearances(await doc.embedFont(StandardFonts.Helvetica));
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
