import { BRANDING_LOOKUP_KEY, BRANDING_PRICE } from "@/lib/brand-kit";
import { CONTRACT_LOOKUP_KEY, CONTRACT_PRICE } from "@/lib/contract-generator";
import {
  ARTIST_SEAT_PRICES,
  ASSISTANCE_PER_SONG_AGENCY,
  PLAN_TIERS,
  STATEMENT_DESCRIPTOR,
  STATEMENT_DESCRIPTOR_PREFIX,
  TIER_LABEL,
  assistanceFees,
} from "@/lib/plans";
import { PACKAGES } from "@/lib/proof";
import { VAULT_LOOKUP_KEY, VAULT_PRICE } from "@/lib/retention";

/**
 * The official price list staff quote from (Admin → Price List). Every number is read from the constant the site,
 * the plan charts and checkout already use, so quoting a customer and being charged the same thing cannot drift:
 * change a price in code and this page changes with it. Nothing here is typed twice.
 */

/**
 * How Stripe must hold the price: a yearly subscription, a monthly one, or a single charge. The Vault fee is monthly
 * (founder, 2026-11-20): $1.99 billed once per month for as long as the pause runs, cancelled on Resume
 * (open-ended since 2026-11-21).
 */
export type BillingType = "recurring-yearly" | "recurring-monthly" | "one-time";

const BILLING_TEXT: Record<BillingType, string> = {
  "recurring-yearly": "yearly subscription",
  "recurring-monthly": "monthly subscription",
  "one-time": "one-time",
};

export type PriceRow = {
  item: string;
  /** What the customer pays, e.g. "$24.99/yr". */
  price: string;
  /** Plain-language qualifier: what the price covers. */
  detail?: string;
  /** The Stripe lookup key the server buys by; absent when nothing is sold yet. */
  lookupKey?: string;
  /** Present only for a row that is a Stripe price: the type it must be created with. */
  billing?: BillingType;
};

export type PriceGroup = { title: string; note: string; rows: PriceRow[] };

/** The day this list was last reconciled with the founder's pricing. */
export const PRICE_LIST_EFFECTIVE = "November 20, 2026";

/**
 * What a charge reads as on a card statement (founder, 2026-11-05). The full name fits Stripe's 22 characters; the card
 * prefix exists because Stripe keeps only 10 characters for cards and would otherwise print "CAME THROU".
 */
export const CARD_STATEMENT = { full: STATEMENT_DESCRIPTOR, prefix: STATEMENT_DESCRIPTOR_PREFIX };

const usd = (n: number) => `$${n.toFixed(2)}`;
const singleSetup = usd(assistanceFees("single", 1).base);
const albumSetup = usd(assistanceFees("album", 20).base);

export const PRICE_LIST: PriceGroup[] = [
  {
    title: "Plans",
    note: "Yearly, billed once a year. Every plan is unlimited: no per-song fees, no metered storage. Upgrades are prorated for the rest of the year; a new plan has a 30-day full refund window.",
    rows: PLAN_TIERS.map((p) => ({
      item: TIER_LABEL[p.tier],
      price: p.priceId ? `${p.price}/yr` : p.price,
      detail: p.priceId ? `${p.monthly} · billed annually` : "Sign-up only, no card",
      ...(p.priceId && { lookupKey: p.priceId, billing: "recurring-yearly" as const }),
    })),
  },
  {
    title: "Add-on artist seats",
    note: "Per added artist, per year, paid by the owner as its own yearly subscription. An added artist gets their own login and their own catalog at the seat's tier; the owner switches between artists. The owner buys the seat, names the artist and sends it to their email; the artist signs up with that address and accepts it, the same way an invited signature works. Their own catalog then runs at the seat tier, and the owner sees and manages every artist they pay for, including their split sheets and contracts. The owner can read a contract but never send one: only the artist sends under their own name.",
    rows: ARTIST_SEAT_PRICES.map((s) => ({
      item: `${TIER_LABEL[s.tier]} seat`,
      price: `${s.price}/yr`,
      detail: `${s.monthly} · per added artist`,
      lookupKey: s.lookupKey,
      billing: "recurring-yearly" as const,
    })),
  },
  {
    title: "Add-ons",
    note: "Bought alongside any plan. Personal Branding is its own yearly subscription and the Vault fee its own monthly one; the generated contract is a single charge.",
    rows: [
      {
        item: "Generated contract",
        price: CONTRACT_PRICE,
        detail:
          "One generated contract, any plan. Catalog Management can generate them from its blueprints without paying per contract.",
        lookupKey: CONTRACT_LOOKUP_KEY,
        billing: "one-time",
      },
      {
        item: "Personal Branding kit",
        price: BRANDING_PRICE,
        detail:
          "Per kit, per year: your logo, colors, business name and tagline on split sheets and contracts. Included with Catalog Management. Its own yearly subscription, renewing until cancelled.",
        lookupKey: BRANDING_LOOKUP_KEY,
        billing: "recurring-yearly",
      },
      {
        item: "Pause (Vault fee)",
        price: `${usd(VAULT_PRICE)} / month`,
        detail:
          "While a plan is paused, for as long as the member needs: its own monthly subscription, billed once a month and stopped on Resume or when the card cannot be charged. Keeps the catalog and Vault files in place, with downloads available and the paid tools waiting.",
        lookupKey: VAULT_LOOKUP_KEY,
        billing: "recurring-monthly",
      },
    ],
  },
  {
    title: "Expert Assistance",
    note: "Our team registers songs for the customer. Sold by Came Through Audio, LLC directly, so it is not part of Stripe's managed payments.",
    rows: [
      {
        item: "Setup: single or EP",
        price: singleSetup,
        detail: "Up to 6 songs",
        lookupKey: "expert_setup_single",
        billing: "one-time",
      },
      {
        item: "Setup: album",
        price: albumSetup,
        detail: "Up to 20 songs",
        lookupKey: "expert_setup_album",
        billing: "one-time",
      },
      {
        item: "Each further block of album tracks",
        price: albumSetup,
        detail: "Every full block of 20 tracks beyond the first 20",
      },
      {
        item: "A short final block of album tracks",
        price: singleSetup,
        detail: "1–6 extra tracks (7–19 is charged as another full block)",
      },
      {
        item: "Registration, per song per agency",
        price: usd(ASSISTANCE_PER_SONG_AGENCY),
        detail:
          "Added for every song in the request, times the number of agencies chosen. ASCAP or BMI, never both.",
        lookupKey: "expert_per_song_agency",
        billing: "one-time",
      },
    ],
  },
  {
    title: "AI Protection packages",
    note: "One-time, per release. Each certificate is issued against the songs bought; Album and Album+ cover a whole release at one price.",
    rows: PACKAGES.map((p) => ({
      item: `AI Protection: ${p.id}`,
      price: p.id === "Single" ? `${usd(p.price)} per song` : usd(p.price),
      detail: p.id === "Single" ? "Up to 3 songs, priced one at a time" : `Up to ${p.songs} songs`,
      lookupKey: `ai_protection_${p.id.toLowerCase()}`,
      billing: "one-time" as const,
    })),
  },
];

export type SoldPrice = {
  item: string;
  price: string;
  detail?: string;
  lookupKey: string;
  billing: BillingType;
};

/** Every row that is actually a Stripe price, in the order the page lists it. */
export function soldPrices(): SoldPrice[] {
  return PRICE_LIST.flatMap((group) =>
    group.rows.flatMap((row) =>
      row.lookupKey && row.billing
        ? [
            {
              item: row.item,
              price: row.price,
              lookupKey: row.lookupKey,
              billing: row.billing,
              ...(row.detail ? { detail: row.detail } : {}),
            },
          ]
        : [],
    ),
  );
}

/**
 * The lookup keys as plain text, for copying beside the billing dashboard (founder, 2026-11-19; super admins only):
 * one product per line with the exact key, the amount the site quotes and whether Stripe must hold it as a yearly
 * subscription or a single charge — a price created with the wrong type or amount is refused at checkout. Built from
 * the same rows this page shows, so it can never quote a price the site doesn't.
 */
export function stripeLookupKeyText(): string {
  const rows = soldPrices();
  const keyWidth = Math.max(...rows.map((r) => r.lookupKey.length));
  const priceWidth = Math.max(...rows.map((r) => r.price.length));
  return [
    `Came Through Audio · Stripe lookup keys · effective ${PRICE_LIST_EFFECTIVE} · USD`,
    "Create each price on its own product and set the lookup key exactly as written.",
    "yearly subscription = a recurring price billed once a year; monthly subscription = a recurring price billed once a month; one-time = a single charge.",
    "",
    ...rows.map(
      (r) =>
        `${r.lookupKey.padEnd(keyWidth)}  ${r.price.padEnd(priceWidth)}  ${BILLING_TEXT[r.billing]}  ${r.item}`,
    ),
  ].join("\n");
}
