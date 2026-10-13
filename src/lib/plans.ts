export type Tier = "free" | "plus" | "collaborate" | "management";

export const TIER_RANK: Record<Tier, number> = { free: 0, plus: 1, collaborate: 2, management: 3 };

export const PRICE_TIER: Record<string, Tier> = {
  catalog_plus_yearly: "plus",
  catalog_collaborate_yearly: "collaborate",
  catalog_management_yearly: "management",
};

export const TIER_LABEL: Record<Tier, string> = {
  free: "Free",
  plus: "Catalog Plus",
  collaborate: "Catalog and Collaborate",
  management: "Catalog Management",
};

export function tierFromPrice(priceId: string | null | undefined): Tier {
  return (priceId && PRICE_TIER[priceId]) || "free";
}

export function hasTier(current: Tier, needed: Tier) {
  return TIER_RANK[current] >= TIER_RANK[needed];
}

/** A subscription row grants access while active/trialing/past_due, or canceled until period end. */
export function isActiveSub(s: { status: string; current_period_end: string | null }, now = new Date()) {
  const future = !s.current_period_end || new Date(s.current_period_end) > now;
  if (["active", "trialing", "past_due"].includes(s.status)) return future;
  if (s.status === "canceled") return !!s.current_period_end && new Date(s.current_period_end) > now;
  return false;
}

/** Free tier card: no price ID — signup only. */
export const FREE_CARD = {
  tier: "free" as const,
  price: "$0",
  monthly: "Free forever",
  lead: "Start with the essentials:",
  features: [
    { title: "Unlimited Royalty Health Audits", tip: "Continuous checks across PRO, SoundExchange, and mechanical eligibility" },
    { title: "Unlimited Split Sheet Signatures", tip: "Sign split sheets you're invited to by collaborators. Creating split sheets requires Catalog and Collaborate." },
    { title: "Free Royalty Health Check", tip: "A guided audit of your royalty setup when you join" },
  ] as Feature[],
};

export type Feature = { title: string; tip: string };
export const PLAN_CARDS: { tier: Exclude<Tier, "free">; price: string; priceId: string; monthly: string; lead?: string; features: Feature[] }[] = [
  {
    tier: "plus", price: "$24.99", priceId: "catalog_plus_yearly", monthly: "Only $2.08 / month",
    features: [
      { title: "Unlimited Core Metadata Embedding", tip: "Embed complete track details and identifiers directly into your audio files" },
      { title: "Unlimited Asset Cataloging & Storage", tip: "Permanent cloud vault for your final masters, high-res artwork, and lyrics" },
      { title: "Unlimited Royalty Health Audits", tip: "Continuous checks across PRO, SoundExchange, and mechanical eligibility" },
    ],
  },
  {
    tier: "collaborate", price: "$44.99", priceId: "catalog_collaborate_yearly", monthly: "Only $3.75 / month", lead: "Includes everything in Catalog Plus, plus:",
    features: [
      { title: "Unlimited Collaborative Split Sheets", tip: "Create, negotiate, and lock in audit-ready publishing splits" },
      { title: "Unlimited Collaborator E-Signatures", tip: "Digital legal sign-off and instant collaborator account invitations" },
      { title: "Unlimited Royalty Utility Suite", tip: "Access the BMI/ASCAP Formula Converter & Projected Royalty Earnings Calculator" },
    ],
  },
  {
    tier: "management", price: "$89.99", priceId: "catalog_management_yearly", monthly: "Only $7.50 / month", lead: "Includes everything in Catalog and Collaborate, plus:",
    features: [
      { title: "Unlimited Contract Blueprints", tip: "Production agreements, beat licenses, videographer releases, and label blueprints" },
      { title: "Unlimited Industry Masterclasses", tip: "In-depth executive video masterclasses covering sync, publishing, and royalties" },
    ],
  },
];

/**
 * Expert assistance setup fees. Base Fee: $14.99 for Singles/EPs (max 6) or $29.99 for albums (up to 20).
 * Extended Repertoire Fee: beyond 20 album tracks the cycle repeats per block of 20 —
 * each full block of 20 adds $29.99; a final partial block of 1–6 adds $14.99, 7–19 adds $29.99.
 * Plus $4.99 per song per agency.
 */
export function assistanceFees(type: "single" | "album", songs: number) {
  const n = type === "single" ? Math.min(songs, 6) : songs;
  if (n <= 0) return { n: 0, base: 0, smallBlocks: 0, largeBlocks: 0, extended: 0 };
  if (type === "single") return { n, base: 14.99, smallBlocks: 0, largeBlocks: 0, extended: 0 };
  const rest = Math.max(0, n - 20);
  const rem = rest % 20;
  const largeBlocks = Math.floor(rest / 20) + (rem > 6 ? 1 : 0);
  const smallBlocks = rem > 0 && rem <= 6 ? 1 : 0;
  return { n, base: 29.99, smallBlocks, largeBlocks, extended: Math.round((largeBlocks * 29.99 + smallBlocks * 14.99) * 100) / 100 };
}

export function assistanceTotal(type: "single" | "album", songs: number, agencies: number) {
  if (songs <= 0 || agencies <= 0) return 0;
  const f = assistanceFees(type, songs);
  return Math.round((f.base + f.extended + 4.99 * f.n * agencies) * 100) / 100;
}

export function assistanceItems(type: "single" | "album", songs: number, agencies: number) {
  const f = assistanceFees(type, songs);
  const items = [type === "single" ? { priceId: "expert_setup_single", quantity: 1 } : { priceId: "expert_setup_album", quantity: 1 + f.largeBlocks }];
  // Extended Repertoire Fee small blocks reuse the $14.99 setup price.
  if (f.smallBlocks) items.push({ priceId: "expert_setup_single", quantity: f.smallBlocks });
  items.push({ priceId: "expert_per_song_agency", quantity: f.n * agencies });
  return items;
}

/** BMI reports writer+publisher shares on a 200% scale; ASCAP, SoundExchange and the MLC use 100%. */
export function convertShare(value: number, from: "100" | "200", to: "100" | "200") {
  if (from === to) return value;
  return from === "100" ? value * 2 : value / 2;
}

/** Rough per-stream / per-play forecast. Rates are editable estimates, not guarantees. */
export function projectEarnings(i: { streams: number; perStream: number; radioSpins: number; perSpin: number; mechanicalUnits: number; perMechanical: number; share: number }) {
  const s = i.share / 100;
  const streaming = i.streams * i.perStream * s;
  const performance = i.radioSpins * i.perSpin * s;
  const mechanical = i.mechanicalUnits * i.perMechanical * s;
  return { streaming, performance, mechanical, total: streaming + performance + mechanical };
}
