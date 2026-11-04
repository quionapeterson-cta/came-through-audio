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
  collaborate: "Catalog & Collaborate",
  management: "Catalog Management",
};

export function tierFromPrice(priceId: string | null | undefined): Tier {
  return (priceId && PRICE_TIER[priceId]) || "free";
}

/** The best tier in the list. An accepted artist seat lifts its artist, and never lowers a plan they already pay for. */
export function highestTier(...tiers: Tier[]): Tier {
  return tiers.reduce<Tier>((best, t) => (TIER_RANK[t] > TIER_RANK[best] ? t : best), "free");
}

/** Most seats one purchase can add at once (founder, 2026-11-04: owners add several artists in one go). */
export const SEAT_MAX = 10;

export function hasTier(current: Tier, needed: Tier) {
  return TIER_RANK[current] >= TIER_RANK[needed];
}

/**
 * Paid access needs a confirmed email (founder, 2026-11-03). The server refuses to open a checkout until Supabase has
 * confirmed the address, and the client uses this same wording to show the confirm step before Stripe opens, so the
 * payment form itself is never interrupted by verification.
 */
export const EMAIL_CONFIRM_REQUIRED = "Confirm your email before checking out.";
export function isEmailConfirmError(e: unknown): boolean {
  return e instanceof Error && e.message.includes(EMAIL_CONFIRM_REQUIRED);
}

/**
 * The plan a signed-out visitor picked, kept in this browser until they have an account (checkout needs their
 * user ID so the payment webhook can credit the right person). Survives the email-confirmation round trip.
 */
const PLAN_INTENT_KEY = "cta.planIntent";
export function rememberPlanIntent(priceId: string | undefined) {
  try { if (priceId) localStorage.setItem(PLAN_INTENT_KEY, priceId); else localStorage.removeItem(PLAN_INTENT_KEY); } catch { /* storage blocked */ }
  // The sign-up form on the same page shows which plan they're signing up for.
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PLAN_INTENT_KEY));
}
/** The plan picked before signing up, without clearing it (the sign-up form shows it). */
export function peekPlanIntent(): string | null {
  try { const v = localStorage.getItem(PLAN_INTENT_KEY); return v && PRICE_TIER[v] ? v : null; } catch { return null; }
}
export const PLAN_INTENT_EVENT = PLAN_INTENT_KEY;
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

/** A yearly price read as a monthly one, in the same "about" wording the plan cards use. */
const perMonth = (yearly: number) => `About $${(yearly / 12).toFixed(2)} / month`;

/**
 * Add-on artist seats, per added artist per year (PLAN-pricing-badges.md §E). Prices set 2026-11-04:
 * $18.99 Catalog Plus, $34.99 Catalog & Collaborate, $69.99 Catalog Management. Still not on sale yet, so nothing
 * here has a Stripe price or lookup key behind it.
 */
export const ARTIST_SEAT_PRICES: { tier: Exclude<Tier, "free">; amount: number; price: string; monthly: string; lookupKey: string }[] = [
  { tier: "plus", amount: 18.99, price: "$18.99", monthly: perMonth(18.99), lookupKey: "artist_seat_plus_yearly" },
  { tier: "collaborate", amount: 34.99, price: "$34.99", monthly: perMonth(34.99), lookupKey: "artist_seat_collaborate_yearly" },
  { tier: "management", amount: 69.99, price: "$69.99", monthly: perMonth(69.99), lookupKey: "artist_seat_management_yearly" },
];

/** Seat lookup key → the tier that seat carries. Seats are not plans, so they never grant the owner a tier. */
export const SEAT_TIER = Object.fromEntries(ARTIST_SEAT_PRICES.map((s) => [s.lookupKey, s.tier])) as Record<string, Exclude<Tier, "free">>;
export const seatLookupKey = (tier: Exclude<Tier, "free">) => ARTIST_SEAT_PRICES.find((s) => s.tier === tier)!.lookupKey;

/** Days left in the 30-day full refund window after a plan order (Refund Policy), or 0 once it has passed. */
export function refundDaysLeft(orderedAt: string | null | undefined, now = new Date()): number {
  const t = orderedAt ? Date.parse(orderedAt) : NaN;
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.ceil((t + 30 * 86400000 - now.getTime()) / 86400000));
}
/** The upgrade note in Profile and the plan pop-ups: upgrades are prorated all year (founder, 2026-10-25). */
export function upgradeNote(orderedAt: string | null | undefined, now = new Date()): string {
  const left = refundDaysLeft(orderedAt, now);
  return `Upgrading? You pay only the prorated difference for the rest of your year.${left ? ` Your 30-day full refund window has ${left} day${left === 1 ? "" : "s"} left.` : ""}`;
}

/** Pricing columns, cheapest first. Free has no price ID (signup only). */
export const PLAN_TIERS: PlanTier[] = [
  { tier: "free", price: "$0", monthly: "Free forever" },
  { tier: "plus", price: "$24.99", priceId: "catalog_plus_yearly", monthly: "Only $2.08 / month" },
  { tier: "collaborate", price: "$44.99", priceId: "catalog_collaborate_yearly", monthly: "Only $3.75 / month" },
  { tier: "management", price: "$89.99", priceId: "catalog_management_yearly", monthly: "Only $7.50 / month" },
];

export type Feature = {
  title: string; tip: string; group: string; from: Tier; soon?: boolean;
  /** A few words a scanning reader catches without opening the tip, e.g. "Registers in minutes". */
  badge?: string;
  /** Paperwork and signing, so the plan chart shows the contracts-delivery eagle. */
  paperwork?: boolean;
  /** The eye on the prize marks this row wherever it is included, not only on Catalog Management (founder, 2026-11-04). */
  prize?: boolean;
  /** Two eagles, both full size and one layered in front of the other: a spotlit paperwork row (founder, 2026-11-05). */
  eaglePair?: boolean;
};

/**
 * Every benefit in one list. A plan includes a feature when hasTier(plan, feature.from), the same rule that gates
 * access in the app. Everything is unlimited, so titles leave the word out; the chart says it once in a banner.
 */
export const PLAN_FEATURES: Feature[] = [
  { group: "Royalty health", from: "free", title: "Royalty Health Checks", tip: "See if your songs show up in the major public repertoires (PRO, SoundExchange, mechanicals) and what's missing" },
  { group: "Royalty health", from: "free", title: "Sign Split Sheets You're Invited To", tip: "Sign split sheets collaborators send you, free. Creating your own starts with Catalog Plus." },
  { group: "Catalog & metadata", from: "plus", title: "MP3 Embedding", tip: "Embed your credits, identifiers, lyrics and artwork into the MP3 file itself, so the song carries its own details wherever it is sent, streamed, uploaded or downloaded. However your music travels, it still says who made it and which song it is." },
  { group: "Catalog & metadata", from: "plus", title: "Asset Cataloging", tip: "One organized home for every song's credits, identifiers, artwork and lyrics" },
  { group: "Catalog & metadata", from: "plus", title: "Master MP3 Retrieval", tip: "Download your embedded master MP3 from My Catalog anytime, no re-embedding needed" },
  { group: "Catalog & metadata", from: "plus", title: "Album Art Uploads & Retrieval", tip: "Upload cover art with each song and download it again whenever you need it" },
  { group: "Catalog & metadata", from: "plus", title: "PDF Catalog Downloads", tip: "Download your whole catalog as a branded PDF: titles, artists, identifiers and credits" },
  { group: "Catalog & metadata", from: "plus", title: "PDF Lyric Downloads", tip: "Download any song's lyrics with its credits as a branded PDF" },
  { group: "Catalog & metadata", from: "plus", title: "Split Sheet Generator", tip: "Generate split sheets from your catalog songs, sign as the owner and download the PDF. Collecting collaborators' e-signatures starts with Catalog & Collaborate.", paperwork: true },
  { group: "Collaboration & registration", from: "collaborate", title: "Split Sheet E-Signature Request", tip: "Email collaborators a secure link to e-sign your split sheets, with instant free account invitations. Download signed split sheets.", paperwork: true },
  { group: "Collaboration & registration", from: "collaborate", title: "1-Click Agency Exports", badge: "Registers in minutes", tip: "Export your whole catalog, a release or chosen songs into each agency's own template (The MLC, SoundExchange, ASCAP/BMI) and register in minutes. Save hours of retyping. Includes a Neighbouring Rights Pack listing every performer for international airplay.", paperwork: true },
  { group: "Collaboration & registration", from: "collaborate", title: "Royalty Utility Suite", tip: "Pick a song and the converters turn your catalog splits into the exact numbers ASCAP, BMI and SESAC ask for (each counts shares differently), plus a projected earnings calculator by platform and country.", prize: true },
  { group: "Catalog & metadata", from: "management", title: "WAV Embedding", tip: "Embed the same credits, identifiers, lyrics and artwork into WAV masters and keep them in My Catalog. Your highest-quality files stay just as traceable as the MP3s, wherever they are shared or sent." },
  { group: "Business & education", from: "management", title: "PDF Fill, Sign & Download", tip: "Open any PDF, type into its own fill-in boxes, add text, dates and your signature, then download a clean, finished copy at full quality. The file never leaves your browser.", paperwork: true, eaglePair: true },
  { group: "Business & education", from: "management", title: "Custom Music Industry Contracts", tip: "Fill in a contract from a blueprint, adjust the terms, and keep it with your catalog.", paperwork: true },
  { group: "Business & education", from: "management", title: "Contract Signature Requests & Signing", tip: "Send contracts to every party to e-sign; each signature is time-stamped and hashed", paperwork: true },
  { group: "Business & education", from: "management", title: "Music Industry Blueprints", tip: "75+ ready-to-sign contracts with plain-language guides, plus step-by-step business blueprints and home recording cheat sheets", paperwork: true },
  { group: "Business & education", from: "management", title: "Personal Branding", tip: "Make everything you hand out yours: your logo, your colors, your business name and your tagline or slogan on every contract, split sheet, lyric download and catalog download. Included with Catalog Management, or $13.99 a year for the kit.", paperwork: true },
  { group: "Business & education", from: "management", title: "Signed Contract Vault", tip: "Fully signed contracts are locked and stored, ready to download as a signed PDF", paperwork: true },
  // One on One Coaching (management, soon) is hidden until there's a plan for it (founder, 2026-10-23).
];

/** Registration assistance, per song, per agency, on top of the setup fee. */
export const ASSISTANCE_PER_SONG_AGENCY = 4.99;

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

/** Singles/EPs are up to 6 songs; more is priced as an album. Set from the songs picked, never chosen by the user. */
export const assistanceType = (songs: number): "single" | "album" => (songs > 6 ? "album" : "single");

export function assistanceTotal(type: "single" | "album", songs: number, agencies: number) {
  if (songs <= 0 || agencies <= 0) return 0;
  const f = assistanceFees(type, songs);
  return Math.round((f.base + f.extended + ASSISTANCE_PER_SONG_AGENCY * f.n * agencies) * 100) / 100;
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
