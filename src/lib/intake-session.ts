/**
 * The visit in progress, kept for the account in this browser.
 *
 * A Royalty Health visit is a sitting, not a page: the streaming pull, the agency list that was just read and the
 * intake that is open all belong to it. They used to live only in React state, so switching to another tab, opening a
 * second window or reloading emptied the appointment. This keeps that state on the device, per account, so it is still
 * there when the member comes back. The agency file itself is never stored (it is read in the browser and thrown away);
 * only the comparison it produced is kept, which is the same thing the app already saves to the account.
 *
 * Nothing here is shared between accounts, and everything expires by itself so an old sitting never reappears weeks
 * later.
 */

/** How long an unfinished sitting is kept: the rest of an ordinary working day. */
export const INTAKE_TTL_MS = 12 * 60 * 60 * 1000;

const key = (userId: string, name: string) => `cta-intake:${name}:${userId}`;

type Box<T> = { at: number; value: T };

/** The stored slice, or undefined when there is none, it has expired, or this browser blocks storage. */
export function readIntake<T>(userId: string | undefined, name: string): T | undefined {
  if (!userId) return undefined;
  try {
    const raw = localStorage.getItem(key(userId, name));
    if (!raw) return undefined;
    const box = JSON.parse(raw) as Box<T>;
    if (!box || typeof box.at !== "number" || Date.now() - box.at > INTAKE_TTL_MS) {
      localStorage.removeItem(key(userId, name));
      return undefined;
    }
    return box.value;
  } catch {
    return undefined;
  }
}

/** Saves the slice. A full or blocked browser keeps working; it just won't survive a reload. */
export function writeIntake<T>(userId: string | undefined, name: string, value: T) {
  if (!userId) return;
  try {
    localStorage.setItem(key(userId, name), JSON.stringify({ at: Date.now(), value } satisfies Box<T>));
  } catch {
    /* storage full or blocked: the sitting still works, it just won't be restored */
  }
}

export function clearIntake(userId: string | undefined, name: string) {
  if (!userId) return;
  try {
    localStorage.removeItem(key(userId, name));
  } catch {
    /* storage blocked */
  }
}
