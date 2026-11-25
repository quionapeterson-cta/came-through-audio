import { describe, expect, it } from "vitest";
import { allocateBudget, blueprintOf, rowsFromAllocation } from "@/lib/financial-lab-budgets";
import { paidCountScript, remainingScript, spentScript } from "@/lib/budget-pdf";
import { budgetSheetCsv, budgetWorkbook } from "@/lib/budget-xlsx";

/** A real music-video plan at $1,000, with its first line paid at $420.50. */
function plan() {
  const bp = blueprintOf("music-video");
  const allocated = allocateBudget(1000, bp);
  const rows = rowsFromAllocation(allocated);
  rows[0]!.paid = true;
  rows[0]!.actual = "420.5";
  return { project: bp.name, target: 1000, tip: bp.tip, allocated, rows };
}

const formula = (cell: { value: unknown }) =>
  (cell.value as { formula?: string } | null)?.formula ?? null;

describe("Production Budget workbook", () => {
  it("keeps every total a live formula over the checklist", async () => {
    const sheet = plan();
    const wb = await budgetWorkbook(sheet);
    const ws = wb.getWorksheet("Budget")!;
    const first = 9;
    const last = first + sheet.rows.length - 1;
    const totalRow = last + 1;

    expect(formula(ws.getCell("B5"))).toBe(`SUM(D${first}:D${last})`);
    expect(formula(ws.getCell("B6"))).toBe("B4-B5");
    expect(formula(ws.getCell(`C${totalRow}`))).toBe(`SUM(C${first}:C${last})`);
    expect(formula(ws.getCell(`D${totalRow}`))).toBe(`SUM(D${first}:D${last})`);
    expect(formula(ws.getCell(`E${totalRow}`))).toContain(`COUNTIF(E${first}:E${last},"PAID")`);
    // Each line's state follows its own Actual box, so a blank line reads Estimated and a number reads Paid.
    expect(formula(ws.getCell(`E${first}`))).toBe(`IF(D${first}="","ESTIMATED","PAID")`);
  });

  it("carries the plan's numbers and the typed actual", async () => {
    const sheet = plan();
    const ws = (await budgetWorkbook(sheet)).getWorksheet("Budget")!;
    expect(ws.getCell("B4").value).toBe(1000);
    expect(ws.getCell("C9").value).toBe(sheet.rows[0]!.budget);
    expect(ws.getCell("D9").value).toBe(420.5);
    // A line nobody has paid yet stays blank, so it does not count as spent.
    expect(ws.getCell("D10").value).toBeNull();
  });

  it("gives the allocation its own sheet with a formula total", async () => {
    const sheet = plan();
    const plan2 = (await budgetWorkbook(sheet)).getWorksheet("Where the money goes")!;
    expect(plan2.getCell("A2").value).toBe(sheet.allocated[0]!.label);
    expect(plan2.getCell("C2").value).toBe(sheet.allocated[0]!.budget);
    expect(formula(plan2.getCell(`C${sheet.allocated.length + 2}`))).toBe(
      `SUM(C2:C${sheet.allocated.length + 1})`,
    );
  });
});

/** RFC 4180, enough of it to read our own file: quotes keep a formula's own commas inside one cell. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

describe("Production Budget CSV (Google Sheets)", () => {
  const cellRows = (
    sheet: Parameters<typeof budgetSheetCsv>[0],
    brand?: Parameters<typeof budgetSheetCsv>[1],
  ) => parseCsv(budgetSheetCsv(sheet, brand));

  it("carries the same live formulas the workbook does", () => {
    const sheet = plan();
    const rows = cellRows(sheet);
    const last = 9 + sheet.rows.length - 1;
    expect(rows[3]).toEqual(["Budget cap", "1000"]);
    expect(rows[4]![1]).toBe(`=SUM(D9:D${last})`);
    expect(rows[5]![1]).toBe("=B4-B5");
    expect(rows[7]).toEqual(["Item", "Category", "Budgeted", "Actual", "Status"]);
    // A blank line's status is a formula, so typing an Actual in Sheets flips it to PAID.
    expect(rows[8]![4]).toBe('=IF(D9="","ESTIMATED","PAID")');
  });

  it("writes amounts as plain numbers, with no thousands separators", () => {
    const sheet = plan();
    const rows = cellRows(sheet);
    expect(rows[8]![2]).toBe(String(sheet.rows[0]!.budget));
    expect(rows[8]![3]).toBe("420.5");
    expect(rows[9]![3]).toBe("");
    expect(budgetSheetCsv(sheet)).not.toContain("$1,000");
  });

  it("closes with the checklist total and the plan's own split", () => {
    const sheet = plan();
    const text = budgetSheetCsv(sheet);
    const rows = cellRows(sheet);
    const last = 9 + sheet.rows.length - 1;
    const total = rows[last]!;
    expect(total[0]).toBe("Total");
    expect(total[2]).toBe(`=SUM(C9:C${last})`);
    expect(total[3]).toBe(`=SUM(D9:D${last})`);
    expect(total[4]).toContain("COUNTIF(E9:E");
    // The allocation block follows the checklist, and its total sums its own rows, not the checklist's.
    const headerAt = rows.findIndex((row) => row[0] === "Category" && row[1] === "Share");
    const planFirst = headerAt + 1;
    const planLast = planFirst + sheet.allocated.length - 1;
    expect(rows[planFirst]![0]).toBe(sheet.allocated[0]!.label);
    expect(rows[planLast + 1]![2]).toBe(`=SUM(C${planFirst + 1}:C${planLast + 1})`);
    expect(text.endsWith("\r\n")).toBe(true);
  });

  it("quotes a name that carries a comma, so the row keeps its columns", () => {
    const sheet = plan();
    sheet.rows[1]!.item = "Camera, lens and tripod";
    expect(budgetSheetCsv(sheet)).toContain('"Camera, lens and tripod"');
  });

  it("carries the CTA brand by default and a member's kit when given one", async () => {
    const cta = cellRows(plan());
    expect(cta[0]![0]).toBe("Came Through Audio — Production Budget");
    expect(cta[2]![0]).toBe("Your First Stop Before Distribution");

    const brand = { name: "Karma Came", tagline: "Independent artist", colors: ["#2E073E"] };
    const own = cellRows(plan(), brand);
    expect(own[0]![0]).toBe("Karma Came — Production Budget");
    expect(own[2]![0]).toBe("Independent artist");

    const ws = (await budgetWorkbook(plan(), brand)).getWorksheet("Budget")!;
    expect(ws.getCell("A1").value).toContain("Karma Came — Production Budget");
    expect(ws.getCell("A3").value).toBe("Independent artist");
  });
});

describe("Fillable PDF calculations", () => {
  it("are scripts Acrobat's engine can parse", () => {
    for (const script of [spentScript(5), remainingScript(5, 1000), paidCountScript(5)])
      expect(() => new Function(script)).not.toThrow();
  });

  it("read the fields the form actually creates", () => {
    expect(spentScript(3)).toContain('this.getField("actual-"+ctaI)');
    expect(spentScript(3)).toContain("ctaI<=3");
    expect(remainingScript(4, 2500)).toContain("ctaMoney(2500-ctaTotal)");
    expect(paidCountScript(4)).toContain('this.getField("paid-"+ctaI)');
    expect(paidCountScript(4)).toContain('" of 4 paid"');
  });
});
