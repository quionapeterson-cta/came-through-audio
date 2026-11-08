import { addDays, addMonths, DAY } from "./retention";

/**
 * Two years without a sign-in is the account deadline (founder, 2026-11-08). A plan that ends is a different, smaller
 * thing: it leaves the catalog read-only on Free and removes nothing for as long as the account is used.
 *
 * On the deadline the account is not what always goes. The files stored for it — masters, artwork and anything else in
 * storage — and its catalog entries are deleted for anyone still on Free, and the account itself is deleted only if
 * there has been no sign-in at all since the schedule was written. Upgrading before the date keeps both. The notice
 * periods are the founder's: 60, 30, 7 and 1 day before the date.
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

/** The date two years after the last activity, but never less than the first notice from today. */
export function inactivityDeleteOn(lastActive: string | Date, now = new Date()): Date {
  const twoYears = addMonths(lastActive, INACTIVITY_MONTHS);
  const firstNotice = addDays(now, INACTIVITY_FIRST_NOTICE_DAYS);
  return twoYears > firstNotice ? twoYears : firstNotice;
}

export const daysUntil = (iso: string | Date, now = new Date()) =>
  Math.ceil((new Date(iso).getTime() - now.getTime()) / DAY);

/**
 * A sign-in after the schedule was written saves the account, not the files or catalog: those go on the date unless
 * the account is on a paid plan by then.
 */
export const hasBeenActiveSince = (
  row: Pick<InactivityRow, "last_active_at">,
  lastActive: string | Date | null | undefined,
): boolean => !!lastActive && new Date(lastActive).getTime() > new Date(row.last_active_at).getTime();

/** What the date removes: the files and catalog of a free account that came back, or everything when it never did. */
export type InactivityOutcome = "catalog" | "account";
export const inactivityOutcome = (signedInSinceSchedule: boolean): InactivityOutcome =>
  signedInSinceSchedule ? "catalog" : "account";

/**
 * The reminder due now, or null. Each of 60, 30, 7 and 1 days before the date goes out once, so a member who never
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
