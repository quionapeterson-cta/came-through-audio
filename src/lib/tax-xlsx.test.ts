import { describe, expect, it } from "vitest";
import { newTaxRow, type TaxSheet } from "./financial-lab-tax";
import {
  taxIncomeScript,
  taxPdfTotals,
  taxSavingsScript,
  taxSelfEmploymentScript,
  taxTotalScript,
} from "./tax-pdf";
import { taxWorkbook, taxWorksheetCsv } from "./tax-xlsx";

const sheet: TaxSheet = {
  year: "2026",
  rate: "30",
  status: "single",
  selfEmployment: "full",
  rows: [
    { ...newTaxRow("mix"), label: "Mix, master", amount: "600", kept: true },
    { ...newTaxRow("merch"), label: 'Hoodie run "first"', amount: "400.50", kept: false },
    { ...newTaxRow("travel"), amount: "", kept: false },
  ],
};

const brand = { name: "Karma Came", tagline: "Independent artist", colors: ["#2E073E"] };

const formula = (cell: { value: unknown }) =>
  (cell.value as { formula?: string } | null)?.formula ?? null;

describe("tax worksheet CSV (Google Sheets)", () => {
  it("carries the CTA brand by default and the member's kit when given one", () => {
    const cta = taxWorksheetCsv(sheet);
    expect(cta).toContain("CAME THROUGH AUDIO — TAX WRITE-OFF WORKSHEET");
    expect(cta).toContain("Your First Stop Before Distribution");
    expect(cta).toContain("The Financial Lab · a planning worksheet, not a tax return");
    const own = taxWorksheetCsv(sheet, { brand });
    expect(own).toContain("KARMA CAME — TAX WRITE-OFF WORKSHEET");
    expect(own).toContain("Independent artist");
    expect(own).not.toContain("CAME THROUGH AUDIO — TAX WRITE-OFF WORKSHEET");
  });

  it("writes the rates as cells the formulas read", () => {
    const csv = taxWorksheetCsv(sheet);
    expect(csv).toContain("Marginal rate (%),30,,Self-employment rate (%),14.13");
    expect(csv).toContain("Total deductible,,=SUM(C13:C15),");
    expect(csv).toContain('Income tax,,"=ROUND(C16*B10/100,2)",');
    expect(csv).toContain('Self-employment tax,,"=ROUND(C16*D10/100,2)",');
    expect(csv).toContain("Estimated tax savings,,=C17+C18,");
    expect(csv).not.toContain("Song:");
  });

  it("keeps every line, including the blank one a member can fill in", () => {
    const csv = taxWorksheetCsv(sheet);
    expect(csv).toContain('"Mixing, mastering & vocal editing","Mix, master",600,Yes');
    expect(csv).toContain('Merch production,"Hoodie run ""first""",400.5,No');
    expect(csv).toContain("Travel to sessions & gigs,,,No");
    expect(csv).toContain("Nothing here is tax advice and nothing here is filed");
  });

  it("writes a valid total range for an empty worksheet", () => {
    const csv = taxWorksheetCsv({
      year: "",
      rate: "",
      status: "",
      selfEmployment: "none",
      rows: [],
    });
    expect(csv).not.toContain("Song:");
    expect(csv).toContain("Total deductible,,=SUM(C13:C13),");
  });
});

describe("tax worksheet workbook", () => {
  it("puts the brand on the title band and the member's colour behind it", async () => {
    const ws = (await taxWorkbook(sheet, { brand })).getWorksheet("Tax worksheet")!;
    expect(ws.getCell("A1").value).toContain("Karma Came — Artist Tax Write-Off Worksheet");
    expect((ws.getCell("A1").fill as { fgColor?: { argb?: string } }).fgColor?.argb).toBe(
      "FF2E073E",
    );
    expect(ws.getCell("A2").value).toBe("Independent artist");
    expect(ws.getCell("A3").value).toBe("Tax year 2026  ·  Single filer");
    expect(ws.getCell("A3").value).not.toContain("No song selected");
  });

  it("keeps the rates, amounts and totals as live inputs and formulas", async () => {
    const ws = (await taxWorkbook(sheet)).getWorksheet("Tax worksheet")!;
    expect(ws.getCell("A1").value).toContain("Came Through Audio");
    expect(ws.getCell("B6").value).toBe(30);
    expect(ws.getCell("E6").value).toBe(14.13);
    expect(ws.getCell("C9").value).toBe(600);
    expect(ws.getCell("C9").numFmt).toBe('"$"#,##0.00');
    expect(ws.getCell("D9").value).toBe("Yes");
    expect(ws.getCell("C10").value).toBe(400.5);
    expect(formula(ws.getCell("C12"))).toBe("SUM(C9:C11)");
    expect(formula(ws.getCell("C13"))).toBe("ROUND(C12*B6/100,2)");
    expect(formula(ws.getCell("C14"))).toBe("ROUND(C12*E6/100,2)");
    expect(formula(ws.getCell("C15"))).toBe("C13+C14");
  });
});

/** Acrobat's actions are ordinary functions: run them against a fake field table to check the arithmetic. */
function run(script: string, fields: Record<string, { value: string }>) {
  const event = { value: "" };
  const form = { getField: (name: string) => fields[name] ?? null };
  new Function("event", script).call(form, event);
  return event.value;
}

describe("fillable tax worksheet calculations", () => {
  const fields = {
    "amount-1": { value: "600" },
    "amount-2": { value: "400.50" },
    "amount-3": { value: "" },
    rate: { value: "30" },
    "se-rate": { value: "14.13" },
  };

  it("are scripts Acrobat's engine can parse", () => {
    for (const script of [
      taxTotalScript(3),
      taxIncomeScript(3),
      taxSelfEmploymentScript(3),
      taxSavingsScript(),
    ])
      expect(() => new Function(script)).not.toThrow();
  });

  it("adds the amounts, applies both rates and sums the estimate", () => {
    expect(run(taxTotalScript(3), fields)).toBe("$1,000.50");
    expect(run(taxIncomeScript(3), fields)).toBe("$300.15");
    expect(run(taxSelfEmploymentScript(3), fields)).toBe("$141.37");
    expect(
      run(taxSavingsScript(), {
        ...fields,
        "income-tax": { value: "$300.15" },
        "se-tax": { value: "$141.37" },
      }),
    ).toBe("$441.52");
  });

  it("matches the figures the calculator shows", () => {
    expect(taxPdfTotals(sheet)).toEqual({
      total: 1000.5,
      rate: 30,
      seRate: 14.13,
      income: 300.15,
      se: 141.37,
      savings: 441.52,
    });
  });
});
