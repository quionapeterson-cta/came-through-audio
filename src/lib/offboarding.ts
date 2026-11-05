import { addDays, DAY } from "./retention";

/**
 * Offboarding (founder, 2026-11-05): an employee who leaves inside their first 90 days loses account access the day it
 * happens, and gets 30 days to download what is theirs before the account is deleted.
 *
 * The 30 days is the same window a member's catalog gets after a plan ends, so the clock reads the same everywhere. What
 * happens to someone who leaves after 90 days is not decided yet, so this file answers for the early leaver only and
 * returns nothing scheduled for anyone else.
 */
export const PROBATION_DAYS = 90;
export const ASSET_DAYS = 30;

export type Departure = {
  /** True for a leaver inside the first 90 days: access ends the moment this is recorded. */
  immediate: boolean;
  accessEndsAt: string;
  /** Last day to download songs, splits and contracts, and the day the account is deleted. */
  deleteOn: string | null;
};

/** Whether the last day falls inside the first 90 days of work. */
export function leftWithinProbation(firstDay: string | Date, lastDay: string | Date): boolean {
  const worked = new Date(lastDay).getTime() - new Date(firstDay).getTime();
  return worked <= PROBATION_DAYS * DAY;
}

/**
 * What happens when someone leaves. Access ends now either way for the early leaver; for a longer-serving employee the
 * staff plan simply ends on their last day and nothing is scheduled, because that policy is still undecided.
 */
export function departureOn(firstDay: string | Date, lastDay: string | Date, now = new Date()): Departure {
  const immediate = leftWithinProbation(firstDay, lastDay);
  if (!immediate) return { immediate: false, accessEndsAt: new Date(lastDay).toISOString(), deleteOn: null };
  const deleteOn = addDays(now, ASSET_DAYS).toISOString();
  return { immediate: true, accessEndsAt: now.toISOString(), deleteOn };
}

export type DepartureReminder = "ended" | "7";

/**
 * Two emails: one the day access ends (saying what the export window is), and one a week before deletion. Each goes out
 * once; a reminder covers the earlier one so nobody gets a late "you have 7 days" after the account is already gone.
 */
export function dueDepartureReminder(
  row: { access_ended_at: string; delete_on: string | null; reminders: string[] },
  now = new Date(),
): DepartureReminder | null {
  if (!row.delete_on || row.reminders.includes("ended")) {
    if (!row.delete_on) return null;
    // "ended" already sent: only the week-before reminder is left.
    const daysLeft = Math.ceil((new Date(row.delete_on).getTime() - now.getTime()) / DAY);
    return daysLeft <= 7 && daysLeft > 0 && !row.reminders.includes("7") ? "7" : null;
  }
  return "ended";
}

/** The day the account is deleted, in words staff and the leaver can check. */
export const deletionLine = (deleteOn: string | null) =>
  deleteOn ? `Deleted on ${new Date(deleteOn).toLocaleDateString()}` : "No deletion scheduled";
