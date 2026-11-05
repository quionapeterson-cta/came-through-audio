import { addDays, DAY } from "./retention";

/**
 * Offboarding (founder, 2026-11-05): an employee who leaves inside their first 90 days loses account access the day it
 * happens, and gets 30 days before the account is deleted.
 *
 * Those 30 days are not only a download window: paying for any plan before the date keeps the account and everything in
 * it, and the deletion stops. That is the point of the window, so every email and every screen says it first and gives
 * the deletion date as the outcome of not paying.
 *
 * The rule covers accounts created under the staff plan, and staff who claim the offer inside those 90 days. Someone who
 * leaves after 90 days is not deleted at all: their staff plan runs to the end of the period it was granted for and then
 * bills as a normal plan like anyone else.
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

/** Said before the deletion date everywhere, because keeping the account is the option we want them to take. */
export const SECURE_COPY = "Pay for any plan before that date and the account, songs and paperwork stay.";

/** Paying anything before the date stops the deletion. The cron re-checks the tier on the day, so a late payment wins. */
export const keepsAccountOnPayment = (tier: string) => tier !== "free";

/** Past 90 days the staff plan is never cut short: it runs to the end of its period, then bills as a normal plan. */
export const planRecycles = (withinProbation: boolean) => !withinProbation;
