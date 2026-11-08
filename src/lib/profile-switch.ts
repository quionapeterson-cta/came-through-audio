import type { Tier } from "@/lib/plans";

/**
 * Working as another artist (founder, 2026-11-08): an owner switches between their own catalog and every artist on a
 * seat they pay for, the way Instagram and TikTok switch between accounts. The switch only changes whose catalog and
 * whose saved defaults the workspace is working on — it is the same login, and the database still decides what may be
 * written (the seat is read on the server, never passed as a flag from the browser).
 */

export type WorkingProfile = { userId: string; name: string; tier: Tier; seat: boolean };

const KEY = "cta.workingAs";

/** You first, then each accepted seat artist once, in the order the seats were read. */
export function workingProfiles(
  own: { userId: string; name: string; tier: Tier },
  seats: { userId: string; name: string; tier: Exclude<Tier, "free"> }[],
): WorkingProfile[] {
  const list: WorkingProfile[] = [{ ...own, seat: false }];
  const seen = new Set([own.userId]);
  for (const s of seats) {
    if (seen.has(s.userId)) continue;
    seen.add(s.userId);
    list.push({ ...s, seat: true });
  }
  return list;
}

/**
 * The tier the workspace works at while a profile is selected. A seat artist's account carries the seat's own tier, so
 * an owner is never given more than the seat pays for while standing in that catalog (founder, 2026-11-08).
 */
export function scopedTier(profile: WorkingProfile | null, ownTier: Tier): Tier {
  return profile ? profile.tier : ownTier;
}

/** A remembered pick, so a reload lands back on the artist being worked on. Only an id this account may work as. */
export function readWorkingAs(list: WorkingProfile[]): string | null {
  try {
    const id = localStorage.getItem(KEY);
    return id && list.some((p) => p.userId === id) ? id : null;
  } catch { return null; }
}

export function rememberWorkingAs(userId: string | null) {
  try { if (userId) localStorage.setItem(KEY, userId); else localStorage.removeItem(KEY); } catch { /* storage blocked */ }
}

/** The seats are only switchable while they are paid for: a cancelled seat keeps working until its year ends. */
export const switchable = (profile: WorkingProfile) => !profile.seat || profile.tier !== "free";
