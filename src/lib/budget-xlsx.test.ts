import { describe, expect, it } from "vitest";
import { allocateBudget, blueprintOf, rowsFromAllocation } from "@/lib/financial-lab-budgets";
import { budgetWorkbook } from "@/lib/budget-xlsx";

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
    const wb = await budgetWorkbook(sheet, "excel");
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
    const ws = (await budgetWorkbook(sheet, "excel")).getWorksheet("Budget")!;
    expect(ws.getCell("B4").value).toBe(1000);
    expect(ws.getCell("C9").value).toBe(sheet.rows[0]!.budget);
    expect(ws.getCell("D9").value).toBe(420.5);
    // A line nobody has paid yet stays blank, so it does not count as spent.
    expect(ws.getCell("D10").value).toBeNull();
  });

  it("gives the allocation its own sheet with a formula total", async () => {
    const sheet = plan();
    const plan2 = (await budgetWorkbook(sheet, "sheets")).getWorksheet("Where the money goes")!;
    expect(plan2.getCell("A2").value).toBe(sheet.allocated[0]!.label);
    expect(plan2.getCell("C2").value).toBe(sheet.allocated[0]!.budget);
    expect(formula(plan2.getCell(`C${sheet.allocated.length + 2}`))).toBe(
      `SUM(C2:C${sheet.allocated.length + 1})`,
    );
  });
});
