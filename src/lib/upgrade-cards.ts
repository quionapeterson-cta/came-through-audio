import type { Tier } from "@/lib/plans";

/**
 * The three post-diagnosis upgrade cards for Free accounts (PLAN-royalty-health-hub-v2 §3). Wording is locked: change
 * it in the plan first. Prices come from PLAN_TIERS at render time, so a price change never leaves stale copy here.
 */
export type UpgradeCard = {
  tier: Exclude<Tier, "free">;
  priceId: string;
  title: string;
  body: string;
  cta: string;
  includes: string;
};

export const UPGRADE_CARDS: UpgradeCard[] = [
  {
    tier: "plus",
    priceId: "catalog_plus_yearly",
    title: "Don't Leave Your Music Unprotected",
    body: "Streaming links can be taken down, but your own master vault stays yours. Lock in your verified credits and download official tagged masters anytime.",
    cta: "Save to My Catalog & Embed Masters",
    includes: "Includes unlimited MP3 embedding and full catalog storage for 1 full year.",
  },
  {
    tier: "collaborate",
    priceId: "catalog_collaborate_yearly",
    title: "Settle Your Splits & Bulk Register Your Catalog with 1-Click Exports",
    body: "Don't let uncollected royalties slip through the cracks. Collect legally binding split sheets and bulk register your catalog with 1-click agency exports.",
    cta: "Settle Splits & Bulk Register with 1-Click Exports",
    includes: "Includes everything in Plus, split sheets, 1-click PRO exports & more.",
  },
  {
    tier: "management",
    priceId: "catalog_management_yearly",
    title: "Customize Contracts, Collect E-Signatures & Unlock Business Blueprints",
    body: "Don't risk your ownership on handshakes. Customize official contract templates for your exact deal points, send for legally binding e-signatures, and unlock step-by-step business blueprints and artist cheat sheets.",
    cta: "Customize Contracts & Collect E-Signatures",
    includes: "Includes everything in Collaborate, WAV embedding, blueprints & more.",
  },
];
