import { PUBLISHED_AMOUNTS, amountProblem, usdText } from "@/lib/price-check";
import { soldPrices, type SoldPrice } from "@/lib/price-list";

/**
 * Admin's live-price check (founder, 2026-11-20): every lookup key the site sells, read back from the live Stripe
 * account and compared with the amount the site publishes. Checkout refuses a missing or mispriced key, but only when
 * a member has already clicked Buy; this reports the same facts up front, so a price that was never created in live
 * Stripe fails in Admin, loudly, instead of at the member's card.
 *
 * The published amounts are read from src/lib/price-check.ts, which reads the same constants the plan chart and the
 * price list quote, so nothing here is a second copy of a price.
 */

/** The fields of a Stripe price this check reads, so the audit is pure and testable. */
export type StripePriceLike = {
  lookup_key?: string | null | undefined;
  unit_amount?: number | null | undefined;
  currency?: string | null | undefined;
  active?: boolean | null | undefined;
  type?: string | null | undefined;
  recurring?: { interval?: string | null | undefined } | null | undefined;
};

export type AuditedPrice = {
  item: string;
  lookupKey: string;
  billing: SoldPrice["billing"];
  publishedCents: number | null;
  publishedText: string | null;
  stripeCents: number | null;
  stripeText: string | null;
  /** Every problem with this one key, joined for display; null when it charges the published price. */
  problem: string | null;
};

export type PriceAudit = {
  rows: AuditedPrice[];
  /** The loud list, one entry per problem found. Empty means every sold key is right in live Stripe. */
  problems: string[];
  ok: boolean;
};

/** "a recurring yearly price" reads as Stripe's own terms, so the fix is obvious in the dashboard. */
function describeType(price: StripePriceLike): string {
  if (price.type === "recurring")
    return price.recurring?.interval
      ? `a recurring ${price.recurring.interval}ly price`
      : "a recurring price";
  if (price.type === "one_time") return "a one-time price";
  return price.type ? `a ${price.type} price` : "a price with no type";
}

/**
 * Everything wrong with one sold key: absent, archived, priced in another currency, held as the wrong billing type, or
 * charging the wrong amount. A key the price list sells but nothing publishes an amount for is a problem too, because
 * the amount guard at checkout has nothing to compare it against.
 */
function problemsFor(
  sold: SoldPrice,
  expected: number | undefined,
  price: StripePriceLike | undefined,
): string[] {
  const label = `${sold.lookupKey} (${sold.item})`;
  if (expected === undefined)
    return [`The price list sells ${label}, but no published amount is defined for it.`];
  if (!price) {
    return [
      `Live Stripe has no price for ${label}, so Buy would fail at ${sold.lookupKey}. Create it at ${usdText(expected)}.`,
    ];
  }
  const out: string[] = [];
  if (price.active === false)
    out.push(`${label} is archived in live Stripe, so checkout can't use it.`);
  if ((price.currency ?? "").toLowerCase() !== "usd") {
    out.push(
      `${label} is priced in ${(price.currency ?? "no currency").toUpperCase()}, but the site charges USD.`,
    );
  }
  if (sold.billing === "recurring") {
    if (price.type !== "recurring" || price.recurring?.interval !== "year") {
      out.push(
        `${label} must be a yearly subscription in Stripe, but Stripe holds ${describeType(price)}.`,
      );
    }
  } else if (price.type !== "one_time") {
    out.push(
      `${label} must be a one-time price in Stripe, but Stripe holds ${describeType(price)}.`,
    );
  }
  const amount = amountProblem(sold.lookupKey, price.unit_amount ?? null);
  if (amount) out.push(amount);
  return out;
}

/** Compares what live Stripe returned with every price the site sells. Pure: the server hands it the Stripe rows. */
export function auditLivePrices(prices: StripePriceLike[]): PriceAudit {
  const byKey = new Map<string, StripePriceLike>();
  for (const price of prices) if (price.lookup_key) byKey.set(price.lookup_key, price);
  const rows: AuditedPrice[] = [];
  const problems: string[] = [];
  for (const sold of soldPrices()) {
    const expected = PUBLISHED_AMOUNTS[sold.lookupKey];
    const price = byKey.get(sold.lookupKey);
    const found = problemsFor(sold, expected, price);
    problems.push(...found);
    const stripeCents = typeof price?.unit_amount === "number" ? price.unit_amount : null;
    rows.push({
      item: sold.item,
      lookupKey: sold.lookupKey,
      billing: sold.billing,
      publishedCents: expected ?? null,
      publishedText: expected === undefined ? null : usdText(expected),
      stripeCents,
      stripeText: stripeCents === null ? null : usdText(stripeCents),
      problem: found.length ? found.join(" ") : null,
    });
  }
  return { rows, problems, ok: problems.length === 0 };
}
