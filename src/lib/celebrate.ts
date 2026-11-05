/**
 * The member's now-and-then confetti (founder, 2026-11-05): a short burst on arriving in the workspace, like the one
 * Admin gets at sign-in, but at most once a week per browser so it stays a nice surprise instead of a tic.
 *
 * A browser that blocks storage never celebrates: without somewhere to remember the last one, every page load would
 * burst. The workspace also skips it when the member turned celebrations off or asked for reduced motion.
 */
export const CELEBRATED_KEY = "cta.lastCelebrated";

/** How long between bursts. Seven days: often enough to notice, rare enough not to be noise. */
export const CELEBRATION_INTERVAL_DAYS = 7;

/** True when it has been at least `days` since the last burst, or when there has never been one. */
export function shouldCelebrate(last: string | null | undefined, now = new Date(), days = CELEBRATION_INTERVAL_DAYS): boolean {
  if (!last) return true;
  const at = Date.parse(last);
  if (!Number.isFinite(at)) return true;
  return now.getTime() - at >= days * 86400000;
}

export function readLastCelebration(): string | null {
  try {
    return localStorage.getItem(CELEBRATED_KEY);
  } catch {
    return null;
  }
}

/** Records the burst, or reports that it could not be recorded (and so should not happen). */
export function markCelebrated(now = new Date()): boolean {
  try {
    localStorage.setItem(CELEBRATED_KEY, now.toISOString());
    return true;
  } catch {
    return false;
  }
}

/** One call per visit: celebrates and records when it is time, and does nothing otherwise. */
export function maybeCelebrate(now = new Date()): boolean {
  if (!shouldCelebrate(readLastCelebration(), now)) return false;
  return markCelebrated(now);
}
