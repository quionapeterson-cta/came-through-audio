import type { BudgetSheet } from "@/lib/budget-pdf";
import { saveBlob } from "@/lib/catalog";
import { argb, inkOn, labBrand, type LabBrandSource } from "@/lib/financial-lab-brand";

/**
 * The Production Budget Planner as a spreadsheet, for the two spreadsheet choices in the Lab's download menu (founder,
 * 2026-11-25).
 *
 * The two choices are different files, not one file twice (founder, 2026-11-25):
 * - **Excel** is a workbook (`.xlsx`), with the checklist and the allocation on their own sheets and every total a live
 *   formula.
 * - **Google Sheets** is a plain `.csv`, the format Sheets reads straight into a spreadsheet. It carries the same formulas
 *   — typed as cell text beginning with `=` — so a line's Actual still drives Spent, Remaining and the checklist total,
 *   but as text there is no styling, no frozen header and no second tab; the allocation follows underneath.
 *
 * Both recalculate as the member types. The formulas are the same arithmetic in both, so the two files can never
 * disagree about what was paid.
 */
export type SheetFlavor = "excel" | "sheets";

const MONEY = '"$"#,##0.00';
const HEADER_ROW = 8;
const FIRST_ROW = HEADER_ROW + 1;
const HEADER_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFEDEFF5" },
};

/** Today's date, spelled the way every document spells it. */
const today = () =>
  new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** One CSV cell: quoted only when it has to be, which is what keeps a formula's own commas inside one cell. */
function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The same sheet as a CSV for Google Sheets, laid out in the workbook's own rows so a formula reads the same in either
 * file: the live figures in rows 4–6, the checklist from row 9, its total under the last line, then the allocation.
 */
export function budgetSheetCsv(sheet: BudgetSheet, brand?: LabBrandSource): string {
  const rows: (string | number)[][] = [];
  const last = FIRST_ROW + Math.max(0, sheet.rows.length - 1);
  const totalRow = last + 1;
  const name = labBrand(brand);

  // The brand sits in rows 1 and 3, so the live figures keep the row numbers their formulas already reference.
  rows.push([`${name.name} — Production Budget`]);
  rows.push([`${sheet.project}  ·  ${today()}`]);
  rows.push([name.tagline]);
  rows.push(["Budget cap", Number(sheet.target) || 0]);
  rows.push(["Spent so far", `=SUM(D${FIRST_ROW}:D${last})`]);
  rows.push(["Remaining", "=B4-B5"]);
  rows.push([]);
  rows.push(["Item", "Category", "Budgeted", "Actual", "Status"]);

  for (const row of sheet.rows) {
    const typed = row.actual.trim();
    // A typed actual is a number; a blank line stays blank, so its status reads Estimated.
    const actual = typed ? Number(typed) || 0 : "";
    rows.push([
      row.item || row.category,
      row.category,
      Number(row.budget) || 0,
      actual,
      `=IF(D${rows.length + 1}="","ESTIMATED","PAID")`,
    ]);
  }

  rows.push([
    "Total",
    "",
    `=SUM(C${FIRST_ROW}:C${last})`,
    `=SUM(D${FIRST_ROW}:D${last})`,
    `=COUNTIF(E${FIRST_ROW}:E${last},"PAID")&" of "&COUNTA(A${FIRST_ROW}:A${last})&" paid"`,
  ]);
  if (rows.length !== totalRow) throw new Error("Budget CSV lost its row layout");

  // Where the money goes: the plan's own split, with its total as a formula too.
  rows.push([]);
  rows.push(["Where the money goes"]);
  rows.push(["Category", "Share", "Planned"]);
  const planFirst = rows.length + 1;
  for (const line of sheet.allocated)
    rows.push([line.label, `${line.percent}%`, Number(line.budget) || 0]);
  const planLast = planFirst + Math.max(0, sheet.allocated.length - 1);
  rows.push(["Total planned", "", `=SUM(C${planFirst}:C${planLast})`]);

  return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export async function budgetWorkbook(sheet: BudgetSheet, brand?: LabBrandSource) {
  const { default: ExcelJS } = await import("exceljs");
  const brandName = labBrand(brand);
  const wb = new ExcelJS.Workbook();
  wb.creator = brandName.name;
  wb.company = brandName.name;
  wb.title = `${sheet.project} budget`;

  const ws = wb.addWorksheet("Budget", {
    views: [{ state: "frozen", ySplit: HEADER_ROW }],
  });
  ws.getColumn(1).width = 38;
  ws.getColumn(2).width = 26;
  ws.getColumn(3).width = 15;
  ws.getColumn(4).width = 15;
  ws.getColumn(5).width = 17;

  const last = FIRST_ROW + Math.max(0, sheet.rows.length - 1);
  const totalRow = last + 1;

  // Title and the plan it belongs to.
  ws.mergeCells("A1:E1");
  const title = ws.getCell("A1");
  title.value = `${brandName.name} — Production Budget`;
  title.font = { bold: true, size: 18, color: { argb: inkOn(brandName.accent) } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(brandName.accent) } };
  title.alignment = { vertical: "middle" };
  ws.getRow(1).height = 28;
  ws.mergeCells("A2:E2");
  const subtitle = ws.getCell("A2");
  subtitle.value = `${sheet.project}  ·  ${today()}`;
  subtitle.font = { size: 11, color: { argb: "FF525252" } };
  ws.mergeCells("A3:E3");
  const tagline = ws.getCell("A3");
  tagline.value = brandName.tagline;
  tagline.font = { size: 10, bold: true, color: { argb: argb(brandName.accent) } };

  // The live figures. Spent and Remaining are formulas, so they follow the Actual column.
  const figures: [string, string | number, boolean][] = [
    ["Budget cap", Number(sheet.target) || 0, false],
    ["Spent so far", `SUM(D${FIRST_ROW}:D${last})`, true],
    ["Remaining", "B4-B5", true],
  ];
  figures.forEach(([label, value, isFormula], i) => {
    const row = 4 + i;
    const name = ws.getCell(`A${row}`);
    name.value = label;
    name.font = { bold: true };
    const cell = ws.getCell(`B${row}`);
    cell.value = isFormula ? { formula: String(value) } : value;
    cell.numFmt = MONEY;
  });

  // The checklist.
  const columns = ["Item", "Category", "Budgeted", "Actual", "Status"];
  columns.forEach((name, i) => {
    const cell = ws.getRow(HEADER_ROW).getCell(i + 1);
    cell.value = name;
    cell.font = { bold: true, size: 10, color: { argb: "FF0B0B0B" } };
    cell.fill = HEADER_FILL;
    cell.border = { bottom: { style: "thin", color: { argb: "FFDEE2EA" } } };
  });

  sheet.rows.forEach((row, i) => {
    const r = FIRST_ROW + i;
    const item = ws.getCell(`A${r}`);
    item.value = row.item || row.category;
    ws.getCell(`B${r}`).value = row.category;
    const budget = ws.getCell(`C${r}`);
    budget.value = Number(row.budget) || 0;
    budget.numFmt = MONEY;
    const actual = ws.getCell(`D${r}`);
    // A typed actual is a number in the sheet; a blank line stays blank so its status reads Estimated.
    const typed = row.actual.trim();
    if (typed) {
      actual.value = Number(typed) || 0;
      actual.numFmt = MONEY;
    }
    const status = ws.getCell(`E${r}`);
    status.value = { formula: `IF(D${r}="","ESTIMATED","PAID")` };
    status.font = { size: 10 };
  });

  // The checklist's total, in formulas for the same reason.
  const totalLabel = ws.getCell(`A${totalRow}`);
  totalLabel.value = "Total";
  totalLabel.font = { bold: true };
  const totalBudget = ws.getCell(`C${totalRow}`);
  totalBudget.value = { formula: `SUM(C${FIRST_ROW}:C${last})` };
  totalBudget.numFmt = MONEY;
  totalBudget.font = { bold: true };
  const totalActual = ws.getCell(`D${totalRow}`);
  totalActual.value = { formula: `SUM(D${FIRST_ROW}:D${last})` };
  totalActual.numFmt = MONEY;
  totalActual.font = { bold: true };
  const paid = ws.getCell(`E${totalRow}`);
  paid.value = {
    formula: `COUNTIF(E${FIRST_ROW}:E${last},"PAID")&" of "&COUNTA(A${FIRST_ROW}:A${last})&" paid"`,
  };
  paid.font = { bold: true, size: 10 };
  for (const col of ["A", "B", "C", "D", "E"])
    ws.getCell(`${col}${totalRow}`).border = {
      top: { style: "thin", color: { argb: "FFDEE2EA" } },
    };

  // Where the money goes: the plan's own split, with its total as a formula too.
  const plan = wb.addWorksheet("Where the money goes");
  plan.getColumn(1).width = 34;
  plan.getColumn(2).width = 12;
  plan.getColumn(3).width = 16;
  plan.getRow(1).values = ["Category", "Share", "Planned"];
  plan.getRow(1).font = { bold: true, size: 10 };
  plan.getRow(1).eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.border = { bottom: { style: "thin", color: { argb: "FFDEE2EA" } } };
  });
  sheet.allocated.forEach((line, i) => {
    const r = 2 + i;
    plan.getCell(`A${r}`).value = line.label;
    plan.getCell(`B${r}`).value = `${line.percent}%`;
    const cell = plan.getCell(`C${r}`);
    cell.value = Number(line.budget) || 0;
    cell.numFmt = MONEY;
  });
  const planLast = 2 + Math.max(0, sheet.allocated.length - 1);
  const planTotal = plan.getCell(`A${planLast + 1}`);
  planTotal.value = "Total planned";
  planTotal.font = { bold: true };
  const planSum = plan.getCell(`C${planLast + 1}`);
  planSum.value = { formula: `SUM(C2:C${planLast})` };
  planSum.numFmt = MONEY;
  planSum.font = { bold: true };

  return wb;
}

export async function downloadBudgetXlsx(sheet: BudgetSheet, brand?: LabBrandSource) {
  const wb = await budgetWorkbook(sheet, brand);
  const buffer = await wb.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${sheet.project} budget.xlsx`,
  );
}

/** The Google Sheets choice: a plain `.csv`, which Sheets opens into a spreadsheet with its formulas intact. */
export function downloadBudgetSheetCsv(sheet: BudgetSheet, brand?: LabBrandSource) {
  saveBlob(
    new Blob([budgetSheetCsv(sheet, brand)], { type: "text/csv;charset=utf-8" }),
    `${sheet.project} budget.csv`,
  );
}
