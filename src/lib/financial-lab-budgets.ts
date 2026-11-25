/**
 * The Production Budget Planner's math and blueprints. Nothing here touches the catalog: a plan is a set of line items
 * that are split from the artist's own target spend, then tracked by hand from estimated to paid.
 *
 * Percentages in a blueprint always add to 100, and `allocateBudget` spreads the target over them in whole cents with a
 * largest-remainder pass, so the itemized dollars always add back up to the cap (never a penny off, never a total that
 * disagrees with the header).
 */
export type ProjectKind =
  | "music-video"
  | "release-party"
  | "single-rollout"
  | "studio-master"
  | "merch-run"
  | "photo-shoot";

export type BlueprintLine = {
  /** The category the money belongs to, shown on the checklist row and the allocation bar. */
  label: string;
  /** The first checklist entry for that category; the artist can rename it. */
  item: string;
  percent: number;
  note: string;
};

export type Blueprint = {
  id: ProjectKind;
  name: string;
  blurb: string;
  tip: string;
  lines: BlueprintLine[];
};

export const BUDGET_BLUEPRINTS: Blueprint[] = [
  {
    id: "music-video",
    name: "Music Video",
    blurb: "Camera, director, editing, lighting, styling and on-set essentials.",
    tip: "At this budget, choose 1 or 2 visually strong free locations (parks, rooftops, city streets) to avoid permit fees entirely.",
    lines: [
      {
        label: "Director & Camera Operator",
        item: "Director / camera operator",
        percent: 45,
        note: "Invest the bulk here for someone with great framing and camera movement.",
      },
      {
        label: "Editing & Color Grading",
        item: "Edit and color grade",
        percent: 25,
        note: "Professional color grading turns inexpensive footage into cinema.",
      },
      {
        label: "Lighting & Simple Rentals",
        item: "One strong key light",
        percent: 15,
        note: "One strong key light; skip paid locations and shoot in visually interesting public or industrial spaces.",
      },
      {
        label: "Key Wardrobe & Props",
        item: "Hero wardrobe and props",
        percent: 10,
        note: "Standout hero pieces, not a full wardrobe.",
      },
      {
        label: "Crew Essentials",
        item: "Water, snacks and crew food",
        percent: 5,
        note: "Keep people energized on set.",
      },
    ],
  },
  {
    id: "release-party",
    name: "Release Party / Showcase",
    blurb: "DJ and sound, local promotion, merch table displays and hospitality.",
    tip: "Partner with a local lounge or venue on a slow night (Tuesday or Thursday) or a door split to eliminate upfront room rental fees.",
    lines: [
      {
        label: "DJ / Sound Support",
        item: "DJ and sound support",
        percent: 40,
        note: "Quality sound is non-negotiable.",
      },
      {
        label: "Local Promotion & Digital Flyers",
        item: "Local posts and digital flyers",
        percent: 30,
        note: "Targeted local social posts and digital flyers beat a wide, untargeted boost.",
      },
      {
        label: "Merch Table & Signage",
        item: "Branded table display and QR signs",
        percent: 20,
        note: "QR codes linking directly to your music and merch.",
      },
      {
        label: "Artist Hospitality",
        item: "Drinks and guest hospitality",
        percent: 10,
        note: "Drinks and hospitality for guest performers.",
      },
    ],
  },
  {
    id: "single-rollout",
    name: "Single Rollout & Promotion",
    blurb: "Mixing and mastering, visual package, direct-to-fan ads, filings and a cushion.",
    tip: "Put paid ads behind a song that already has saves and repeat plays, not a cold upload, and leave the cushion untouched until release week is over.",
    lines: [
      {
        label: "Mixing & Mastering",
        item: "Mix and master the record",
        percent: 30,
        note: "Release-ready audio quality that stands alongside major-label tracks.",
      },
      {
        label: "Visual Package",
        item: "Cover art, canvas loop and promo stills",
        percent: 25,
        note: "One shoot or designer hands you cover art, streaming canvas loops and promo stills.",
      },
      {
        label: "Targeted Fan Ads",
        item: "Direct-to-fan ad spend",
        percent: 25,
        note: "Direct-to-fan promotion targeting active listeners in your genre.",
      },
      {
        label: "Copyright & Registration Reserve",
        item: "Copyright and collection-society filings",
        percent: 10,
        note: "Filing your work with collection societies.",
      },
      {
        label: "Safety Cushion",
        item: "Emergency cash reserve",
        percent: 10,
        note: "Emergency cash reserve for unexpected release expenses.",
      },
    ],
  },
  {
    id: "studio-master",
    name: "Studio Recording & Mastering",
    blurb: "Studio time, engineer fees, vocal tuning and editing, and master delivery files.",
    tip: "Book two shorter blocks instead of one long day: fresh ears on the mix cost less than a rushed second session, and ask for the unmastered mix as well as the master.",
    lines: [
      {
        label: "Studio Time",
        item: "Room and tracking hours",
        percent: 40,
        note: "Book the room you can finish in, not the biggest room in town.",
      },
      {
        label: "Engineer Fees",
        item: "Tracking and mix engineer",
        percent: 30,
        note: "An engineer who knows your references saves hours of guessing.",
      },
      {
        label: "Vocal Tuning & Editing",
        item: "Vocal comping, tuning and edits",
        percent: 18,
        note: "Comping and tuning happen before the mix, never inside it.",
      },
      {
        label: "Master Delivery Files",
        item: "Master and delivery files",
        percent: 12,
        note: "WAV master plus the instrumental and clean versions you will be asked for.",
      },
    ],
  },
  {
    id: "merch-run",
    name: "Merchandise Run",
    blurb: "Raw blanks, printing or embroidery, custom tagging and polybags.",
    tip: "Print a small run and reprint against real sales: a sold-out 40 is worth more than 200 in a closet, and your per-unit cost drops at the reprint.",
    lines: [
      {
        label: "Raw Garment Blanks",
        item: "Blanks in your sizes",
        percent: 40,
        note: "Buy blanks in the size split your audience actually wears, not an even spread.",
      },
      {
        label: "Printing / Embroidery",
        item: "Print or embroidery setup and run",
        percent: 30,
        note: "Ask for the screen or digitizing setup fee in writing before you approve art.",
      },
      {
        label: "Custom Tagging",
        item: "Woven labels and neck tags",
        percent: 15,
        note: "A sewn tag is the cheapest upgrade a run can carry.",
      },
      {
        label: "Polybags & Fulfillment",
        item: "Polybags, labels and packing",
        percent: 15,
        note: "Bag and label every unit before the first show, not the night before.",
      },
    ],
  },
  {
    id: "photo-shoot",
    name: "Photo Shoot & Press Visuals",
    blurb: "Photographer, studio space, hair and wardrobe, and retouching.",
    tip: "Shoot press, cover and social frames in one session — one setup, three deliverables — and ask for the unretouched selects so nothing is lost if you change retouchers.",
    lines: [
      {
        label: "Photographer",
        item: "Photographer day rate",
        percent: 45,
        note: "Pay for a look you could not take on a phone, and agree the deliverable count up front.",
      },
      {
        label: "Studio Space",
        item: "Studio or location booking",
        percent: 20,
        note: "One good backdrop and daylight beats three rented sets.",
      },
      {
        label: "Hair & Wardrobe",
        item: "Hair, makeup and wardrobe",
        percent: 20,
        note: "Pull or borrow hero pieces; spend on the look that reads in a thumbnail.",
      },
      {
        label: "Photo Retouching",
        item: "Retouching and delivery",
        percent: 15,
        note: "Agree how many retouched frames are included before the shoot ends.",
      },
    ],
  },
];

export const blueprintOf = (id: ProjectKind): Blueprint =>
  BUDGET_BLUEPRINTS.find((b) => b.id === id) ?? BUDGET_BLUEPRINTS[0]!;

/** The quick-pick chips on the target-spend step. */
export const QUICK_PICKS = [200, 500, 1000, 2500];

export type AllocatedLine = {
  id: string;
  label: string;
  item: string;
  note: string;
  percent: number;
  /** Whole dollars and cents taken from the target spend. */
  budget: number;
};

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** A target spend spread over a blueprint's percentages, in whole cents that always add back up to the target. */
export function allocateBudget(target: number, blueprint: Blueprint): AllocatedLine[] {
  const totalCents = Math.max(0, Math.round((Number(target) || 0) * 100));
  const raw = blueprint.lines.map((line) => (totalCents * line.percent) / 100);
  const cents = raw.map((value) => Math.floor(value));
  let remainder = totalCents - cents.reduce((sum, value) => sum + value, 0);
  const byFraction = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);
  for (const { index } of byFraction) {
    if (remainder <= 0) break;
    cents[index] = (cents[index] ?? 0) + 1;
    remainder -= 1;
  }
  return blueprint.lines.map((line, index) => ({
    id: `${blueprint.id}-${slug(line.label)}`,
    label: line.label,
    item: line.item,
    note: line.note,
    percent: line.percent,
    budget: (cents[index] ?? 0) / 100,
  }));
}

export type ExpenseRow = {
  id: string;
  category: string;
  item: string;
  /** Planned dollars for this line, editable. */
  budget: number;
  /** What was actually paid, as typed; blank means "not entered yet". */
  actual: string;
  paid: boolean;
  custom?: boolean;
};

let rowSequence = 0;
export const newExpenseId = () => `fl-budget-${Date.now().toString(36)}-${++rowSequence}`;

export function rowsFromAllocation(lines: AllocatedLine[]): ExpenseRow[] {
  return lines.map((line) => ({
    id: newExpenseId(),
    category: line.label,
    item: line.item,
    budget: line.budget,
    actual: "",
    paid: false,
  }));
}

export function customExpenseRow(): ExpenseRow {
  return {
    id: newExpenseId(),
    category: "Custom",
    item: "",
    budget: 0,
    actual: "",
    paid: false,
    custom: true,
  };
}

/** What a paid line cost: the typed actual, or the budgeted amount until the artist enters one. */
export function expenseActual(row: ExpenseRow): number {
  const typed = row.actual.trim();
  if (!typed) return row.budget;
  return Number(typed) || 0;
}

export type BudgetProgress = {
  planned: number;
  spent: number;
  remaining: number;
  spentPercent: number;
  paidCount: number;
  total: number;
};

/**
 * The allocation ring's geometry: each line's share of the money actually allocated, as a fraction of the whole ring.
 * A line's budget can be typed by the artist, so the slices follow the dollars rather than the blueprint's percentage.
 */
export type AllocationSlice = {
  id: string;
  label: string;
  budget: number;
  /** Share of the allocated total, rounded to one decimal for the label. */
  percent: number;
  /** Where the slice starts on the ring, 0 to 1 clockwise from the top. */
  start: number;
  /** Where it ends. A zero-dollar total leaves every slice empty rather than dividing by zero. */
  end: number;
};

export function allocationSlices(lines: AllocatedLine[]): AllocationSlice[] {
  const total = lines.reduce((sum, line) => sum + Math.max(0, Number(line.budget) || 0), 0);
  let cursor = 0;
  return lines.map((line) => {
    const budget = Math.max(0, Number(line.budget) || 0);
    const share = total > 0 ? budget / total : 0;
    const start = cursor;
    cursor = Math.min(1, cursor + share);
    return {
      id: line.id,
      label: line.label,
      budget,
      percent: Math.round(share * 1000) / 10,
      start,
      end: cursor,
    };
  });
}

/**
 * One bar pair per category in the checklist: what was planned against what has actually been paid. Rows sharing a
 * category add up, so a custom entry named after a blueprint line shows in the same pair, and `over` only ever counts
 * money spent past the plan (never a line that is still estimated).
 */
export type CategorySpend = {
  id: string;
  label: string;
  planned: number;
  spent: number;
  /** Dollars paid past the planned amount; 0 while the line is inside its plan. */
  over: number;
};

export function categorySpend(rows: ExpenseRow[]): CategorySpend[] {
  const groups = new Map<string, CategorySpend>();
  for (const row of rows) {
    const label = row.category.trim() || "Custom";
    const id = label.toLowerCase();
    const group = groups.get(id) ?? { id, label, planned: 0, spent: 0, over: 0 };
    group.planned += Math.max(0, Number(row.budget) || 0);
    group.spent += row.paid ? Math.max(0, expenseActual(row)) : 0;
    groups.set(id, group);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, over: Math.max(0, group.spent - group.planned) }))
    .filter((group) => group.planned > 0 || group.spent > 0);
}

export function budgetProgress(rows: ExpenseRow[], cap: number): BudgetProgress {
  const planned = rows.reduce((sum, row) => sum + (Number(row.budget) || 0), 0);
  const spent = rows.reduce((sum, row) => sum + (row.paid ? expenseActual(row) : 0), 0);
  const paidCount = rows.filter((row) => row.paid).length;
  const total = rows.length;
  return {
    planned,
    spent,
    remaining: (Number(cap) || 0) - spent,
    spentPercent: cap > 0 ? Math.min(100, Math.max(0, (spent / cap) * 100)) : 0,
    paidCount,
    total,
  };
}

/* ----------------------------------------------------------------------------------------------------------------
 * The plan as it comes back after a refresh. Only the three things the artist owns are stored — the project, the
 * target and the rows they edited — because the allocation is worked out from the first two, and a stored copy of it
 * would be a second source of truth that could disagree with the ring.
 * --------------------------------------------------------------------------------------------------------------*/

export type StoredPlan = {
  kind: ProjectKind;
  target: number;
  rows: ExpenseRow[];
};

/** A sanity cap, so a corrupted value cannot open a plan of ten thousand lines. */
export const MAX_PLAN_ROWS = 60;

const isKind = (value: unknown): value is ProjectKind =>
  BUDGET_BLUEPRINTS.some((blueprint) => blueprint.id === value);

function expenseRowIn(raw: unknown): ExpenseRow | null {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const category = typeof o["category"] === "string" ? o["category"].slice(0, 60).trim() : "";
  if (!category) return null;
  const budget = Number(o["budget"]);
  return {
    id: typeof o["id"] === "string" && o["id"] ? o["id"].slice(0, 64) : newExpenseId(),
    category,
    item: typeof o["item"] === "string" ? o["item"].slice(0, 80) : "",
    budget: Number.isFinite(budget) && budget > 0 ? Math.round(budget * 100) / 100 : 0,
    actual: typeof o["actual"] === "string" ? o["actual"].slice(0, 24) : "",
    paid: o["paid"] === true,
    ...(o["custom"] === true ? { custom: true } : {}),
  };
}

/** A stored plan, cleaned; null when there is nothing usable to restore. */
export function planFromStore(raw: unknown): StoredPlan | null {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (!isKind(o["kind"])) return null;
  const rows: ExpenseRow[] = [];
  const seen = new Set<string>();
  for (const entry of Array.isArray(o["rows"]) ? o["rows"] : []) {
    if (rows.length >= MAX_PLAN_ROWS) break;
    const row = expenseRowIn(entry);
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    rows.push(row);
  }
  return {
    kind: o["kind"],
    target: Math.max(0, Math.round((Number(o["target"]) || 0) * 100) / 100),
    rows,
  };
}

/** Exactly what is written back: the edited rows, never the derived allocation. */
export function planStore(plan: StoredPlan): StoredPlan {
  return { kind: plan.kind, target: plan.target, rows: plan.rows };
}

/** The lines the member has ticked paid, at their actual cost — the ones a tax worksheet can pull across. */
export function paidPlanRows(raw: unknown): ExpenseRow[] {
  return (planFromStore(raw)?.rows ?? []).filter((row) => row.paid && expenseActual(row) > 0);
}
