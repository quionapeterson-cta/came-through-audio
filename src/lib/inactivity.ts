import { addDays, addMonths, DAY } from "./retention";

/**
 * Two years of inactivity deletes an account (founder, 2026-11-08). This replaces the old emptying: a plan that ends
 * now leaves the catalog read-only on Free for as long as the account is used. Deletion is the only thing that removes
 * an account without the member asking, and it always comes with emails first.
 *
 * Inactivity means no sign-in: the schedule is built from the account's last sign-in (or its creation, for an account
 * that never signed in). The reminder lead times below are a draft: the founder set the two years, not the notice
 * periods, so they live in one constant and nothing in the product promises them.
 */
export const INACTIVITY_MONTHS = 24;
/** The least notice anyone gets, including an account that was already dormant the first time the job ran. */
export const INACTIVITY_FIRST_NOTICE_DAYS = 60;
export const INACTIVITY_REMINDER_DAYS = [60, 30, 7, 1] as const;

export type InactivityReminder = "60" | "30" | "7" | "1";

export type InactivityRow = {
  user_id: string;
  /** The last sign-in (or the account's creation) the schedule was built from. */
  last_active_at: string;
  delete_on: string;
  reminders: string[];
  deleted_at: string | null;
};

/** The day the account goes: two years after the last activity, but never less than the first notice from today. */
export function inactivityDeleteOn(lastActive: string | Date, now = new Date()): Date {
  const twoYears = addMonths(lastActive, INACTIVITY_MONTHS);
  const firstNotice = addDays(now, INACTIVITY_FIRST_NOTICE_DAYS);
  return twoYears > firstNotice ? twoYears : firstNotice;
}

export const daysUntil = (iso: string | Date, now = new Date()) =>
  Math.ceil((new Date(iso).getTime() - now.getTime()) / DAY);

/** Signing in (or changing the profile) after the schedule was written calls the deletion off. */
export const hasBeenActiveSince = (
  row: Pick<InactivityRow, "last_active_at">,
  lastActive: string | Date | null | undefined,
): boolean => !!lastActive && new Date(lastActive).getTime() > new Date(row.last_active_at).getTime();

/**
 * The reminder due now, or null. Each of 60, 30, 7 and 1 days before the deletion goes out once, so a member who never
 * signs in hears from us four times before anything is removed.
 */
export function dueInactivityReminder(
  row: Pick<InactivityRow, "delete_on" | "reminders">,
  now = new Date(),
): InactivityReminder | null {
  const left = daysUntil(row.delete_on, now);
  if (left < 0) return null;
  const send: InactivityReminder = left <= 1 ? "1" : left <= 7 ? "7" : left <= 30 ? "30" : "60";
  return row.reminders.includes(send) ? null : send;
}

/** In words for the email heading: "60 days", "1 day". */
export const noticeLine = (deleteOn: string | Date, now = new Date()) => {
  const left = Math.max(0, daysUntil(deleteOn, now));
  return left <= 1 ? "last day" : `${left} days`;
};
