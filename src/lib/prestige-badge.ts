/**
 * Prestige Badge Capsule (founder, 2026-11-21): the badge status beside the artist's name in the workspace header.
 *
 * The capsule itself is cosmetic; what it shows is always earned. The frame a member may wear follows the whole
 * ecosystem — every badge they hold across the platform, not the count on one tab — so the rules live here rather
 * than in the component, where the shelf, the studio and its copy can all read the same numbers.
 */

import { nextGoal } from "@/lib/badges";

export type LiquidFinish = "gold" | "platinum";
export type FrameTier = "base" | "starter" | "pro" | "master";
export type FrameId =
  | "obsidian"
  | "glow-cobalt"
  | "glow-white"
  | "glow-gold"
  | "diamond-gold"
  | "diamond-platinum"
  | "iced-gold"
  | "iced-platinum";

export type PrestigeFrame = {
  id: FrameId;
  name: string;
  tier: FrameTier;
  /** Ecosystem badges that open it on their own. */
  badges: number;
  /** Share of the live ecosystem that opens it on its own; 0 when the badge count is the only way in. */
  completion: number;
  hint: string;
};

/**
 * Starter (1+) electric glow borders, Pro (5+ or half the ecosystem) diamond bezels, Master (10+ or a full
 * ecosystem) the iced-out surface. The plain obsidian pill is the one everybody starts on.
 */
export const PRESTIGE_FRAMES: PrestigeFrame[] = [
  {
    id: "obsidian",
    name: "Studio Obsidian",
    tier: "base",
    badges: 0,
    completion: 0,
    hint: "The plain black plaque, always available.",
  },
  {
    id: "glow-cobalt",
    name: "Electric Cobalt Glow",
    tier: "starter",
    badges: 1,
    completion: 0,
    hint: "A neon tube ring in the brand cobalt.",
  },
  {
    id: "glow-white",
    name: "Pure Studio White Glow",
    tier: "starter",
    badges: 1,
    completion: 0,
    hint: "A neon tube ring in studio white.",
  },
  {
    id: "glow-gold",
    name: "Prestige Gold Glow",
    tier: "starter",
    badges: 1,
    completion: 0,
    hint: "A neon tube ring in prestige gold.",
  },
  {
    id: "diamond-gold",
    name: "Gold Diamond Bezel",
    tier: "pro",
    badges: 5,
    completion: 0.5,
    hint: "A faceted, diamond-set bezel in gold.",
  },
  {
    id: "diamond-platinum",
    name: "Platinum Diamond Bezel",
    tier: "pro",
    badges: 5,
    completion: 0.5,
    hint: "A faceted, diamond-set bezel in platinum.",
  },
  {
    id: "iced-gold",
    name: "Iced-Out Gold",
    tier: "master",
    badges: 10,
    completion: 1,
    hint: "The whole plaque paved in diamonds, in gold.",
  },
  {
    id: "iced-platinum",
    name: "Iced-Out Platinum",
    tier: "master",
    badges: 10,
    completion: 1,
    hint: "The whole plaque paved in diamonds, in platinum.",
  },
];

export const frameById = (id: FrameId) => PRESTIGE_FRAMES.find((f) => f.id === id);

export const LIQUID_FINISHES: { id: LiquidFinish; name: string; hint: string }[] = [
  { id: "gold", name: "Liquid Gold", hint: "Molten gold with warm specular highlights." },
  { id: "platinum", name: "Liquid Platinum", hint: "Molten platinum with a cool mirror sheen." },
];

export type PrestigeStyle = {
  liquid: LiquidFinish;
  frame: FrameId;
  /** The earned badge the member pinned to the capsule; null follows their profile picture, then their newest badge. */
  featuredId: string | null;
};

export const DEFAULT_PRESTIGE_STYLE: PrestigeStyle = {
  liquid: "gold",
  frame: "obsidian",
  featuredId: null,
};

const key = (userId: string) => `cta-badge-studio:${userId}`;

/** The member's finish and frame, kept in this browser so a preview never changes what they earned. */
export function loadPrestigeStyle(userId?: string): PrestigeStyle {
  if (!userId || typeof localStorage === "undefined") return DEFAULT_PRESTIGE_STYLE;
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return DEFAULT_PRESTIGE_STYLE;
    const saved = JSON.parse(raw) as Partial<PrestigeStyle>;
    const liquid = LIQUID_FINISHES.some((l) => l.id === saved.liquid)
      ? (saved.liquid as LiquidFinish)
      : DEFAULT_PRESTIGE_STYLE.liquid;
    const frame = PRESTIGE_FRAMES.some((f) => f.id === saved.frame)
      ? (saved.frame as FrameId)
      : DEFAULT_PRESTIGE_STYLE.frame;
    const featuredId = typeof saved.featuredId === "string" ? saved.featuredId : null;
    return { liquid, frame, featuredId };
  } catch {
    return DEFAULT_PRESTIGE_STYLE;
  }
}

export function savePrestigeStyle(userId: string, style: PrestigeStyle) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key(userId), JSON.stringify(style));
  } catch {
    /* storage blocked: the choice still holds for this visit */
  }
}

/** Earned badges as a share of every live badge in the ecosystem, 0–1. */
export const ecosystemCompletion = (earned: number, total: number) =>
  total > 0 ? Math.min(1, Math.max(0, earned / total)) : 0;

const completionGoal = (frame: PrestigeFrame, total: number) =>
  frame.completion > 0 && total > 0
    ? Math.ceil(frame.completion * total)
    : Number.POSITIVE_INFINITY;

/** Unlocked by earning the frame's badge count, or by finishing enough of the ecosystem. */
export function frameUnlocked(frame: PrestigeFrame, earned: number, total: number) {
  if (frame.tier === "base") return true;
  return earned >= frame.badges || earned >= completionGoal(frame, total);
}

/** How many more ecosystem badges stand between the member and this frame (0 once it is theirs). */
export function badgesToUnlock(frame: PrestigeFrame, earned: number, total: number) {
  if (frame.tier === "base") return 0;
  const goal = Math.min(frame.badges, completionGoal(frame, total));
  if (!Number.isFinite(goal)) return Math.max(0, frame.badges - earned);
  return Math.max(0, goal - earned);
}

/** A badge as the capsule ranks it: its goal and repeat step, how far the member has got, and when it last came. */
export type CapsuleBadge = {
  goal: number;
  every?: number | undefined;
  count: number;
  earned?: boolean | undefined;
  lastEarnedAt?: number | undefined;
};

/** The count at which a badge is next earned: its goal the first time, then its next repeat step. */
export const nextEarningAt = (
  b: Pick<CapsuleBadge, "goal" | "every">,
  count: number,
  held: boolean,
) => (held && b.every ? nextGoal({ goal: b.goal, every: b.every }, count) : b.goal);

/** How many more actions before the badge is earned, or earned again. */
export const stepsToNextEarning = (b: CapsuleBadge) =>
  Math.max(1, nextEarningAt(b, b.count, !!b.earned) - b.count);

/**
 * The one badge the capsule shows for a tab (founder, 2026-11-21): repeatable badges first, because an every-time badge
 * is one action away and should not wait behind a milestone that takes many steps, then whatever is closest to its next
 * earning. A recent earning breaks a tie, so the badge the member is working on now wins.
 */
export function pickCapsuleBadge<T extends CapsuleBadge>(items: T[]): T | undefined {
  return [...items].sort((a, b) => {
    const repeatable = Number(!!b.every) - Number(!!a.every);
    if (repeatable) return repeatable;
    const steps = stepsToNextEarning(a) - stepsToNextEarning(b);
    if (steps) return steps;
    return (b.lastEarnedAt ?? 0) - (a.lastEarnedAt ?? 0);
  })[0];
}

export const frameTierLabel: Record<FrameTier, string> = {
  base: "Always available",
  starter: "Starter · 1 badge",
  pro: "Pro · 5 badges or half the ecosystem",
  master: "Master · 10 badges or the whole ecosystem",
};
