import { addDays, addMonths, DAY } from "./retention";

/**
 * Two years without a sign-in is the account deadline (founder, 2026-11-08). A plan that ends is a different, smaller
 * thing: it leaves the catalog read-only on Free and removes nothing for as long as the account is used.
 *
 * On the deadline the account is not what always goes. The files stored for it — masters, artwork and anything else in
 * storage — and its catalog entries are deleted for anyone still on Free, and the account itself is deleted only if
 * there has been no sign-in at all since the schedule was written. Upgrading before the date keeps both. The notice
 * periods are the founder's: 60, 30, 7 and 1 day before the date.
 *
 * A signed-in account keeps its paperwork for one more, shorter window (founder, 2026-11-08): signed split sheets,
 * contracts and certificates are removed 30 days after the files, after 30/14/7/1 day reminders of their own. Only a
 * paid plan stops that second clock; signing in no longer does, because the account is already saved.
 */
export const INACTIVITY_MONTHS = 24;
/** The least notice anyone gets, including an account that was already dormant the first time the job ran. */
export const INACTIVITY_FIRST_NOTICE_DAYS = 60;
export const INACTIVITY_REMINDER_DAYS = [60, 30, 7, 1] as const;
/** The paperwork's own window, opened when the account survives the date still holding signed records. */
export const INACTIVITY_SIGNED_DAYS = 30;
export const SIGNED_REMINDER_DAYS = [30, 14, 7, 1] as const;

/** What the second date removes, in the words the emails, the policies and the support scripts all use. */
export const SIGNED_RECORDS = "signed split sheets, contracts and certificates";

export type InactivityReminder = "60" | "30" | "7" | "1";
export type SignedReminder = "30" | "14" | "7" | "1";

export type InactivityRow = {
  user_id: string;
  /** The last sign-in (or the account's creation) the schedule was built from. */
  last_active_at: string;
  delete_on: string;
  reminders: string[];
  deleted_at: string | null;
  /** When the stored files and catalog entries came off. The paperwork clock starts from that run. */
  cleared_at?: string | null;
  /** The second date: when the signed paperwork goes too, unless a plan is paid for before it. */
  signed_delete_on?: string | null;
  signed_reminders?: string[];
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

/**
 * The paperwork date, 30 days after the files came off. Kept as its own function so the emails, the tests and the job
 * all read the same window.
 */
export const signedDeleteOn = (from: string | Date) => addDays(from, INACTIVITY_SIGNED_DAYS);

/**
 * The paperwork reminder due now: 30, 14, 7 and 1 day before its own date, once each. A schedule without a paperwork
 * date never sends one.
 */
export function dueSignedReminder(
  row: Pick<InactivityRow, "signed_delete_on" | "signed_reminders">,
  now = new Date(),
): SignedReminder | null {
  if (!row.signed_delete_on) return null;
  const left = daysUntil(row.signed_delete_on, now);
  if (left < 0) return null;
  const send: SignedReminder = left <= 1 ? "1" : left <= 7 ? "7" : left <= 14 ? "14" : "30";
  return (row.signed_reminders ?? []).includes(send) ? null : send;
}

/** One split sheet row, as far as this job needs it. */
export type SheetRow = {
  id: string;
  catalog_id?: string | null;
  track_title?: string | null;
  isrc?: string | null;
  signed_at: string | null;
};

/** A sheet is known by its song; once the catalog row is gone it is known by the title and ISRC kept on the rows. */
const sheetKey = (s: SheetRow) => s.catalog_id ?? `${s.track_title ?? ""}|${s.isrc ?? ""}`;

/**
 * The rows of every split sheet all its collaborators have signed. A sheet someone has not signed is not signed
 * paperwork, so it is left alone; this is the only definition of a signed split sheet the job uses.
 */
export function fullySignedSheetIds(rows: SheetRow[]): string[] {
  const sheets = new Map<string, SheetRow[]>();
  for (const row of rows) {
    const key = sheetKey(row);
    const group = sheets.get(key);
    if (group) group.push(row);
    else sheets.set(key, [row]);
  }
  const ids: string[] = [];
  for (const group of sheets.values()) if (group.every((r) => r.signed_at)) ids.push(...group.map((r) => r.id));
  return ids;
}

/** In words for the email heading: "60 days", "1 day". */
export const noticeLine = (deleteOn: string | Date, now = new Date()) => {
  const left = Math.max(0, daysUntil(deleteOn, now));
  return left <= 1 ? "last day" : `${left} days`;
};
