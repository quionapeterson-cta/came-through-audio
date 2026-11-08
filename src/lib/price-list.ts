import { BRANDING_LOOKUP_KEY, BRANDING_PRICE } from "@/lib/brand-kit";
import { CONTRACT_LOOKUP_KEY, CONTRACT_PRICE } from "@/lib/contract-generator";
import { ARTIST_SEAT_PRICES, ASSISTANCE_PER_SONG_AGENCY, PLAN_TIERS, STATEMENT_DESCRIPTOR, STATEMENT_DESCRIPTOR_PREFIX, TIER_LABEL, assistanceFees } from "@/lib/plans";
import { PACKAGES } from "@/lib/proof";
import { VAULT_LOOKUP_KEY, VAULT_PRICE } from "@/lib/retention";

/**
 * The official price list staff quote from (Admin → Price List). Every number is read from the constant the site,
 * the plan charts and checkout already use, so quoting a customer and being charged the same thing cannot drift:
 * change a price in code and this page changes with it. Nothing here is typed twice.
 */

export type PriceRow = {
  item: string;
  /** What the customer pays, e.g. "$24.99/yr". */
  price: string;
  /** Plain-language qualifier: what the price covers. */
  detail?: string;
  /** The Stripe lookup key the server buys by; absent when nothing is sold yet. */
  lookupKey?: string;
};

export type PriceGroup = { title: string; note: string; rows: PriceRow[] };

/** The day this list was last reconciled with the founder's pricing. */
export const PRICE_LIST_EFFECTIVE = "November 4, 2026";

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
      ...(p.priceId && { lookupKey: p.priceId }),
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
    })),
  },
  {
    title: "One-time add-ons",
    note: "Bought alongside any plan. Each is a single charge, not a subscription, except Personal Branding, which covers twelve months.",
    rows: [
      {
        item: "Generated contract",
        price: CONTRACT_PRICE,
        detail: "One generated contract, any plan. Catalog Management can generate them from its blueprints without paying per contract.",
        lookupKey: CONTRACT_LOOKUP_KEY,
      },
      {
        item: "Personal Branding kit",
        price: BRANDING_PRICE,
        detail: "Per kit, per year: your logo, colors, business name and tagline on split sheets and contracts. Included with Catalog Management.",
        lookupKey: BRANDING_LOOKUP_KEY,
      },
      {
        item: "Pause (Vault fee)",
        price: `${usd(VAULT_PRICE)} per month paused`,
        detail: "Paid up front when an account pauses, up to 3 months. Keeps the catalog and Vault files in place while the plan is on hold.",
        lookupKey: VAULT_LOOKUP_KEY,
      },
    ],
  },
  {
    title: "Expert Assistance",
    note: "Our team registers songs for the customer. Sold by Came Through Audio, LLC directly, so it is not part of Stripe's managed payments.",
    rows: [
      { item: "Setup: single or EP", price: singleSetup, detail: "Up to 6 songs", lookupKey: "expert_setup_single" },
      { item: "Setup: album", price: albumSetup, detail: "Up to 20 songs", lookupKey: "expert_setup_album" },
      { item: "Each further block of album tracks", price: albumSetup, detail: "Every full block of 20 tracks beyond the first 20" },
      { item: "A short final block of album tracks", price: singleSetup, detail: "1–6 extra tracks (7–19 is charged as another full block)" },
      {
        item: "Registration, per song per agency",
        price: usd(ASSISTANCE_PER_SONG_AGENCY),
        detail: "Added for every song in the request, times the number of agencies chosen. ASCAP or BMI, never both.",
        lookupKey: "expert_per_song_agency",
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
    })),
  },
];
