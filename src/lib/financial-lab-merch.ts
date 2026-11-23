/**
 * The Merch & Sales Profit Calculator's math. Costs are the artist's own invoice numbers; the presets only carry a
 * starting estimate that every field lets them replace. Nothing is stored, so a simulation never becomes a promise.
 */
export type ProductKind = "smart-album" | "tshirt" | "hoodie" | "hat" | "vinyl" | "cd" | "custom";

export type ProductPreset = {
  id: ProductKind;
  name: string;
  hint: string;
  /** Starting estimates only: replace them with the invoice and the retail price. */
  quantity: number;
  unitCost: number;
  price: number;
};

export const PRODUCT_PRESETS: ProductPreset[] = [
  {
    id: "smart-album",
    name: "Smart Album / NFC Card",
    hint: "Tap-to-stream physical cards",
    quantity: 50,
    unitCost: 6.5,
    price: 25,
  },
  { id: "tshirt", name: "T-Shirt", hint: "Printed tee", quantity: 50, unitCost: 9, price: 30 },
  {
    id: "hoodie",
    name: "Hoodie / Pullover",
    hint: "Embroidered or printed",
    quantity: 40,
    unitCost: 22,
    price: 60,
  },
  { id: "hat", name: "Hat / Beanie", hint: "One size", quantity: 50, unitCost: 12, price: 30 },
  {
    id: "vinyl",
    name: 'Vinyl Record (12")',
    hint: "Standard black",
    quantity: 100,
    unitCost: 12,
    price: 35,
  },
  {
    id: "cd",
    name: "CD (Digipak / Jewel Case)",
    hint: "Pressed disc",
    quantity: 100,
    unitCost: 5,
    price: 15,
  },
  {
    id: "custom",
    name: "Custom Item",
    hint: "Posters, stickers, VIP packages",
    quantity: 25,
    unitCost: 0,
    price: 0,
  },
];

export const presetOf = (id: ProductKind): ProductPreset =>
  PRODUCT_PRESETS.find((p) => p.id === id) ?? PRODUCT_PRESETS[PRODUCT_PRESETS.length - 1]!;

export type SalesState = "below" | "even" | "profit";

export type MerchInput = {
  quantity: number;
  unitCost: number;
  price: number;
  unitsSold: number;
};

export type MerchMath = {
  quantity: number;
  unitsSold: number;
  upfront: number;
  gross: number;
  profit: number;
  /** Profit as a share of the upfront bill; null when nothing was spent. */
  roi: number | null;
  /** Units that return the whole upfront cost; null when the price is not set. */
  breakevenUnits: number | null;
  breakevenPercent: number | null;
  /** Units still to sell before costs are recovered; 0 once the safe zone is reached. */
  unitsToBreakeven: number;
  percent: number;
  state: SalesState;
  atBreakeven: boolean;
  soldOut: boolean;
};

const finite = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

/** Whole units only, and never more than the run that was made. */
export const clampUnits = (units: number, quantity: number) =>
  Math.max(
    0,
    Math.min(Math.round(finite(quantity)), Math.round(Number.isFinite(units) ? units : 0)),
  );

export function merchMath(input: MerchInput): MerchMath {
  const quantity = Math.round(finite(input.quantity));
  const unitCost = finite(input.unitCost);
  const price = finite(input.price);
  const unitsSold = clampUnits(input.unitsSold, quantity);
  const upfront = quantity * unitCost;
  const gross = unitsSold * price;
  const profit = gross - upfront;
  // Round up: a fractional unit cannot recover the bill, so the safe zone is the first whole unit that does.
  const breakevenUnits =
    price > 0 && upfront > 0 ? Math.ceil(upfront / price) : price > 0 ? 0 : null;
  const breakevenPercent =
    breakevenUnits === null ? null : quantity > 0 ? (breakevenUnits / quantity) * 100 : null;
  const state: SalesState =
    breakevenUnits === null
      ? profit > 0
        ? "profit"
        : "even"
      : unitsSold < breakevenUnits
        ? "below"
        : unitsSold === breakevenUnits
          ? "even"
          : "profit";
  return {
    quantity,
    unitsSold,
    upfront,
    gross,
    profit,
    roi: upfront > 0 ? (profit / upfront) * 100 : null,
    breakevenUnits,
    breakevenPercent,
    unitsToBreakeven: breakevenUnits === null ? 0 : Math.max(0, breakevenUnits - unitsSold),
    percent: quantity > 0 ? (unitsSold / quantity) * 100 : 0,
    state,
    atBreakeven: breakevenUnits !== null && unitsSold === breakevenUnits && breakevenUnits > 0,
    soldOut: quantity > 0 && unitsSold >= quantity,
  };
}

/**
 * The one box takes either an exact count ("35", "35 shirts") or a percentage of the run ("35%"). Returns null when the
 * text holds no number, so the slider keeps its last position instead of snapping to zero mid-typing.
 */
export function parseSalesEntry(text: string, quantity: number): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const match = /(-?\d+(?:\.\d+)?)\s*(%|percent)?/i.exec(trimmed);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  if (match[2]) return clampUnits((finite(quantity) * value) / 100, quantity);
  return clampUnits(value, quantity);
}
