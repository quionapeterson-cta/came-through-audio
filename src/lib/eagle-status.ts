/**
 * The Catalog Management "soaring" status eagles (PLAN-badges-roles-app.md §"How Catalog Management Tier Status
 * Badges Work", founder art 2026-11-03). Three stages, one per stretch of time on the plan, plus a grayed-out locked
 * state for everyone who isn't on Catalog Management yet, so the gated features advertise what they'd unlock.
 *
 * Art lives in the repo as real files, referenced by literal path (AGENTS.md), never a CDN pointer.
 */

/** The folder the founder added; the spaces are part of the name, and the browser encodes them. */
const ART = "/icons/playful/cta-catalog management - eagle- status badges";

export const EAGLE_ART = {
  /** The full badge disc: the status shown once you're on Catalog Management. */
  disc: `${ART}/cta_eagle_soar_badge.png`,
  /** The transparent eagle alone, used as a small dot next to a name. */
  soar: `${ART}/cta_eagle_soar_badge.png`,
  keepSoaring: `${ART}/cta_eagle_keep_soaring.png`,
  highest: `${ART}/cta_eagle_I_soar_the_higest.png`,
  /** Accepted the upgrade offer: the exclusive badge. */
  upgrade: `${ART}/cta_eagle_upgrade_offer_acceptance_exclusive_badge.png`,
  /** The close-up eagle: the main picture above the $89.99 plan's name (founder art, 2026-11-03). */
  closeUp: `${ART}/cta_eagle_close_up.png`,
  /** Eye on the prize: every Catalog Management row that isn't paperwork. */
  eyeOnThePrize: `${ART}/cta_eagle_eye_on_the-prize.png`,
  /** Contracts delivery art: kept in the repo, no longer on the chart (every plan shows the eye on the prize). */
  contractsDelivery: `${ART}/cta_eagle_contracts_delivery.png`,
  /** Soft glow behind the disc on hover. */
  glow: `${ART}/cta_hover_glow.png`,
} as const;

export type EagleStageKey = "soar" | "keep_soaring" | "highest";

export type EagleStage = {
  key: EagleStageKey;
  /** What the dot means, in the founder's words. */
  label: string;
  /** Full explanation for the tooltip and screen readers. */
  detail: string;
  art: string;
  /** First month this stage shows (1 = the first month of active use). */
  from: number;
  /** Last month this stage shows; null means "and thereafter". */
  until: number | null;
};

/** Month 1–4 Soaring, 4–8 Keep Soaring, 8–12 and thereafter I Soar The Highest. */
export const EAGLE_STAGES: EagleStage[] = [
  { key: "soar", label: "Soaring", art: EAGLE_ART.soar, from: 1, until: 4,
    detail: "Active on Catalog Management: month 1 to 4." },
  { key: "keep_soaring", label: "Keep Soaring", art: EAGLE_ART.keepSoaring, from: 4, until: 8,
    detail: "Active on Catalog Management: month 4 to 8." },
  { key: "highest", label: "I Soar The Highest", art: EAGLE_ART.highest, from: 8, until: null,
    detail: "Active on Catalog Management: month 8, and every month after." },
];

/** Whole months of active use between two dates (0 before the first full month). */
export function activeMonths(startedAt: string | null | undefined, now = new Date()) {
  if (!startedAt) return 0;
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return 0;
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  // A month that started on the 31st isn't complete until the 31st (or the last day) of a later month.
  const whole = now.getDate() < start.getDate() ? months - 1 : months;
  return Math.max(0, whole);
}

/** Which eagle a member shows at this many months of active use. */
export function eagleStage(months: number): EagleStage {
  // Months count from 1 for the first month of use; boundaries are 4 and 8 per the rules.
  const month = Math.max(1, Math.floor(months) + 1);
  return EAGLE_STAGES.find((s) => month < (s.until ?? Infinity)) ?? EAGLE_STAGES[EAGLE_STAGES.length - 1]!;
}

export type EagleStatus =
  | { locked: true; label: string; detail: string; art: string }
  | { locked: false; label: string; detail: string; art: string; stage: EagleStage; months: number };

/**
 * The status for one account. `onManagement` comes from the tier (the same `management` tier the server's has_tier
 * checks, paused accounts count as Free); `startedAt` is when the plan began.
 */
export function eagleStatus({ onManagement, startedAt, now = new Date() }: { onManagement: boolean; startedAt?: string | null; now?: Date }): EagleStatus {
  if (!onManagement) {
    return {
      locked: true,
      label: "Catalog Management",
      detail: "Locked: the soaring status comes with Catalog Management.",
      art: EAGLE_ART.disc,
    };
  }
  const months = activeMonths(startedAt, now);
  const stage = eagleStage(months);
  return { locked: false, label: stage.label, detail: stage.detail, art: stage.art, stage, months };
}
