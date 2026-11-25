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
import type { PdfBrand } from "@/lib/brand-kit";
import { saveBlob } from "@/lib/catalog";
import {
  taxCategoryOf,
  taxRowAmount,
  taxSheetIncomeRate,
  taxSheetSelfEmploymentRate,
  taxSheetTable,
  taxSheetTotal,
  taxSheetYearGap,
  type TaxSheet,
} from "@/lib/financial-lab-tax";
import { filingStatusLabel, type TaxYearTable } from "@/lib/tax-brackets";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export type TaxPdfMeta = {
  madeAt?: Date;
  tables?: TaxYearTable[];
  brand?: PdfBrand | null | undefined;
};

/**
 * One control in the fillable worksheet, in millimetres from the page's top-left corner, exactly where jsPDF drew it:
 * a line's Amount, its Paperwork tick, one of the two rate inputs, or a total that follows them.
 */
type FormCell = {
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
  framed?: boolean;
  readOnly?: boolean;
  /** Acrobat's calculation action: run whenever a field it reads changes. */
  calculate?: string;
};

/** jsPDF works in mm from the top-left; a PDF form field is in points from the bottom-left. */
const MM_TO_PT = 72 / 25.4;
const AMOUNT_W = 25;
const AMOUNT_H = 5.6;
const TICK = 4;
const RESULT_W = 36;
const RESULT_H = 6.5;
const ROW_H = 10.5;

/**
 * Acrobat's calculation engine is an old JavaScript one, so these are plain ES5 helpers repeated in every action:
 * a calculation runs on its own, in its own scope, and can't call anything else in this file.
 */
const JS_NUMBER =
  'function ctaNumber(v){var s=String(v),out="",i,ch;for(i=0;i<s.length;i++){ch=s.charAt(i);if((ch>="0"&&ch<="9")||ch==="."||ch==="-"){out+=ch;}}var n=parseFloat(out);return isNaN(n)?0:n;}';
const JS_MONEY =
  'function ctaMoney(n){var neg=n<0;if(neg){n=-n;}var p=n.toFixed(2).split("."),w=p[0],out="",c=0,i;for(i=w.length-1;i>=0;i--){out=w.charAt(i)+out;c++;if(c%3===0&&i>0){out=","+out;}}return (neg?"-$":"$")+out+"."+p[1];}';
const JS_HELPERS = `${JS_NUMBER}\n${JS_MONEY}`;
const JS_SUM = (lines: number) =>
  `var ctaTotal=0,ctaI,ctaF;for(ctaI=1;ctaI<=${lines};ctaI++){ctaF=this.getField("amount-"+ctaI);if(ctaF){ctaTotal+=ctaNumber(ctaF.value);}}`;

/** The deductible total: what every Amount field adds up to. */
export const taxTotalScript = (lines: number) =>
  `${JS_HELPERS}\n${JS_SUM(lines)}\nevent.value=ctaMoney(ctaTotal);`;

/** Income tax: the deductible total at the marginal rate in the form's own rate field. */
export const taxIncomeScript = (lines: number) =>
  `${JS_HELPERS}\n${JS_SUM(lines)}\nvar ctaRate=ctaNumber(this.getField("rate").value);\nevent.value=ctaMoney(ctaTotal*ctaRate/100);`;

/** Self-employment tax: the deductible total at the effective self-employment rate in its field. */
export const taxSelfEmploymentScript = (lines: number) =>
  `${JS_HELPERS}\n${JS_SUM(lines)}\nvar ctaSe=ctaNumber(this.getField("se-rate").value);\nevent.value=ctaMoney(ctaTotal*ctaSe/100);`;

/** The estimate: income tax plus self-employment tax, read from the two fields that calculated them. */
export const taxSavingsScript = () =>
  `${JS_HELPERS}\nevent.value=ctaMoney(ctaNumber(this.getField("income-tax").value)+ctaNumber(this.getField("se-tax").value));`;

/**
 * The worksheet's totals when the file is made. They are prefilled so the page reads as a record everywhere, and
 * remain real calculation fields so Acrobat updates them as the member types.
 */
export function taxPdfTotals(sheet: TaxSheet, meta: TaxPdfMeta = {}) {
  const total = taxSheetTotal(sheet);
  const rate = taxSheetIncomeRate(sheet);
  const seRate = taxSheetSelfEmploymentRate(sheet, meta.tables, meta.madeAt);
  // Cents, the same place the money formatter and Acrobat's ctaMoney round, so the record and the fields agree.
  const income = Math.round(total * rate) / 100;
  const se = Math.round(total * seRate) / 100;
  return { total, rate, seRate, income, se, savings: income + se };
}

function columnHeader(pdf: JsPDF, w: number, y: number) {
  const amountX = w - MARGIN - RESULT_W - 8;
  for (const [name, x] of [
    ["Cost category", MARGIN],
    ["Amount (USD)", amountX + AMOUNT_W],
    ["Kept", w - MARGIN],
  ] as [string, number][])
    font(pdf, "semibold", 7.5)
      .setTextColor(...MUTED)
      .text(name.toUpperCase(), x, y, { align: x === MARGIN ? "left" : "right", charSpace: 0.35 });
  pdf
    .setDrawColor(...RULE)
    .setLineWidth(0.25)
    .line(MARGIN, y - 3, w - MARGIN, y - 3);
  return y + 8;
}

/**
 * The worksheet: the branded header, the rates as real inputs, one row per cost with an Amount field and a
 * Paperwork tick, then the deductible total, both taxes and the estimate as fields Acrobat recalculates.
 */
function layout(
  pdf: JsPDF,
  sheet: TaxSheet,
  meta: TaxPdfMeta,
  brand: PdfBrand | null | undefined,
  cells?: FormCell[],
) {
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  const totals = taxPdfTotals(sheet, meta);
  const table = taxSheetTable(sheet, meta.tables, meta.madeAt);
  const gap = taxSheetYearGap(sheet, meta.tables, meta.madeAt);
  const year = sheet.year || String(table.year);
  const status = sheet.status ? filingStatusLabel(sheet.status) : "Filing status not set";
  const bottom = h - 26;
  const amountX = w - MARGIN - RESULT_W - 8;
  const form = !!cells;

  let y = brandHeader(
    pdf,
    "Artist Tax Write-Off",
    "Tax worksheet",
    `Tax year ${year}  ·  ${status}  ·  ${headerDate()}`,
    brand,
  );

  // The rates and the table's context. The two rate boxes are the form's inputs; every total below reads them.
  const panelH = 31;
  pdf.setFillColor(...PANEL).roundedRect(MARGIN, y, w - MARGIN * 2, panelH, 2.5, 2.5, "F");
  font(pdf, "bold", 10.5)
    .setTextColor(...INK)
    .text(`Tax year ${year}`, MARGIN + 4, y + 7);
  font(pdf, "regular", 8.5)
    .setTextColor(...MUTED)
    .text(
      `${status}  ·  ${table.year} federal brackets${gap ? ` (no ${gap.asked} table yet)` : ""}`,
      MARGIN + 4,
      y + 12,
    );
  label(pdf, "Marginal rate", MARGIN + 4, y + 19, MUTED, 7);
  label(pdf, "Self-employment rate", MARGIN + 78, y + 19, MUTED, 7);
  if (cells) {
    cells.push({
      name: "rate",
      kind: "text",
      page: pdf.getNumberOfPages(),
      left: MARGIN + 4,
      top: y + 21,
      width: 24,
      height: 6.5,
      value: String(totals.rate),
      align: "right",
      size: 9,
      framed: true,
    });
    cells.push({
      name: "se-rate",
      kind: "text",
      page: pdf.getNumberOfPages(),
      left: MARGIN + 78,
      top: y + 21,
      width: 24,
      height: 6.5,
      value: String(totals.seRate),
      align: "right",
      size: 9,
      framed: true,
    });
  } else {
    font(pdf, "bold", 9)
      .setTextColor(...INK)
      .text(`${totals.rate}%`, MARGIN + 28, y + 25, { align: "right" });
    font(pdf, "bold", 9)
      .setTextColor(...INK)
      .text(`${totals.seRate}%`, MARGIN + 102, y + 25, { align: "right" });
  }
  font(pdf, "regular", 7.5)
    .setTextColor(...MUTED)
    .text("Type a rate and the totals follow.", w - MARGIN - 4, y + 25, { align: "right" });
  y += panelH + 7;

  // Every cost line. Each one gets an Amount field and a Paperwork tick, whether or not it has a value today.
  y = sectionTitle(pdf, y, "What you spent");
  y = columnHeader(pdf, w, y);
  let line = 0;
  for (const row of sheet.rows) {
    if (y + ROW_H > bottom) {
      pdf.addPage();
      y = 26;
      label(pdf, "Artist Tax Write-Off — continued", MARGIN, y, accentOf(pdf), 9);
      y = columnHeader(pdf, w, y + 8);
    }
    const category = taxCategoryOf(row.category)?.label ?? "Not chosen yet";
    font(pdf, "semibold", 9.5)
      .setTextColor(...INK)
      .text(category, MARGIN, y);
    if (row.label && row.label !== category)
      font(pdf, "regular", 8)
        .setTextColor(...MUTED)
        .text(row.label, MARGIN, y + 4);
    line += 1;
    const amount = taxRowAmount(row);
    if (cells) {
      cells.push({
        name: `amount-${line}`,
        kind: "text",
        page: pdf.getNumberOfPages(),
        left: amountX,
        top: y - AMOUNT_H + 1.4,
        width: AMOUNT_W,
        height: AMOUNT_H,
        value: amount ? String(amount) : "",
        align: "right",
        size: 9,
        framed: true,
      });
      // The box the member ticks is the field itself, not a printed word that could disagree with the tick.
      const boxTop = y - 3.4;
      pdf
        .setDrawColor(...RULE)
        .setLineWidth(0.3)
        .rect(w - MARGIN - TICK, boxTop, TICK, TICK);
      cells.push({
        name: `kept-${line}`,
        kind: "check",
        page: pdf.getNumberOfPages(),
        left: w - MARGIN - TICK,
        top: boxTop,
        width: TICK,
        height: TICK,
        checked: row.kept,
      });
    } else {
      font(pdf, "regular", 9.5)
        .setTextColor(...MUTED)
        .text(amount ? money(amount) : "—", amountX + AMOUNT_W, y, { align: "right" });
      font(pdf, "semibold", 8)
        .setTextColor(...(row.kept ? accentOf(pdf) : MUTED))
        .text(row.kept ? "KEPT" : "—", w - MARGIN, y, { align: "right" });
    }
    y += ROW_H;
  }

  // The totals panel. If it does not fit under the last line, it starts a fresh page rather than splitting.
  const results: [string, number, string, string][] = [
    ["Deductible total", totals.total, "total", taxTotalScript(line)],
    ["Income tax", totals.income, "income-tax", taxIncomeScript(line)],
    ["Self-employment tax", totals.se, "se-tax", taxSelfEmploymentScript(line)],
    ["Estimated tax savings", totals.savings, "savings", taxSavingsScript()],
  ];
  const panelH2 = 12 + results.length * 8.5;
  if (y + panelH2 + 22 > bottom) {
    pdf.addPage();
    y = 24;
  }
  pdf.setFillColor(...PANEL).roundedRect(MARGIN, y, w - MARGIN * 2, panelH2, 2.5, 2.5, "F");
  label(pdf, "The estimate", MARGIN + 4, y + 6.5, accentOf(pdf), 8);
  results.forEach(([name, value, fieldName, calculate], index) => {
    const rowY = y + 14 + index * 8.5;
    font(pdf, index === results.length - 1 ? "bold" : "regular", 10)
      .setTextColor(...INK)
      .text(name, MARGIN + 4, rowY);
    if (cells) {
      cells.push({
        name: fieldName,
        kind: "text",
        page: pdf.getNumberOfPages(),
        left: w - MARGIN - 4 - RESULT_W,
        top: rowY - 4.6,
        width: RESULT_W,
        height: RESULT_H,
        value: money(value),
        align: "right",
        size: index === results.length - 1 ? 12 : 10.5,
        readOnly: true,
        calculate,
      });
    } else {
      font(pdf, "bold", index === results.length - 1 ? 12 : 10.5)
        .setTextColor(...(index === results.length - 1 ? accentOf(pdf) : INK))
        .text(money(value), w - MARGIN - 4, rowY, { align: "right" });
    }
  });
  y += panelH2 + 7;

  font(pdf, "regular", 7.5)
    .setTextColor(...MUTED)
    .text("Amounts, rates and totals recalculate in Adobe Acrobat or Reader.", MARGIN, y);
  y += 5;
  const disclaimer = (
    pdf.splitTextToSize(
      "Estimate only. Whether a cost qualifies where you file, how much of it, and the rate that applies are your tax professional's call. Nothing here is tax advice and nothing here is filed.",
      w - MARGIN * 2,
    ) as string[]
  ).slice(0, 4);
  font(pdf, "regular", 8).setTextColor(...MUTED);
  disclaimer.forEach((text, index) => pdf.text(text, MARGIN, y + index * 4));
  y += disclaimer.length * 4;

  if (sheet.rows.length === 0 && form) {
    font(pdf, "regular", 9)
      .setTextColor(...MUTED)
      .text("No cost lines yet — add them in the worksheet and download again.", MARGIN, y + 2);
  }

  brandFooter(pdf, brand ?? undefined);
  return pdf;
}

/**
 * The fillable worksheet, branded with the member's kit when they have one. jsPDF draws the page; pdf-lib lays the
 * real fields over it, so typing an Amount, a tick or a rate recalculates the totals in Acrobat.
 */
export async function buildTaxPdfBytes(sheet: TaxSheet, meta: TaxPdfMeta = {}) {
  const brand = meta.brand ?? undefined;
  const pdf = await newBrandedPdf(brand);
  const cells: FormCell[] = [];
  layout(pdf, sheet, meta, brand, cells);
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
      if (cell.readOnly) field.enableReadOnly();
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
    // Acrobat recalculates in this order, so a total is worked out after the Amounts and rates it reads.
    if (order.length) form.acroForm.dict.set(PDFName.of("CO"), doc.context.obj(order));
    form.updateFieldAppearances(await doc.embedFont(StandardFonts.Helvetica));
    return new Uint8Array(await doc.save());
  } catch (e) {
    console.warn("Tax worksheet PDF came out without its fillable fields:", e);
    // A readable worksheet with printed amounts beats a failed download if the form layer cannot be built.
    const fallback = await newBrandedPdf(brand);
    layout(fallback, sheet, meta, brand, undefined);
    return new Uint8Array(fallback.output("arraybuffer"));
  }
}

export async function downloadTaxPdf(sheet: TaxSheet, meta: TaxPdfMeta = {}) {
  const bytes = await buildTaxPdfBytes(sheet, meta);
  saveBlob(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    "financial-lab tax worksheet.pdf",
  );
}
