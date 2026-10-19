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

/**
 * The plan a signed-out visitor picked, kept in this browser until they have an account (checkout needs their
 * user ID so the payment webhook can credit the right person). Survives the email-confirmation round trip.
 */
const PLAN_INTENT_KEY = "cta.planIntent";
export function rememberPlanIntent(priceId: string | undefined) {
  try { if (priceId) localStorage.setItem(PLAN_INTENT_KEY, priceId); else localStorage.removeItem(PLAN_INTENT_KEY); } catch { /* storage blocked */ }
}
export function takePlanIntent(): string | null {
  try {
    const v = localStorage.getItem(PLAN_INTENT_KEY);
    localStorage.removeItem(PLAN_INTENT_KEY);
    return v && PRICE_TIER[v] ? v : null;
  } catch { return null; }
}

/** A subscription row grants access while active/trialing/past_due, or canceled until period end. */
export function isActiveSub(s: { status: string; current_period_end: string | null }, now = new Date()) {
  const future = !s.current_period_end || new Date(s.current_period_end) > now;
  if (["active", "trialing", "past_due"].includes(s.status)) return future;
  if (s.status === "canceled") return !!s.current_period_end && new Date(s.current_period_end) > now;
  return false;
}

export type PlanTier = { tier: Tier; price: string; monthly: string; priceId?: string };

/** Pricing columns, cheapest first. Free has no price ID (signup only). */
export const PLAN_TIERS: PlanTier[] = [
  { tier: "free", price: "$0", monthly: "Free forever" },
  { tier: "plus", price: "$24.99", priceId: "catalog_plus_yearly", monthly: "Only $2.08 / month" },
  { tier: "collaborate", price: "$44.99", priceId: "catalog_collaborate_yearly", monthly: "Only $3.75 / month" },
  { tier: "management", price: "$89.99", priceId: "catalog_management_yearly", monthly: "Only $7.50 / month" },
];

export type Feature = { title: string; tip: string; group: string; from: Tier; soon?: boolean };

/**
 * Every benefit in one list. A plan includes a feature when hasTier(plan, feature.from), the same rule that gates
 * access in the app. Everything is unlimited, so titles leave the word out; the chart says it once in a banner.
 */
export const PLAN_FEATURES: Feature[] = [
  { group: "Royalty health", from: "free", title: "Royalty Health Checks", tip: "See if your songs show up in the major public repertoires (PRO, SoundExchange, mechanicals) and what's missing" },
  { group: "Royalty health", from: "free", title: "Sign Split Sheets You're Invited To", tip: "Sign split sheets collaborators send you, free. Creating your own starts with Catalog and Collaborate." },
  { group: "Catalog & metadata", from: "plus", title: "Metadata Embedding", tip: "Embed complete track details, credits, lyrics, artwork and identifiers directly into your audio files" },
  { group: "Catalog & metadata", from: "plus", title: "Asset Cataloging", tip: "One organized home for every song's credits, identifiers, artwork and lyrics" },
  { group: "Catalog & metadata", from: "plus", title: "Master MP3 Retrieval", tip: "Download your embedded master MP3 from My Catalog anytime, no re-embedding needed" },
  { group: "Catalog & metadata", from: "plus", title: "Album Art Uploads & Retrieval", tip: "Upload cover art with each song and download it again whenever you need it" },
  { group: "Catalog & metadata", from: "plus", title: "PDF Catalog Downloads", tip: "Download your whole catalog as a branded PDF: titles, artists, identifiers and credits" },
  { group: "Catalog & metadata", from: "plus", title: "PDF Lyric Downloads", tip: "Download any song's lyrics with its credits as a branded PDF" },
  { group: "Catalog & metadata", from: "plus", title: "Split Sheet Generator", tip: "Generate split sheets from your catalog songs, sign as the owner and download the PDF. Collecting collaborators' e-signatures starts with Catalog and Collaborate." },
  { group: "Collaboration & registration", from: "collaborate", title: "Collaborator E-Signature Requests", tip: "Email collaborators a secure link to e-sign your split sheets, with instant free account invitations" },
  { group: "Collaboration & registration", from: "collaborate", title: "1-Click Agency Exports", tip: "Download registration-ready files for The MLC, SoundExchange and ASCAP/BMI from your catalog" },
  { group: "Collaboration & registration", from: "collaborate", title: "Royalty Utility Suite", tip: "BMI/ASCAP Formula Converter & Projected Royalty Earnings Calculator" },
  { group: "Business & education", from: "management", title: "Custom Music Industry Contracts", tip: "Fill in a contract from a blueprint, adjust the terms, and keep it with your catalog" },
  { group: "Business & education", from: "management", title: "Music Industry Blueprints", tip: "Producer agreements, beat licenses, feature, session, videographer and label blueprints, with plain-language guides" },
  { group: "Business & education", from: "management", title: "Contract Signature Requests & Signing", tip: "Send contracts to every party to e-sign; each signature is time-stamped and hashed" },
  { group: "Business & education", from: "management", title: "Signed Contract Vault", tip: "Fully signed contracts are locked and stored, ready to download as a signed PDF" },
  { group: "Business & education", from: "management", title: "Industry Masterclasses", tip: "In-depth masterclasses covering sync, publishing and royalties", soon: true },
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
