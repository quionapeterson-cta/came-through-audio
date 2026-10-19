import type { Onboarding } from "@/lib/artist-profile";

export type Award = { id: string; name: string; src: string };

/**
 * Awards in the order they unlock. Only Genesis is earnable today (claimed during onboarding);
 * the award rules are deferred (BRANDING.md §8), so later entries are placeholders until then.
 * bedazzled_vinyl.png (corrupt header) is left out until it is replaced.
 */
export const AWARDS: Award[] = [
  { id: "genesis", name: "Genesis Crown", src: "/icons/serious/came_genesis_gold.png" },
  { id: "catalog_complete", name: "Catalog Complete", src: "/icons/playful/catalog_complete.png" },
  { id: "time_witness", name: "Time Witness", src: "/icons/serious/time_witness.png" },
  { id: "split_royal", name: "Split Royal", src: "/icons/serious/split_royal.png" },
  { id: "lyrical_genesis", name: "Lyrical Genesis", src: "/icons/serious/lyrical_genesis.png" },
  { id: "marathon", name: "Marathon", src: "/icons/playful/marathon.png" },
  { id: "midnight_oil", name: "Midnight Oil", src: "/icons/playful/midnight_oil.png" },
];

const UP_NEXT = 3;

export function earnedAwards(ob: Onboarding | null): Award[] {
  return AWARDS.filter((a) => a.id === "genesis" && !!ob?.welcomed);
}

/** The next few locked awards; the rest stay hidden so the shelf never feels like a checklist. */
export function upNextAwards(ob: Onboarding | null): Award[] {
  const earned = new Set(earnedAwards(ob).map((a) => a.id));
  return AWARDS.filter((a) => !earned.has(a.id)).slice(0, UP_NEXT);
}

/** Avatars are either a badge image (shown whole) or an uploaded photo (shown round). */
export const isBadgeImage = (src?: string) => !!src && src.startsWith("/icons/");

/** Retired badge art, mapped to its replacement so saved avatars keep working without rewriting profile data. */
const RETIRED_BADGES: Record<string, string> = {
  "/icons/playful/bedazzled_mpc.png": "/icons/playful/producer/platinum_laptop.png",
};
export const currentBadge = (src?: string) => (src && RETIRED_BADGES[src]) || src;
