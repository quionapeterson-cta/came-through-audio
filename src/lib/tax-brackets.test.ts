import { describe, expect, it } from "vitest";
import {
  BRACKET_RATES,
  FILING_STATUSES,
  TAX_TABLES,
  bracketLabel,
  bracketOptionLabel,
  bracketsFor,
  filingStatusOf,
  latestTaxYear,
  mergeTaxTables,
  sanitizeTaxTable,
  selfEmploymentEffectiveRate,
  selfEmploymentMedicareRate,
  taxTableFor,
  taxYears,
  type TaxYearTable,
} from "./tax-brackets";

const ranges = (table: TaxYearTable, status: "single" | "joint" | "household") =>
  bracketsFor(table, status).map((bracket) => [bracket.from, bracket.upTo]);

describe("the 2026 chart", () => {
  const table = taxTableFor(2026);

  it("is the founder's 2026 federal marginal rate chart, row for row", () => {
    expect(table.year).toBe(2026);
    expect(ranges(table, "single")).toEqual([
      [0, 12400],
      [12401, 50400],
      [50401, 105700],
      [105701, 201775],
      [201776, 256225],
      [256226, 640600],
      [640601, null],
    ]);
    expect(ranges(table, "joint")).toEqual([
      [0, 24800],
      [24801, 100800],
      [100801, 211400],
      [211401, 403550],
      [403551, 512450],
      [512451, 768700],
      [768701, null],
    ]);
    expect(ranges(table, "household")).toEqual([
      [0, 17700],
      [17701, 67450],
      [67451, 105700],
      [105701, 201750],
      [201751, 256200],
      [256201, 640600],
      [640601, null],
    ]);
  });

  it("quotes the IRS release it came from", () => {
    expect(table.source).toContain("Rev. Proc. 2025-32");
    expect(table.sourceUrl).toMatch(/^https:\/\/www\.irs\.gov\//);
  });

  it("carries the 2026 self-employment terms", () => {
    expect(table.selfEmployment).toEqual({ rate: 15.3, taxableShare: 92.35, cap: 184500 });
    expect(selfEmploymentEffectiveRate(table.selfEmployment)).toBe(14.13);
    expect(selfEmploymentMedicareRate(table.selfEmployment)).toBe(2.68);
  });
});

describe("the 2027 chart", () => {
  const table = taxTableFor(2027);

  it("is the IRS's published table from Rev. Proc. 2026-35", () => {
    expect(table.year).toBe(2027);
    expect(table.source).toContain("Rev. Proc. 2026-35");
    expect(table.tops.single).toEqual([12800, 52025, 109125, 208325, 264550, 661375]);
    expect(table.tops.joint).toEqual([25600, 104050, 218250, 416650, 529100, 793650]);
    expect(table.tops.household).toEqual([18250, 69650, 109100, 208300, 264550, 661350]);
  });

  it("moves the Social Security cap with the year", () => {
    expect(table.selfEmployment.cap).toBe(192300);
    expect(selfEmploymentEffectiveRate(table.selfEmployment)).toBe(14.13);
  });
});

describe("every table", () => {
  it("has the seven rates, each status, and contiguous brackets", () => {
    for (const table of TAX_TABLES) {
      for (const { id } of FILING_STATUSES) {
        const brackets = bracketsFor(table, id);
        expect(brackets.map((bracket) => bracket.rate)).toEqual([...BRACKET_RATES]);
        expect(brackets[0]!.from).toBe(0);
        expect(brackets.at(-1)!.upTo).toBeNull();
        for (let i = 1; i < brackets.length; i += 1) {
          expect(brackets[i]!.from).toBe(brackets[i - 1]!.upTo! + 1);
          const top = brackets[i]!.upTo;
          if (top !== null) expect(top).toBeGreaterThan(brackets[i]!.from);
        }
      }
    }
  });

  it("reads a range the way the chart does, and the top rate as 'Over'", () => {
    const [first, , third, , , , top] = bracketsFor(taxTableFor(2026), "single");
    expect(bracketLabel(first!)).toBe("$0 – $12,400");
    expect(bracketLabel(third!)).toBe("$50,401 – $105,700");
    expect(bracketLabel(top!)).toBe("Over $640,600");
    expect(bracketOptionLabel(third!)).toBe("22% · $50,401 – $105,700");
  });

  it("keeps the years in order, newest last", () => {
    const years = taxYears();
    expect([...years].sort((a, b) => a - b)).toEqual(years);
    expect(latestTaxYear()).toBe(Math.max(...years));
    expect(filingStatusOf("joint")).toBe("joint");
    expect(filingStatusOf("nope")).toBe("");
  });
});

describe("pricing a year", () => {
  it("uses the year's own table", () => {
    expect(taxTableFor(2026).year).toBe(2026);
    expect(taxTableFor("2027").year).toBe(2027);
  });

  it("never prices a year it does not have with an older or made-up chart", () => {
    // Newest we hold: an unknown future year falls back to it, which is the one the drawer names on screen.
    expect(taxTableFor(2099).year).toBe(latestTaxYear());
    expect(taxTableFor(2025).year).toBe(latestTaxYear());
    expect(taxTableFor("").year).toBe(latestTaxYear());
    expect(taxTableFor(null).year).toBe(latestTaxYear());
  });
});

describe("reading a table from the Worker or storage", () => {
  const good = (): Record<string, unknown> => ({
    year: 2028,
    source: "IRS Rev. Proc. 2027-99",
    sourceUrl: "https://www.irs.gov/pub/irs-drop/rp-27-99.pdf",
    tops: {
      single: [13000, 53000, 110000, 210000, 266000, 663000],
      joint: [26000, 106000, 220000, 420000, 530000, 795000],
      household: [18500, 70000, 110000, 210000, 266000, 663000],
    },
    selfEmployment: { rate: 15.3, taxableShare: 92.35, cap: 195000 },
  });

  it("accepts a complete table", () => {
    const table = sanitizeTaxTable(good());
    expect(table?.year).toBe(2028);
    expect(table?.tops.single).toHaveLength(6);
    expect(table?.selfEmployment.cap).toBe(195000);
  });

  it("rejects a partial or out-of-order table whole", () => {
    const short = good();
    short["tops"] = { ...(short["tops"] as object), single: [13000, 53000] };
    expect(sanitizeTaxTable(short)).toBeNull();

    const backwards = good();
    backwards["tops"] = {
      ...(backwards["tops"] as object),
      joint: [26000, 25000, 220000, 420000, 530000, 795000],
    };
    expect(sanitizeTaxTable(backwards)).toBeNull();

    expect(sanitizeTaxTable({ ...good(), year: 1800 })).toBeNull();
    expect(sanitizeTaxTable({ ...good(), year: 2028.5 })).toBeNull();
    expect(sanitizeTaxTable({ ...good(), selfEmployment: { rate: 15.3 } })).toBeNull();
    expect(sanitizeTaxTable(null)).toBeNull();
  });

  it("lets a fetched year replace the bundled one and keeps the rest", () => {
    const fetched = sanitizeTaxTable({ ...good(), year: 2027, source: "IRS correction" })!;
    const merged = mergeTaxTables(TAX_TABLES, [fetched]);
    expect(merged.find((table) => table.year === 2027)?.source).toBe("IRS correction");
    expect(merged.map((table) => table.year)).toEqual([...taxYears()]);
  });

  it("keeps every bundled year and lets a same-year correction win", () => {
    const correction = sanitizeTaxTable({ ...good(), year: 2026, source: "IRS correction" })!;
    const merged = mergeTaxTables(TAX_TABLES, [correction]);
    expect(merged.map((table) => table.year)).toEqual(taxYears());
    expect(merged.find((table) => table.year === 2026)?.source).toBe("IRS correction");
  });
});
