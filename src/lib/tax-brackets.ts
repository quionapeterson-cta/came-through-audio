/**
 * The federal bracket table the Artist Tax Write-Off Estimator picks a marginal rate from.
 *
 * One entry per tax year, so the year is data instead of a figure typed into a component. The estimator opens on the
 * calendar year and trades up to the next entry by itself on January 1 — nothing has to be scheduled for that. A new
 * year's dollars only ever come from the IRS's own annual inflation-adjustment revenue procedure, quoted in `source`
 * and `sourceUrl` beside the numbers, so nothing here is a guess or a projection.
 *
 * The rates have not moved since 2018 and are not expected to; the thresholds do move every year, which is the whole
 * reason this table is keyed by year.
 */

export type FilingStatus = "single" | "joint" | "household";

export const FILING_STATUSES: { id: FilingStatus; label: string }[] = [
  { id: "single", label: "Single filer" },
  { id: "joint", label: "Married filing jointly" },
  { id: "household", label: "Head of household" },
];

export const filingStatusOf = (id: string | undefined): FilingStatus | "" =>
  FILING_STATUSES.find((status) => status.id === id)?.id ?? "";

export const filingStatusLabel = (id: string | undefined): string =>
  FILING_STATUSES.find((status) => status.id === id)?.label ?? "";

/** The seven rates, in order. The thresholds move each year; the rates themselves do not. */
export const BRACKET_RATES = [10, 12, 22, 24, 32, 35, 37] as const;

export type TaxBracket = {
  rate: number;
  /** The first dollar of taxable income in this bracket. */
  from: number;
  /** The last dollar, or null for the top bracket (37% has no ceiling). */
  upTo: number | null;
};

/**
 * Self-employment tax terms. The 15.3% is 12.4% Social Security plus 2.9% Medicare, and it applies to 92.35% of net
 * earnings — so a deductible business cost saves about 14.13% while the Social Security part still applies. Above the
 * Social Security cap only the Medicare part is left, about 2.68%.
 */
export type SelfEmploymentTerms = {
  /** The combined rate on net earnings: 15.3%. */
  rate: number;
  /** The share of net earnings the rate applies to: 92.35%. */
  taxableShare: number;
  /** The Social Security wage base for the year, above which only Medicare applies. */
  cap: number;
};

export type TaxYearTable = {
  year: number;
  /** The IRS release the figures are taken from, printed beside them. */
  source: string;
  sourceUrl: string;
  /** The top of each bracket from 10% through 35%; the 37% bracket runs above the last one. */
  tops: Record<FilingStatus, number[]>;
  selfEmployment: SelfEmploymentTerms;
};

/**
 * 2026 is the table the founder approved (2026-11-25) from the 2026 federal marginal rate chart.
 * 2027 is the IRS's own published table (Rev. Proc. 2026-35, released 2026-11-05) and its 2027 Social Security wage
 * base of $192,300, so the estimator rolls to 2027 on its own without anything being retyped.
 */
export const TAX_TABLES: TaxYearTable[] = [
  {
    year: 2026,
    source: "IRS Rev. Proc. 2025-32 (2026 inflation adjustments)",
    sourceUrl: "https://www.irs.gov/pub/irs-drop/rp-25-32.pdf",
    tops: {
      single: [12400, 50400, 105700, 201775, 256225, 640600],
      joint: [24800, 100800, 211400, 403550, 512450, 768700],
      household: [17700, 67450, 105700, 201750, 256200, 640600],
    },
    selfEmployment: { rate: 15.3, taxableShare: 92.35, cap: 184500 },
  },
  {
    year: 2027,
    source: "IRS Rev. Proc. 2026-35 (2027 inflation adjustments)",
    sourceUrl: "https://www.irs.gov/pub/irs-drop/rp-26-35.pdf",
    tops: {
      single: [12800, 52025, 109125, 208325, 264550, 661375],
      joint: [25600, 104050, 218250, 416650, 529100, 793650],
      household: [18250, 69650, 109100, 208300, 264550, 661350],
    },
    selfEmployment: { rate: 15.3, taxableShare: 92.35, cap: 192300 },
  },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export const taxYears = (tables: TaxYearTable[] = TAX_TABLES): number[] =>
  tables.map((table) => table.year).sort((a, b) => a - b);

export const latestTaxYear = (tables: TaxYearTable[] = TAX_TABLES): number =>
  taxYears(tables).at(-1) ?? 0;

export const currentTaxYear = (now: Date = new Date()): number => now.getFullYear();

/**
 * The table to price a year with: the newest one at or before the year asked for, and never older than the newest we
 * have. A blank or nonsense year falls back to the latest table, so a half-typed year never blanks the dropdown.
 */
export function taxTableFor(
  year?: number | string | null,
  tables: TaxYearTable[] = TAX_TABLES,
): TaxYearTable {
  const parsed =
    typeof year === "string" ? Number(year.replace(/[^0-9]/g, "")) : Number(year ?? NaN);
  const wanted = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : latestTaxYear(tables);
  const sorted = [...tables].sort((a, b) => b.year - a.year);
  return sorted.find((table) => table.year <= wanted) ?? sorted[0]!;
}

/** Every bracket for a filing status, built from the six thresholds. */
export function bracketsFor(table: TaxYearTable, status: FilingStatus): TaxBracket[] {
  const tops = table.tops[status] ?? [];
  return BRACKET_RATES.map((rate, index) => {
    const previous = index > 0 ? tops[index - 1] : undefined;
    return {
      rate,
      from: index === 0 ? 0 : (previous ?? 0) + 1,
      upTo: tops[index] ?? null,
    };
  });
}

/** The range as it reads in the chart: "$50,401 – $105,700", or "Over $640,600" for the top rate. */
export const bracketLabel = (bracket: TaxBracket): string =>
  bracket.upTo === null
    ? `Over ${usd(bracket.from - 1)}`
    : `${usd(bracket.from)} – ${usd(bracket.upTo)}`;

export const bracketOptionLabel = (bracket: TaxBracket): string =>
  `${bracket.rate}% · ${bracketLabel(bracket)}`;

/** What a write-off saves in self-employment tax while the Social Security part still applies: about 14.13%. */
export const selfEmploymentEffectiveRate = (terms: SelfEmploymentTerms): number =>
  round2((terms.rate * terms.taxableShare) / 100);

/** What it saves above the Social Security cap, where only the 2.9% Medicare part is left: about 2.68%. */
export const selfEmploymentMedicareRate = (terms: SelfEmploymentTerms): number =>
  round2((2.9 * terms.taxableShare) / 100);

/**
 * A table read from the tax Worker or from storage. It is accepted only when every part is there and in order — a
 * partial or out-of-order table is rejected whole, because half a bracket chart is worse than last year's.
 */
export function sanitizeTaxTable(raw: unknown): TaxYearTable | null {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const year = Number(o["year"]);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return null;

  const topsRaw = (o["tops"] && typeof o["tops"] === "object" ? o["tops"] : {}) as Record<
    string,
    unknown
  >;
  const tops = {} as Record<FilingStatus, number[]>;
  for (const { id } of FILING_STATUSES) {
    const list = Array.isArray(topsRaw[id]) ? topsRaw[id] : null;
    if (!list || list.length !== 6) return null;
    const numbers = list.map((value) => Math.round(Number(value)));
    if (numbers.some((n) => !Number.isFinite(n) || n <= 0)) return null;
    if (numbers.some((n, index) => index > 0 && n <= numbers[index - 1]!)) return null;
    tops[id] = numbers;
  }

  const seRaw = (
    o["selfEmployment"] && typeof o["selfEmployment"] === "object" ? o["selfEmployment"] : {}
  ) as Record<string, unknown>;
  const rate = Number(seRaw["rate"]);
  const taxableShare = Number(seRaw["taxableShare"]);
  const cap = Math.round(Number(seRaw["cap"]));
  if (!(rate > 0 && rate < 30)) return null;
  if (!(taxableShare > 0 && taxableShare <= 100)) return null;
  if (!(cap > 1000 && cap < 10_000_000)) return null;

  const source =
    typeof o["source"] === "string" && o["source"].trim()
      ? o["source"].trim().slice(0, 160)
      : "IRS release";
  const sourceUrl =
    typeof o["sourceUrl"] === "string" && /^https?:\/\//.test(o["sourceUrl"])
      ? o["sourceUrl"].slice(0, 300)
      : "";

  return { year, source, sourceUrl, tops, selfEmployment: { rate, taxableShare, cap } };
}

/** A fetched set of tables over the bundled ones, by year: a newer published year wins, an older one never does. */
export function mergeTaxTables(local: TaxYearTable[], remote: TaxYearTable[]): TaxYearTable[] {
  const byYear = new Map<number, TaxYearTable>();
  for (const table of local) byYear.set(table.year, table);
  for (const table of remote) {
    const existing = byYear.get(table.year);
    if (!existing || table.year >= existing.year) byYear.set(table.year, table);
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}
