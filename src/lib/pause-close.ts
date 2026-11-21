/**
 * Closing a pause is only safe once its own Vault subscription is confirmed stopped (founder, 2026-11-21). If Stripe
 * refuses the cancel, the pause row must stay open: closing it would hide a $1.99/month charge that is still running,
 * with nothing left to retry. The rules live here, pure, so the app, the webhook and the daily pass all behave the same
 * and the refusal path can be tested without Stripe.
 */

/** Stripe refuses a cancel for many reasons (stale id, mode/key mismatch, rate limit, a 5xx). None of them means the
 *  charge stopped, so the pause has to stay open and the refusal is recorded for staff. */
export const VAULT_STILL_BILLING =
  "The monthly Vault charge could not be stopped, so the pause is still on. Try again in a moment; nothing else has changed.";

export type VaultStopDeps = {
  /** Cancel the Vault subscription; rejects when Stripe refuses. */
  cancel: () => Promise<void>;
  /** Read it back after a refusal: Stripe reporting `canceled` means the goal is already met. */
  status: () => Promise<string>;
  /** Record the refusal durably for staff. Called before the caller gives up. */
  alert: (error: unknown) => Promise<void>;
};

/**
 * True when the Vault charge is stopped — either the cancel worked, or Stripe already reports the subscription as
 * cancelled (a retry after a partial failure), so the same action can finish cleanly instead of failing forever.
 */
export async function vaultStopped(deps: VaultStopDeps): Promise<boolean> {
  try {
    await deps.cancel();
    return true;
  } catch (e) {
    try {
      if ((await deps.status()) === "canceled") return true;
    } catch {
      /* report the cancel failure below, not the read-back */
    }
    await deps.alert(e);
    return false;
  }
}

/**
 * Stops the Vault charge, then ends the pause. Returns false — without calling `end` — when Stripe refused, so the
 * caller can leave the pause open for the daily pass or the next attempt to retry.
 */
export async function closePauseSafely(
  deps: VaultStopDeps & { end: () => Promise<void> },
  vaultSubscriptionId: string | null,
): Promise<boolean> {
  if (vaultSubscriptionId && !(await vaultStopped(deps))) return false;
  await deps.end();
  return true;
}
