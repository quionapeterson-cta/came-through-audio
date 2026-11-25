import { taxSavings } from "@/lib/financial-lab-copy";
import { expenseActual, type ExpenseRow } from "@/lib/financial-lab-budgets";
import {
  currentTaxYear,
  filingStatusLabel,
  selfEmploymentEffectiveRate,
  selfEmploymentMedicareRate,
  taxTableFor,
  type FilingStatus,
  type TaxYearTable,
} from "@/lib/tax-brackets";

/**
 * The artist tax write-off worksheet: a line per cost, each one chosen from a list of typical music-business
 * costs, and the deductible total added up from the amounts the member types.
 *
 * Nothing here decides what is deductible. The list is a set of prompts, the rate is the member's own, and every
 * surface that shows the estimate says it is one — whether a cost qualifies, and how much of it, is the member's
 * tax professional's call.
 */

export type TaxCategoryId =
  | "studio"
  | "players"
  | "mix"
  | "gear"
  | "software"
  | "home"
  | "video"
  | "design"
  | "distribution"
  | "registration"
  | "promotion"
  | "travel"
  | "show"
  | "rehearsal"
  | "legal"
  | "team"
  | "education"
  | "phone"
  | "merch"
  | "other";

export type TaxCategory = {
  id: TaxCategoryId;
  label: string;
  /** What the category usually covers, in plain words. Never a claim that anything qualifies. */
  hint: string;
};

/**
 * The dropdown. Ordered roughly the way a project is spent: making the record, the visuals, getting it out,
 * playing it live, then the business around it.
 */
export const TAX_CATEGORIES: TaxCategory[] = [
  {
    id: "studio",
    label: "Studio time & recording",
    hint: "Room and tracking hours you paid for, including a deposit.",
  },
  {
    id: "players",
    label: "Session players & engineers",
    hint: "Players, engineers and producers you paid for a session.",
  },
  {
    id: "mix",
    label: "Mixing, mastering & vocal editing",
    hint: "Mix, master, comping and tuning invoices.",
  },
  {
    id: "gear",
    label: "Instruments & studio gear",
    hint: "An instrument, mic, interface or repair bought for the work.",
  },
  {
    id: "software",
    label: "Plugins, software & subscriptions",
    hint: "DAW licences, plugin purchases and studio subscriptions.",
  },
  {
    id: "home",
    label: "Home studio share",
    hint: "Enter only the music part of rent, power or a build-out, not the whole bill.",
  },
  {
    id: "video",
    label: "Music videos & photo shoots",
    hint: "Director, camera, crew, locations, styling, hair and retouching.",
  },
  {
    id: "design",
    label: "Cover art, design & merch samples",
    hint: "Artwork, canvas loops, promo stills and printed samples.",
  },
  {
    id: "distribution",
    label: "Distribution & platform fees",
    hint: "A distributor's annual fee or a per-release charge you paid.",
  },
  {
    id: "registration",
    label: "Registrations & membership dues",
    hint: "Copyright filings, PRO or MLC sign-up, ISRC/UPC purchases and dues.",
  },
  {
    id: "promotion",
    label: "Ads, marketing & PR",
    hint: "Paid ads, playlist pitches, PR retainers and printed flyers.",
  },
  {
    id: "travel",
    label: "Travel to sessions & gigs",
    hint: "Fares, mileage, lodging and parking on music travel. Keep the trips logged.",
  },
  {
    id: "show",
    label: "Show & release event costs",
    hint: "Backline, sound, venue fees, hospitality and a launch event.",
  },
  {
    id: "rehearsal",
    label: "Rehearsal space",
    hint: "Room hire for rehearsals and run-throughs.",
  },
  {
    id: "legal",
    label: "Legal & accounting",
    hint: "Contracts, clearance advice, bookkeeping and a preparer's music-business fees.",
  },
  {
    id: "team",
    label: "Management & agent commission",
    hint: "A manager's or booking agent's percentage on music income.",
  },
  {
    id: "education",
    label: "Lessons, courses & workshops",
    hint: "Vocal or instrument lessons, production courses and masterclasses.",
  },
  {
    id: "phone",
    label: "Phone & internet share",
    hint: "Enter only the music share of a bill you would pay anyway.",
  },
  {
    id: "merch",
    label: "Merch production",
    hint: "Blanks, printing, tags, polybags and shipping you paid for a run.",
  },
  {
    id: "other",
    label: "Something else",
    hint: "Name it yourself — your tax professional decides whether it counts.",
  },
];

export const taxCategoryOf = (id: string | undefined): TaxCategory | undefined =>
  TAX_CATEGORIES.find((category) => category.id === id);

/** One line of the worksheet. `category` is blank until the member picks one from the dropdown. */
export type TaxRow = {
  id: string;
  category: TaxCategoryId | "";
  /** The member's own wording, or the budget line a pulled row came from. */
  label: string;
  /** Dollars as typed, so a blank line stays blank instead of counting as a zero. */
  amount: string;
  /** The member's note that they hold the receipt, invoice or contract for this line. */
  kept: boolean;
  /** The Budget Planner row this line came from, so pulling again updates it instead of adding a twin. */
  sourceId?: string;
};

/**
 * Whether the estimate also counts the self-employment tax a business cost saves. "full" is 15.3% on 92.35% of net
 * earnings while the Social Security part still applies (about 14.13%); "medicare" is above the Social Security cap,
 * where only the 2.9% Medicare part is left (about 2.68%); "none" is a member who is not self-employed.
 */
export type SelfEmploymentChoice = "none" | "full" | "medicare";

export const SELF_EMPLOYMENT_CHOICES: {
  id: SelfEmploymentChoice;
  label: string;
  hint: string;
}[] = [
  {
    id: "none",
    label: "Not self-employed",
    hint: "The estimate counts federal income tax only.",
  },
  {
    id: "full",
    label: "Yes — count self-employment tax (~14.13%)",
    hint: "1099, freelance or Schedule C income under the Social Security cap. 15.3% of net earnings is Social Security and Medicare, and it applies to 92.35% of net earnings — about 14.13% of each deductible dollar.",
  },
  {
    id: "medicare",
    label: "Yes, but I'm over the Social Security cap (~2.68%)",
    hint: "Net self-employment earnings above the Social Security cap only carry the 2.9% Medicare part, about 2.68% of each deductible dollar.",
  },
];

export const selfEmploymentOf = (id: string | undefined): SelfEmploymentChoice =>
  SELF_EMPLOYMENT_CHOICES.find((choice) => choice.id === id)?.id ?? "none";

export type TaxSheet = {
  /** Optional planning year, as typed. Blank plans on the current calendar year. */
  year: string;
  /** The member's marginal rate in percent, set by the bracket they pick. Never one of ours. */
  rate: string;
  /** The filing status whose ranges the rate was picked from. Blank until the member picks one. */
  status: FilingStatus | "";
  /** Whether the estimate adds the self-employment tax a write-off saves. */
  selfEmployment: SelfEmploymentChoice;
  rows: TaxRow[];
};

export const MAX_TAX_ROWS = 40;

let rowSequence = 0;
export const newTaxRowId = () => `fl-tax-${Date.now().toString(36)}-${++rowSequence}`;

export function newTaxRow(category: TaxCategoryId | "" = ""): TaxRow {
  return { id: newTaxRowId(), category, label: "", amount: "", kept: false };
}

export function emptyTaxSheet(): TaxSheet {
  return { year: "", rate: "", status: "", selfEmployment: "none", rows: [] };
}

/** What one line adds to the deductible total: a typed amount, or nothing at all. */
export function taxRowAmount(row: TaxRow): number {
  const raw = String(row.amount).replace(/[^0-9.-]/g, "");
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function taxRowsTotal(rows: TaxRow[]): number {
  return rows.reduce((sum, row) => sum + taxRowAmount(row), 0);
}

export const taxSheetTotal = (sheet: TaxSheet): number => taxRowsTotal(sheet.rows);

/** Lines carrying an amount: the worksheet's own "how much is filled in" count. */
export const taxFilledRows = (rows: TaxRow[]): number =>
  rows.filter((row) => taxRowAmount(row) > 0).length;

export const taxKeptRows = (rows: TaxRow[]): number =>
  rows.filter((row) => row.kept && taxRowAmount(row) > 0).length;

/** The year the sheet is planning: the one typed, or the calendar year when it is left blank. */
export const taxSheetPlanningYear = (sheet: TaxSheet, now: Date = new Date()): number =>
  Number(sheet.year) || currentTaxYear(now);

/** The bracket table the sheet's year is priced with, from the tables on hand. */
export const taxSheetTable = (
  sheet: TaxSheet,
  tables?: TaxYearTable[],
  now: Date = new Date(),
): TaxYearTable => taxTableFor(taxSheetPlanningYear(sheet, now), tables);

/** The income-tax part of the estimate, held to a real percentage. */
export const taxSheetIncomeRate = (sheet: TaxSheet): number =>
  Math.min(100, Math.max(0, Number(sheet.rate) || 0));

/** What the self-employment part adds, or nothing when the member is not counting it. */
export const taxSheetSelfEmploymentRate = (
  sheet: TaxSheet,
  tables?: TaxYearTable[],
  now: Date = new Date(),
): number => {
  if (sheet.selfEmployment === "none") return 0;
  const terms = taxSheetTable(sheet, tables, now).selfEmployment;
  return sheet.selfEmployment === "full"
    ? selfEmploymentEffectiveRate(terms)
    : selfEmploymentMedicareRate(terms);
};

/** The rate the whole estimate is worked at: the bracket's rate plus the self-employment part. */
export const taxSheetRate = (
  sheet: TaxSheet,
  tables?: TaxYearTable[],
  now: Date = new Date(),
): number => taxSheetIncomeRate(sheet) + taxSheetSelfEmploymentRate(sheet, tables, now);

/** The estimate: the member's deductible total at the member's own rate, plus self-employment tax if they asked. */
export const taxSheetEstimate = (
  sheet: TaxSheet,
  tables?: TaxYearTable[],
  now: Date = new Date(),
): number => taxSavings(taxSheetTotal(sheet), taxSheetRate(sheet, tables, now));

/**
 * Which worksheet category a published budget line belongs to. A custom budget row has no entry, so it lands on
 * "Something else" with its own name — never dropped, never forced into a wrong category.
 */
export const BUDGET_TAX_CATEGORY: Record<string, TaxCategoryId> = {
  "Director & Camera Operator": "video",
  "Editing & Color Grading": "video",
  "Lighting & Simple Rentals": "video",
  "Key Wardrobe & Props": "video",
  "Crew Essentials": "video",
  "DJ / Sound Support": "show",
  "Local Promotion & Digital Flyers": "promotion",
  "Merch Table & Signage": "merch",
  "Artist Hospitality": "show",
  "Mixing & Mastering": "mix",
  "Visual Package": "design",
  "Targeted Fan Ads": "promotion",
  "Copyright & Registration Reserve": "registration",
  "Studio Time": "studio",
  "Engineer Fees": "players",
  "Vocal Tuning & Editing": "mix",
  "Master Delivery Files": "mix",
  "Raw Garment Blanks": "merch",
  "Printing / Embroidery": "merch",
  "Custom Tagging": "merch",
  "Polybags & Fulfillment": "merch",
  Photographer: "video",
  "Studio Space": "studio",
  "Hair & Wardrobe": "video",
  "Photo Retouching": "video",
};

/** The budget's paid lines as worksheet lines: only what actually left the account, at its actual cost. */
export function taxRowsFromBudget(budget: ExpenseRow[]): TaxRow[] {
  return budget
    .filter((row) => row.paid && expenseActual(row) > 0)
    .map((row) => ({
      id: newTaxRowId(),
      category: BUDGET_TAX_CATEGORY[row.category.trim()] ?? "other",
      label: row.item.trim() || row.category.trim(),
      amount: String(expenseActual(row)),
      kept: false,
      sourceId: row.id,
    }));
}

export type BudgetPull = {
  sheet: TaxSheet;
  added: number;
  updated: number;
  removed: number;
};

/**
 * Pull is a sync, not an append: the lines that came from the budget follow today's paid budget lines, and a line
 * whose budget row is no longer paid comes off the worksheet. The member's own lines stay where they are, in order,
 * with their ticks and wording untouched.
 */
export function pullBudgetLines(sheet: TaxSheet, budget: ExpenseRow[]): BudgetPull {
  const fresh = taxRowsFromBudget(budget);
  const bySource = new Map(fresh.map((row) => [row.sourceId!, row]));
  const seen = new Set<string>();
  const rows: TaxRow[] = [];
  let updated = 0;
  let removed = 0;

  for (const row of sheet.rows) {
    if (!row.sourceId) {
      rows.push(row);
      continue;
    }
    const next = bySource.get(row.sourceId);
    if (!next || seen.has(row.sourceId)) {
      removed += 1;
      continue;
    }
    seen.add(row.sourceId);
    if (next.amount !== row.amount || next.category !== row.category || next.label !== row.label) {
      updated += 1;
    }
    rows.push({ ...row, category: next.category, label: next.label, amount: next.amount });
  }

  const pulled = new Set(sheet.rows.map((row) => row.sourceId).filter(Boolean));
  const added = fresh.filter((row) => !pulled.has(row.sourceId!)).length;
  for (const next of fresh) {
    if (seen.has(next.sourceId!)) continue;
    seen.add(next.sourceId!);
    rows.push(next);
  }

  return { sheet: { ...sheet, rows: rows.slice(0, MAX_TAX_ROWS) }, added, updated, removed };
}

const text = (value: unknown, max = 60): string =>
  typeof value === "string" ? value.slice(0, max) : "";

/** A stored amount keeps its typed shape: a positive number only, anything else opens blank. */
function amountIn(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return value > 0 ? String(value) : "";
  const raw = text(value, 20).trim();
  if (!raw) return "";
  const n = Number(raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? String(n) : "";
}

const rateIn = (value: unknown): string => {
  const raw = text(value, 8).trim();
  if (!raw) return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "";
  return String(Math.min(100, Math.max(0, Math.round(n * 100) / 100)));
};

/** A filing status read back from storage: only the three the table has, anything else opens blank. */
const filingStatusIn = (value: unknown): FilingStatus | "" => {
  const status = text(value, 20);
  return status === "single" || status === "joint" || status === "household" ? status : "";
};

/**
 * Everything read back from storage goes through here: unknown categories fall back to the blank dropdown, a
 * half-written row is dropped, and the list is capped so a corrupted value cannot fill the drawer.
 */
export function sanitizeTaxSheet(raw: unknown): TaxSheet {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rows: TaxRow[] = [];
  const seen = new Set<string>();
  for (const entry of Array.isArray(o["rows"]) ? o["rows"] : []) {
    if (rows.length >= MAX_TAX_ROWS) break;
    const r = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const id = text(r["id"], 64) || newTaxRowId();
    if (seen.has(id)) continue;
    seen.add(id);
    const category = TAX_CATEGORIES.some((c) => c.id === r["category"])
      ? (r["category"] as TaxCategoryId)
      : "";
    const sourceId = text(r["sourceId"], 64);
    rows.push({
      id,
      category,
      label: text(r["label"], 80),
      amount: amountIn(r["amount"]),
      kept: r["kept"] === true,
      ...(sourceId ? { sourceId } : {}),
    });
  }
  const status = filingStatusIn(o["status"]);
  const selfEmployment =
    o["selfEmployment"] === true ? "full" : selfEmploymentOf(text(o["selfEmployment"], 20));
  return {
    year: text(o["year"], 12).replace(/\D/g, "").slice(0, 4),
    rate: rateIn(o["rate"]),
    status,
    selfEmployment,
    rows,
  };
}

/** A field safe for a spreadsheet cell: quoted only when it has to be. */
const cell = (value: string | number) => {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const DISCLAIMER =
  "Estimate only. Whether a cost qualifies where you file, how much of it, and the rate that applies are your tax professional's call. Nothing here is tax advice and nothing here is filed.";

/**
 * The worksheet as a CSV for the member's own records or their preparer: every line with its amount and paperwork
 * note, the deductible total, the estimate at the rate they typed, and the disclaimer on the same sheet.
 */
export function taxWorksheetCsv(
  sheet: TaxSheet,
  meta: { song?: string | undefined; madeAt?: Date; tables?: TaxYearTable[] } = {},
): string {
  const madeAt = meta.madeAt ?? new Date();
  const total = taxSheetTotal(sheet);
  const rate = taxSheetIncomeRate(sheet);
  const seRate = taxSheetSelfEmploymentRate(sheet, meta.tables, madeAt);
  const table = taxSheetTable(sheet, meta.tables, madeAt);
  const savings = taxSheetEstimate(sheet, meta.tables, madeAt);
  const lines: string[] = [
    "CAME THROUGH AUDIO — TAX WRITE-OFF WORKSHEET",
    "The Financial Lab · a planning worksheet, not a tax return",
    "=".repeat(52),
    `Song: ${meta.song?.trim() || "—"}`,
    `Tax year: ${sheet.year || "—"}`,
    `Brackets: ${table.year} federal, ${table.source}`,
    ...(sheet.status ? [`Filing status: ${filingStatusLabel(sheet.status)}`] : []),
    `Prepared: ${madeAt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`,
    `Rate used: ${rate > 0 ? `${rate}%` : "—"}${seRate > 0 ? ` + ${seRate}% self-employment` : ""}`,
    "",
    ["Category", "What it was", "Amount (USD)", "Paperwork kept"].map(cell).join(","),
  ];
  for (const row of sheet.rows) {
    const amount = taxRowAmount(row);
    if (!amount) continue;
    lines.push(
      [
        taxCategoryOf(row.category)?.label ?? "Not chosen yet",
        row.label || "—",
        amount.toFixed(2),
        row.kept ? "Yes" : "No",
      ]
        .map(cell)
        .join(","),
    );
  }
  lines.push(["Total deductible", "", total.toFixed(2), ""].map(cell).join(","));
  if (seRate > 0) {
    lines.push(
      [`Self-employment tax at ${seRate}%`, "", taxSavings(total, seRate).toFixed(2), ""]
        .map(cell)
        .join(","),
    );
  }
  lines.push(
    [
      `Estimated tax savings${rate > 0 ? ` at ${rate}%` : ""}${seRate > 0 ? ` + ${seRate}% self-employment` : ""}`,
      "",
      savings.toFixed(2),
      "",
    ]
      .map(cell)
      .join(","),
  );
  lines.push("", DISCLAIMER);
  return lines.join("\n");
}
