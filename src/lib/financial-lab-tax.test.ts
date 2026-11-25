import { describe, expect, it } from "vitest";
import type { ExpenseRow } from "./financial-lab-budgets";
import {
  MAX_TAX_ROWS,
  TAX_CATEGORIES,
  newTaxRow,
  pullBudgetLines,
  sanitizeTaxSheet,
  taxCategoryOf,
  taxSheetPlanningYear,
  taxSheetRate,
  taxSheetSelfEmploymentRate,
  taxSheetTable,
  taxFilledRows,
  taxKeptRows,
  taxRowAmount,
  taxRowsFromBudget,
  taxSheetEstimate,
  taxSheetTotal,
  taxWorksheetCsv,
  type TaxSheet,
} from "./financial-lab-tax";

const budgetRow = (over: Partial<ExpenseRow> = {}): ExpenseRow => ({
  id: `b-${Math.random().toString(36).slice(2)}`,
  category: "Studio Time",
  item: "Room and tracking hours",
  budget: 200,
  actual: "",
  paid: true,
  ...over,
});

const sheetOf = (rows: TaxSheet["rows"], rate = "30"): TaxSheet => ({
  year: "",
  rate,
  status: "single",
  selfEmployment: "none",
  rows,
});

describe("the category list", () => {
  it("has one row per cost, each with a label and a plain-language hint", () => {
    const ids = TAX_CATEGORIES.map((category) => category.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("other");
    for (const category of TAX_CATEGORIES) {
      expect(category.label.trim()).not.toBe("");
      expect(category.hint.trim().length).toBeGreaterThan(20);
      // The list prompts; it never tells the member a cost is deductible.
      expect(category.hint.toLowerCase()).not.toContain("you can claim");
    }
  });

  it("finds a category by id and ignores one it does not know", () => {
    expect(taxCategoryOf("mix")?.label).toBe("Mixing, mastering & vocal editing");
    expect(taxCategoryOf("nope")).toBeUndefined();
    expect(taxCategoryOf(undefined)).toBeUndefined();
  });
});

describe("the deductible total", () => {
  it("adds the typed amounts and ignores blanks, words and negatives", () => {
    const rows = [
      newTaxRow("studio"),
      { ...newTaxRow("mix"), amount: "1200" },
      { ...newTaxRow("gear"), amount: "" },
      { ...newTaxRow("travel"), amount: "-5" },
      { ...newTaxRow("other"), amount: "300.50" },
    ];
    expect(taxRowAmount(rows[0]!)).toBe(0);
    expect(taxSheetTotal(sheetOf(rows))).toBe(1500.5);
  });

  it("estimates at the member's own rate, and nothing without one", () => {
    const sheet = sheetOf([{ ...newTaxRow("mix"), amount: "1000" }], "30");
    expect(taxSheetEstimate(sheet)).toBeCloseTo(300, 6);
    expect(taxSheetEstimate({ ...sheet, rate: "" })).toBe(0);
    expect(taxSheetEstimate({ ...sheet, rate: "0" })).toBe(0);
  });

  it("never lets a typed rate past 100% inflate the estimate", () => {
    const sheet = sheetOf([{ ...newTaxRow("mix"), amount: "1000" }], "140");
    expect(taxSheetEstimate(sheet)).toBe(1000);
    expect(taxSheetEstimate({ ...sheet, rate: "-20" })).toBe(0);
  });

  it("prices the bracket the member picks from the year's chart", () => {
    const sheet = { ...sheetOf([{ ...newTaxRow("mix"), amount: "1000" }], "22"), year: "2026" };
    expect(taxSheetTable(sheet).year).toBe(2026);
    expect(taxSheetEstimate(sheet)).toBeCloseTo(220, 6);
  });

  it("uses the year's own chart, and the current year when the year is blank", () => {
    const sheet = { ...sheetOf([]), year: "2027" };
    expect(taxSheetTable(sheet).year).toBe(2027);
    expect(taxSheetTable(sheet).selfEmployment.cap).toBe(192300);
    expect(taxSheetPlanningYear({ ...sheetOf([]), year: "" }, new Date("2027-03-01"))).toBe(2027);
  });

  it("adds self-employment tax at about 14.13% when the member asks for it", () => {
    const sheet = {
      ...sheetOf([{ ...newTaxRow("mix"), amount: "1000" }], "22"),
      selfEmployment: "full" as const,
    };
    expect(taxSheetSelfEmploymentRate(sheet)).toBe(14.13);
    expect(taxSheetRate(sheet)).toBeCloseTo(36.13, 6);
    expect(taxSheetEstimate(sheet)).toBeCloseTo(361.3, 6);
  });

  it("uses only the Medicare part above the Social Security cap", () => {
    const sheet = {
      ...sheetOf([{ ...newTaxRow("mix"), amount: "1000" }], "22"),
      selfEmployment: "medicare" as const,
    };
    expect(taxSheetSelfEmploymentRate(sheet)).toBe(2.68);
    expect(taxSheetEstimate(sheet)).toBeCloseTo(246.8, 6);
  });

  it("counts income tax alone when self-employment is off", () => {
    expect(taxSheetSelfEmploymentRate(sheetOf([]))).toBe(0);
    expect(taxSheetRate(sheetOf([], "22"))).toBe(22);
  });

  it("counts filled lines and lines with paperwork noted", () => {
    const rows = [
      { ...newTaxRow("mix"), amount: "100", kept: true },
      { ...newTaxRow("gear"), amount: "50" },
      { ...newTaxRow("travel"), amount: "", kept: true },
    ];
    expect(taxFilledRows(rows)).toBe(2);
    expect(taxKeptRows(rows)).toBe(1);
  });
});

describe("pulling the paid budget lines", () => {
  it("only brings lines that are paid, at their actual cost", () => {
    const rows = taxRowsFromBudget([
      budgetRow({ paid: true, actual: "180" }),
      budgetRow({ paid: false, actual: "90" }),
      budgetRow({ paid: true, actual: "0", budget: 0 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ category: "studio", amount: "180", kept: false });
    expect(rows[0]!.sourceId).toBeTruthy();
  });

  it("uses the budgeted amount for a paid line with no actual typed", () => {
    const [row] = taxRowsFromBudget([budgetRow({ paid: true, budget: 120, actual: "" })]);
    expect(row!.amount).toBe("120");
  });

  it("maps the published budget lines and sends anything else to Something else", () => {
    const rows = taxRowsFromBudget([
      budgetRow({ category: "Mixing & Mastering", item: "Mix and master" }),
      budgetRow({ category: "Studio Time", item: "Room" }),
      budgetRow({ category: "Custom", item: "Vinyl test pressings" }),
    ]);
    expect(rows.map((row) => row.category)).toEqual(["mix", "studio", "other"]);
    expect(rows[2]!.label).toBe("Vinyl test pressings");
  });

  it("syncs instead of appending: a second pull adds nothing and keeps the ticks", () => {
    const budget = [
      budgetRow({ id: "b1", actual: "180" }),
      budgetRow({ id: "b2", category: "Mixing & Mastering", actual: "400" }),
    ];
    const manual = { ...newTaxRow("travel"), amount: "60" };
    const first = pullBudgetLines(sheetOf([manual]), budget);
    expect(first.added).toBe(2);
    expect(first.updated).toBe(0);
    expect(first.removed).toBe(0);
    expect(first.sheet.rows[0]).toEqual(manual);

    const ticked = {
      ...first.sheet,
      rows: first.sheet.rows.map((row) => (row.sourceId ? { ...row, kept: true } : row)),
    };
    const second = pullBudgetLines(ticked, budget);
    expect(second.added).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.removed).toBe(0);
    expect(second.sheet.rows.filter((row) => row.kept)).toHaveLength(2);
  });

  it("updates a pulled line when the budget's actual changed", () => {
    const first = pullBudgetLines(sheetOf([]), [budgetRow({ id: "b1", actual: "180" })]);
    const again = pullBudgetLines(first.sheet, [budgetRow({ id: "b1", actual: "220" })]);
    expect(again.updated).toBe(1);
    expect(again.sheet.rows[0]!.amount).toBe("220");
  });

  it("removes a pulled line once its budget line is no longer paid, and leaves the member's own", () => {
    const first = pullBudgetLines(sheetOf([{ ...newTaxRow("travel"), amount: "60" }]), [
      budgetRow({ id: "b1", actual: "180" }),
    ]);
    const after = pullBudgetLines(first.sheet, [
      budgetRow({ id: "b1", paid: false, actual: "180" }),
    ]);
    expect(after.removed).toBe(1);
    expect(after.sheet.rows).toHaveLength(1);
    expect(after.sheet.rows[0]!.category).toBe("travel");
  });
});

describe("reading the worksheet back", () => {
  it("opens empty from nothing usable", () => {
    expect(sanitizeTaxSheet(null)).toEqual({
      year: "",
      rate: "",
      status: "",
      selfEmployment: "none",
      rows: [],
    });
    expect(sanitizeTaxSheet("nonsense")).toEqual({
      year: "",
      rate: "",
      status: "",
      selfEmployment: "none",
      rows: [],
    });
  });

  it("remembers the filing status and the self-employment choice", () => {
    const sheet = sanitizeTaxSheet({ status: "joint", selfEmployment: "full", rows: [] });
    expect(sheet.status).toBe("joint");
    expect(sheet.selfEmployment).toBe("full");
    const odd = sanitizeTaxSheet({ status: "married-ish", selfEmployment: "maybe", rows: [] });
    expect(odd.status).toBe("");
    expect(odd.selfEmployment).toBe("none");
  });

  it("keeps what it knows and drops what it does not", () => {
    const sheet = sanitizeTaxSheet({
      year: "20x26",
      rate: "140",
      rows: [
        { id: "a", category: "mix", label: "Mix", amount: "50", kept: true },
        { id: "a", category: "gear", amount: "30" },
        { id: "b", category: "not-a-category", amount: "10" },
        { id: "c", category: "other", amount: "-4" },
      ],
    });
    expect(sheet.year).toBe("2026");
    expect(sheet.rate).toBe("100");
    expect(sheet.rows.map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(sheet.rows[0]).toMatchObject({ category: "mix", amount: "50", kept: true });
    expect(sheet.rows[1]!.category).toBe("");
    expect(sheet.rows[2]!.amount).toBe("");
  });

  it("caps the list", () => {
    const rows = Array.from({ length: MAX_TAX_ROWS + 5 }, (_, i) => ({
      id: `r${i}`,
      category: "mix",
      amount: "1",
    }));
    expect(sanitizeTaxSheet({ rows }).rows).toHaveLength(MAX_TAX_ROWS);
  });
});

describe("the downloaded worksheet", () => {
  const sheet: TaxSheet = {
    year: "2026",
    rate: "30",
    status: "single",
    selfEmployment: "none",
    rows: [
      { ...newTaxRow("mix"), label: "Mix, master", amount: "600", kept: true },
      { ...newTaxRow("merch"), label: 'Hoodie run "first"', amount: "400.50", kept: false },
      { ...newTaxRow("travel"), amount: "", kept: false },
    ],
  };

  it("lists every line with its amount and paperwork note, then the total", () => {
    const csv = taxWorksheetCsv(sheet, { song: "Midnight", madeAt: new Date("2026-11-25") });
    const lines = csv.split("\n");
    expect(lines[0]).toContain("TAX WRITE-OFF WORKSHEET");
    expect(csv).toContain("Midnight");
    expect(csv).toContain("Tax year: 2026");
    expect(csv).toContain("300");
    expect(csv).toContain('"Mix, master",600.00,Yes');
    // Quotes inside a label survive as a doubled quote, so the CSV still parses.
    expect(csv).toContain('"Hoodie run ""first""",400.50,No');
    expect(csv).toContain("Total deductible,,1000.50,");
    expect(csv).toContain("Estimated tax savings at 30%,,300.15,");
    expect(csv).not.toContain("Travel to sessions & gigs");
  });

  it("carries the estimate is not advice line on the same sheet", () => {
    const csv = taxWorksheetCsv(sheet, { song: "Midnight" });
    expect(csv).toContain("Nothing here is tax advice and nothing here is filed");
    expect(csv).toContain("your tax professional's call");
  });

  it("adds the self-employment line and the combined rate when it is counted", () => {
    const csv = taxWorksheetCsv({ ...sheet, selfEmployment: "full" });
    expect(csv).toContain("Filing status: Single filer");
    expect(csv).toContain("Self-employment tax at 14.13%,,141.37,");
    expect(csv).toContain("Estimated tax savings at 30% + 14.13% self-employment,,441.52,");
  });

  it("shows a dash for a rate and a year it was not given", () => {
    const csv = taxWorksheetCsv(
      { year: "", rate: "", status: "", selfEmployment: "none", rows: [] },
      { song: "" },
    );
    expect(csv).toContain("Song: —");
    expect(csv).toContain("Rate used: —");
    expect(csv).toContain("Total deductible,,0.00,");
  });
});
