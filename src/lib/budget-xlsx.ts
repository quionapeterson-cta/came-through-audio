import type { BudgetSheet } from "@/lib/budget-pdf";
import { saveBlob } from "@/lib/catalog";

/**
 * The Production Budget Planner as a workbook, for the two spreadsheet choices in the Lab's download menu (founder,
 * 2026-11-25). Every total is a live formula, so typing an Actual on a line recalculates Spent, Remaining, the
 * checklist's total and the paid count — the same numbers the planner shows on screen.
 *
 * Both choices write `.xlsx`: it is the one format Excel and Google Sheets both open with its formulas intact. The
 * flavour only changes what the file says about itself and how the download is announced — never the maths.
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

export async function budgetWorkbook(sheet: BudgetSheet, flavor: SheetFlavor = "excel") {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Came Through Audio";
  wb.title =
    flavor === "sheets" ? `${sheet.project} budget for Google Sheets` : `${sheet.project} budget`;

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
  title.value = "Production Budget";
  title.font = { bold: true, size: 18 };
  ws.mergeCells("A2:E2");
  const subtitle = ws.getCell("A2");
  subtitle.value = `${sheet.project}  ·  ${today()}`;
  subtitle.font = { size: 11, color: { argb: "FF525252" } };

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

export async function downloadBudgetXlsx(sheet: BudgetSheet, flavor: SheetFlavor) {
  const wb = await budgetWorkbook(sheet, flavor);
  const buffer = await wb.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${sheet.project} budget.xlsx`,
  );
}
