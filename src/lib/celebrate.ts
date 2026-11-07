/**
 * The member's welcome confetti (founder, 2026-11-06, replacing the weekly burst of 2026-11-05): it fires only when
 * someone comes back after 30 days or more away, so it marks a return instead of decorating every visit. Finishing a
 * blueprint checklist keeps its own burst, which is the celebration that means something.
 *
 * The last visit is remembered per browser. A browser that blocks storage never celebrates: without somewhere to remember
 * the last visit, every page load would burst. A first-ever visit never celebrates either — there is nothing to come back
 * from — and the workspace still skips it when celebrations are off or reduced motion is asked for.
 */
export const LAST_SEEN_KEY = "cta.lastSeen";

/** How long away counts as coming back. Thirty days: long enough that the burst means something. */
export const RETURN_AFTER_DAYS = 30;

/**
 * The defaults sky (founder, 2026-11-06): both profile blueprints finished is a once-in-a-lifetime moment, so the
 * shooting stars and the rocket play once per browser rather than every time a defaults run is finished again.
 */
export const DEFAULTS_SKY_KEY = "cta.defaultsSky";

/** True the first time only; records it as played. A browser that blocks storage still gets the celebration once. */
export function claimDefaultsSky(now = new Date()): boolean {
  try {
    if (localStorage.getItem(DEFAULTS_SKY_KEY)) return false;
    localStorage.setItem(DEFAULTS_SKY_KEY, now.toISOString());
    return true;
  } catch {
    return true;
  }
}

/** True when the gap since the last visit is at least `days`. A missing or unreadable date is not a return. */
export function isReturning(last: string | null | undefined, now = new Date(), days = RETURN_AFTER_DAYS): boolean {
  if (!last) return false;
  const at = Date.parse(last);
  if (!Number.isFinite(at)) return false;
  return now.getTime() - at >= days * 86400000;
}

export function readLastVisit(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

/** Records this visit, or reports that it could not be recorded (and so should not burst). */
export function markVisit(now = new Date()): boolean {
  try {
    localStorage.setItem(LAST_SEEN_KEY, now.toISOString());
    return true;
  } catch {
    return false;
  }
}

/**
 * One call per visit: records the visit and says whether it was a return after 30 days or more. The visit is recorded
 * either way, so the next one measures from today rather than from the last burst.
 */
export function celebrateReturn(now = new Date()): boolean {
  const back = isReturning(readLastVisit(), now);
  if (!markVisit(now)) return false;
  return back;
}
