import { BRANDING_LOOKUP_KEY, BRANDING_PRICE } from "@/lib/brand-kit";
import { CONTRACT_LOOKUP_KEY, CONTRACT_PRICE } from "@/lib/contract-generator";
import {
  ARTIST_SEAT_PRICES,
  ASSISTANCE_PER_SONG_AGENCY,
  PLAN_TIERS,
  assistanceFees,
} from "@/lib/plans";
import { PACKAGES } from "@/lib/proof";
import { VAULT_LOOKUP_KEY, VAULT_PRICE } from "@/lib/retention";

/**
 * A Stripe price that doesn't charge what the site says is a billing error, not a preference: the member reads $3.99
 * and the card is charged $14.99. Every amount below is read from the same constant the plan chart, the price list and
 * the copy quote, so a mismatch is caught before Stripe is ever asked to charge it (founder, 2026-11-19).
 */

/** "$3.99" and 3.99 both become 399. */
const cents = (value: string | number) =>
  Math.round(Number(String(value).replace(/[^0-9.]/g, "")) * 100);
/** 1399 → "$13.99". */
export const usdText = (value: number) => `$${(value / 100).toFixed(2)}`;

/** Lookup key → the amount the site publishes, in cents. Nothing is typed twice; this reads the live constants. */
export const PUBLISHED_AMOUNTS: Record<string, number> = (() => {
  const amounts: Record<string, number> = {};
  for (const plan of PLAN_TIERS) if (plan.priceId) amounts[plan.priceId] = cents(plan.price);
  for (const seat of ARTIST_SEAT_PRICES) amounts[seat.lookupKey] = cents(seat.amount);
  for (const pack of PACKAGES)
    amounts[`ai_protection_${pack.id.toLowerCase()}`] = cents(pack.price);
  amounts[BRANDING_LOOKUP_KEY] = cents(BRANDING_PRICE);
  amounts[CONTRACT_LOOKUP_KEY] = cents(CONTRACT_PRICE);
  amounts[VAULT_LOOKUP_KEY] = cents(VAULT_PRICE);
  // Expert Registration setup fees are the same numbers the price list shows.
  amounts["expert_setup_single"] = cents(assistanceFees("single", 1).base);
  amounts["expert_setup_album"] = cents(assistanceFees("album", 20).base);
  amounts["expert_per_song_agency"] = cents(ASSISTANCE_PER_SONG_AGENCY);
  return amounts;
})();

/**
 * What is wrong with this Stripe price, naming the lookup key and both amounts, or null when it charges the published
 * price. An unknown key (nothing published for it) is not this guard's business.
 */
export function amountProblem(
  lookupKey: string,
  stripeAmount: number | null | undefined,
): string | null {
  const expected = PUBLISHED_AMOUNTS[lookupKey];
  if (expected === undefined) return null;
  if (typeof stripeAmount !== "number" || !Number.isFinite(stripeAmount)) {
    return `Stripe's price for ${lookupKey} has no amount, but the published price is ${usdText(expected)}.`;
  }
  if (stripeAmount === expected) return null;
  return `Stripe's price for ${lookupKey} is ${usdText(stripeAmount)}, but the published price is ${usdText(expected)}.`;
}

/** The suffix every refusal carries, so checkout can pass it through instead of wrapping it in a generic failure. */
export const PRICE_MISMATCH_NOTE =
  "Nothing was charged. Fix that price in Stripe, or contact support and we'll help right away.";
