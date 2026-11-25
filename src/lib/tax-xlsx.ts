import { saveBlob } from "@/lib/catalog";
import { argb, inkOn, labBrand, type LabBrandSource } from "@/lib/financial-lab-brand";
import {
  taxCategoryOf,
  taxRowAmount,
  taxSheetIncomeRate,
  taxSheetSelfEmploymentRate,
  taxSheetTable,
  taxSheetYearGap,
  type TaxRow,
  type TaxSheet,
} from "@/lib/financial-lab-tax";
import { filingStatusLabel, type TaxYearTable } from "@/lib/tax-brackets";

/**
 * The Artist Tax Write-Off Estimator as the two spreadsheet choices in its download menu: a plain `.csv` Google
 * Sheets imports with live formulas, and a styled `.xlsx` workbook with the same arithmetic. The member can type a
 * line's amount or change either rate, and the deductible total, income tax, self-employment tax and estimate follow.
 *
 * The arithmetic lives in cell formulas, not in figures baked at download, for the same reason the budget sheet's
 * does: a record that stops following the numbers it shows is worse than no record at all. The PDF carries the same
 * calculations as Acrobat fields; the spreadsheets are the copy that recalculates everywhere.
 */
export type SheetFlavor = "excel" | "sheets";

export type TaxExportMeta = {
  madeAt?: Date;
  tables?: TaxYearTable[];
  brand?: LabBrandSource;
};

const MONEY = '"$"#,##0.00';
const HEADER_ROW = 8;
const FIRST_ROW = 9;
const HEADER_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFEDEFF5" },
};

const today = (at: Date) =>
  at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** One CSV cell: quoted only when it has to be, which keeps a formula's own commas inside one cell. */
function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const DISCLAIMER =
  "Estimate only. Whether a cost qualifies where you file, how much of it, and the rate that applies are your tax professional's call. Nothing here is tax advice and nothing here is filed.";

/**
 * The worksheet as a CSV for Google Sheets: the same rows, the same rates and the same formulas the workbook uses.
 * Amounts are plain numbers; the totals are formulas that start with `=`, so Sheets evaluates them on import.
 */
export function taxWorksheetCsv(sheet: TaxSheet, meta: TaxExportMeta = {}): string {
  const madeAt = meta.madeAt ?? new Date();
  const table = taxSheetTable(sheet, meta.tables, madeAt);
  const gap = taxSheetYearGap(sheet, meta.tables, madeAt);
  const rate = taxSheetIncomeRate(sheet);
  const seRate = taxSheetSelfEmploymentRate(sheet, meta.tables, madeAt);
  const brand = labBrand(meta.brand);
  const year = sheet.year || String(table.year);
  const status = sheet.status ? filingStatusLabel(sheet.status) : "Not set";
  const rows: (string | number)[][] = [
    [`${brand.name.toUpperCase()} — TAX WRITE-OFF WORKSHEET`],
    [brand.tagline],
    ["The Financial Lab · a planning worksheet, not a tax return"],
    ["-".repeat(52)],
    [`Tax year: ${year}`],
    [
      `Brackets: ${table.year} federal, ${table.source}${gap ? ` (no ${gap.asked} table yet)` : ""}`,
    ],
    [`Filing status: ${status}`],
    [`Prepared: ${today(madeAt)}`],
    [],
  ];

  // The two rates are inputs: the formulas below read these cells, so changing either one recalculates the estimate.
  const rateRow = rows.length + 1;
  rows.push(["Marginal rate (%)", rate, "", "Self-employment rate (%)", seRate]);
  rows.push([]);
  rows.push(["Cost category", "What it was", "Amount (USD)", "Paperwork kept"]);

  const first = rows.length + 1;
  if (!sheet.rows.length) rows.push(["", "", "", ""]);
  for (const row of sheet.rows) {
    const amount = taxRowAmount(row);
    rows.push([
      taxCategoryOf(row.category)?.label ?? "Not chosen yet",
      row.label || "",
      amount || "",
      row.kept ? "Yes" : "No",
    ]);
  }
  const last = rows.length;
  const totalRow = rows.length + 1;
  rows.push(["Total deductible", "", `=SUM(C${first}:C${last})`, ""]);
  const incomeRow = rows.length + 1;
  rows.push(["Income tax", "", `=ROUND(C${totalRow}*B${rateRow}/100,2)`, ""]);
  const seRow = rows.length + 1;
  rows.push(["Self-employment tax", "", `=ROUND(C${totalRow}*D${rateRow}/100,2)`, ""]);
  rows.push(["Estimated tax savings", "", `=C${incomeRow}+C${seRow}`, ""]);

  rows.push([]);
  rows.push([DISCLAIMER]);

  return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export async function taxWorkbook(sheet: TaxSheet, meta: TaxExportMeta = {}) {
  const { default: ExcelJS } = await import("exceljs");
  const madeAt = meta.madeAt ?? new Date();
  const table = taxSheetTable(sheet, meta.tables, madeAt);
  const gap = taxSheetYearGap(sheet, meta.tables, madeAt);
  const rate = taxSheetIncomeRate(sheet);
  const seRate = taxSheetSelfEmploymentRate(sheet, meta.tables, madeAt);
  const brand = labBrand(meta.brand);
  const year = sheet.year || String(table.year);
  const status = sheet.status ? filingStatusLabel(sheet.status) : "Not set";

  const wb = new ExcelJS.Workbook();
  wb.creator = brand.name;
  wb.company = brand.name;
  wb.title = "Financial Lab tax worksheet";

  const ws = wb.addWorksheet("Tax worksheet", {
    views: [{ state: "frozen", ySplit: HEADER_ROW }],
  });
  ws.getColumn(1).width = 34;
  ws.getColumn(2).width = 32;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 23;
  ws.getColumn(5).width = 12;

  // The brand band: a member's own name and colour when they have a kit, ours otherwise.
  ws.mergeCells("A1:E1");
  const title = ws.getCell("A1");
  title.value = `${brand.name} — Artist Tax Write-Off Worksheet`;
  title.font = { bold: true, size: 18, color: { argb: inkOn(brand.accent) } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(brand.accent) } };
  title.alignment = { vertical: "middle" };
  ws.getRow(1).height = 30;

  ws.mergeCells("A2:E2");
  const tagline = ws.getCell("A2");
  tagline.value = brand.tagline;
  tagline.font = { size: 10, bold: true, color: { argb: argb(brand.accent) } };

  ws.mergeCells("A3:E3");
  const subtitle = ws.getCell("A3");
  subtitle.value = `Tax year ${year}  ·  ${status}`;
  subtitle.font = { size: 11, color: { argb: "FF525252" } };

  ws.mergeCells("A4:E4");
  const prepared = ws.getCell("A4");
  prepared.value = `Prepared ${today(madeAt)}  ·  ${table.year} federal brackets${gap ? ` (no ${gap.asked} table yet)` : ""}`;
  prepared.font = { size: 9, color: { argb: "FF525252" } };

  // The rate inputs. Every calculation below reads B6 and E6, so changing a rate recalculates the whole estimate.
  ws.getCell("A6").value = "Marginal rate (%)";
  ws.getCell("A6").font = { bold: true };
  ws.getCell("B6").value = rate;
  ws.getCell("B6").numFmt = "0.00";
  ws.getCell("D6").value = "Self-employment rate (%)";
  ws.getCell("D6").font = { bold: true };
  ws.getCell("E6").value = seRate;
  ws.getCell("E6").numFmt = "0.00";

  ws.mergeCells("A7:E7");
  const hint = ws.getCell("A7");
  hint.value = "Type an amount or change either rate, and the totals below recalculate.";
  hint.font = { size: 9, italic: true, color: { argb: "FF525252" } };

  const columns = ["Cost category", "What it was", "Amount (USD)", "Paperwork kept"];
  columns.forEach((name, i) => {
    const cell = ws.getRow(HEADER_ROW).getCell(i + 1);
    cell.value = name;
    cell.font = { bold: true, size: 10, color: { argb: argb(brand.accent) } };
    cell.fill = HEADER_FILL;
    cell.border = { bottom: { style: "thin", color: { argb: "FFDEE2EA" } } };
  });
  ws.getRow(HEADER_ROW).height = 20;

  const dataRows: TaxRow[] = sheet.rows.length
    ? sheet.rows
    : [{ id: "blank", category: "", label: "", amount: "", kept: false }];
  dataRows.forEach((row: TaxRow, i) => {
    const r = FIRST_ROW + i;
    const category = ws.getCell(`A${r}`);
    category.value = taxCategoryOf(row.category)?.label ?? "Not chosen yet";
    ws.getCell(`B${r}`).value = row.label || "";
    const amount = ws.getCell(`C${r}`);
    const value = taxRowAmount(row);
    if (value) {
      amount.value = value;
      amount.numFmt = MONEY;
    }
    ws.getCell(`D${r}`).value = row.kept ? "Yes" : "No";
    ws.getCell(`D${r}`).alignment = { horizontal: "center" };
    for (const col of ["A", "B", "C", "D"])
      ws.getCell(`${col}${r}`).border = {
        bottom: { style: "hair", color: { argb: "FFE7EAF0" } },
      };
  });

  const last = FIRST_ROW + dataRows.length - 1;
  const totalRow = last + 1;
  const line = (row: number, label: string, formula: string | null, accent = false) => {
    const name = ws.getCell(`A${row}`);
    name.value = label;
    name.font = { bold: true, ...(accent ? { color: { argb: argb(brand.accent) } } : {}) };
    if (formula) {
      const cell = ws.getCell(`C${row}`);
      cell.value = { formula };
      cell.numFmt = MONEY;
      cell.font = { bold: true, ...(accent ? { color: { argb: argb(brand.accent) } } : {}) };
    }
    for (const col of ["A", "B", "C", "D"])
      ws.getCell(`${col}${row}`).border = {
        top: { style: "thin", color: { argb: "FFDEE2EA" } },
      };
  };
  line(totalRow, "Total deductible", `SUM(C${FIRST_ROW}:C${last})`);
  const incomeRow = totalRow + 1;
  line(incomeRow, "Income tax", `ROUND(C${totalRow}*B6/100,2)`);
  const seRow = incomeRow + 1;
  line(seRow, "Self-employment tax", `ROUND(C${totalRow}*E6/100,2)`);
  const savingsRow = seRow + 1;
  line(savingsRow, "Estimated tax savings", `C${incomeRow}+C${seRow}`, true);

  const noteRow = savingsRow + 2;
  ws.mergeCells(`A${noteRow}:E${noteRow}`);
  const note = ws.getCell(`A${noteRow}`);
  note.value = `${DISCLAIMER} Amounts and rates recalculate in this sheet.`;
  note.font = { size: 9, italic: true, color: { argb: "FF525252" } };
  note.alignment = { wrapText: true, vertical: "top" };
  ws.getRow(noteRow).height = 34;

  return wb;
}

export async function downloadTaxXlsx(sheet: TaxSheet, meta: TaxExportMeta = {}) {
  const wb = await taxWorkbook(sheet, meta);
  const buffer = await wb.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "financial-lab tax worksheet.xlsx",
  );
}

/** The Google Sheets choice: a plain `.csv` whose formulas Google Sheets evaluates on import. */
export function downloadTaxSheetCsv(sheet: TaxSheet, meta: TaxExportMeta = {}) {
  saveBlob(
    new Blob([taxWorksheetCsv(sheet, meta)], { type: "text/csv;charset=utf-8" }),
    "financial-lab tax worksheet.csv",
  );
}
