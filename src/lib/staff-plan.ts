import { packageSongs } from "./proof";
import type { Tier } from "./plans";

/**
 * The staff plan (founder, 2026-11-05): anyone on the team gets Catalog Management free, with the brand kit and the
 * contract generator included, so they can run their own music business on the same tools they support. If they already
 * pay for a plan, their paid time finishes first: the free year is measured from the start of that billing cycle, so
 * nobody is refunded mid-term and nobody loses a day they paid for.
 *
 * Pay, hours and renewal are not in this file. Anything undecided stays out of the copy.
 */
export const STAFF_PLAN_TIER: Tier = "management";

/** One album is the Album package's own size, so "an album's worth" is a number we already sell, not a new one. */
export const ALBUM_SONGS = packageSongs("Album");

/** One album of AI Protection credits a year, and two albums' worth of song registrations. */
export const STAFF_AI_CREDITS = ALBUM_SONGS;
export const STAFF_REGISTRATION_CREDITS = 2 * ALBUM_SONGS;
/** Registrations are spent one song at a time, but a single album batch can never exceed one album's worth. */
export const STAFF_REGISTRATION_BATCH_MAX = ALBUM_SONGS;

export type StaffPlanWindow = { startsAt: string; endsAt: string; fromPaidPlan: boolean };

const addMonths = (d: Date, months: number) => {
  const next = new Date(d);
  next.setMonth(next.getMonth() + months);
  return next;
};

/**
 * When the staff year starts and ends.
 * - Paying now: it starts when the paid period ends, and ends twelve months after that period began.
 * - Not paying: it starts now and runs twelve months.
 * The paid period always wins if the two disagree, so a grant can never cut paid time short.
 */
export function staffPlanWindow(input: { cycleStart?: string | null; cycleEnd?: string | null }, now = new Date()): StaffPlanWindow {
  const end = input.cycleEnd ? new Date(input.cycleEnd) : null;
  const start = input.cycleStart ? new Date(input.cycleStart) : null;
  if (end && end.getTime() > now.getTime()) {
    const twelveFromCycle = addMonths(start && start.getTime() <= end.getTime() ? start : end, 12);
    return {
      startsAt: end.toISOString(),
      endsAt: (twelveFromCycle.getTime() > end.getTime() ? twelveFromCycle : end).toISOString(),
      fromPaidPlan: true,
    };
  }
  return { startsAt: now.toISOString(), endsAt: addMonths(now, 12).toISOString(), fromPaidPlan: false };
}

/** The staff plan is live between those two dates. */
export function staffPlanActive(grant: { starts_at: string; ends_at: string; ended_at?: string | null } | null, now = new Date()): boolean {
  if (!grant || grant.ended_at) return false;
  const t = now.getTime();
  return Date.parse(grant.starts_at) <= t && Date.parse(grant.ends_at) > t;
}

/** How many registrations may be submitted in one batch: never more than one album's worth. */
export function registrationBatchAllowed(left: number): number {
  return Math.max(0, Math.min(left, STAFF_REGISTRATION_BATCH_MAX));
}

/** A short line for the panel: what the grant gives and when it runs out. */
export function staffPlanLabel(grant: { starts_at: string; ends_at: string } | null, now = new Date()) {
  if (!grant) return "No staff plan yet.";
  const start = new Date(grant.starts_at);
  if (start.getTime() > now.getTime()) return `Starts ${start.toLocaleDateString()} when the paid plan ends.`;
  return `Free while you work here, next review ${new Date(grant.ends_at).toLocaleDateString()}.`;
}

/**
 * A staff member who already has a member account reports that email, and a super admin marks it staff. Until then the
 * account is treated as a member account, because an unrecognised address must never grant management features.
 */
export function memberEmailProblem(email: string, known: boolean): string | null {
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Enter the email on the account you already use.";
  if (known) return "That email is already marked as a staff account. Ask a super admin if it looks wrong.";
  return null;
}
