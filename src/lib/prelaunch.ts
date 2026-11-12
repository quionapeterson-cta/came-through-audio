/**
 * The pre-launch gate (founder, 2026-11-12): the site is readable, but new accounts and payments are closed until the
 * launch switch is flipped. One constant turns all of it off together.
 *
 * This is a shop sign, not a lock. The passkey ships inside the bundle, so it only keeps honest visitors out of a build
 * that isn't finished; real protection is the staging passcode on the site and the server-side checkout guard.
 *
 * Testers get in three ways: `?preview=true` in any link, the passkey on the sign-up card, or simply being signed in.
 */
import { supabase } from "@/integrations/supabase/client";

export const IS_PRELAUNCH = true;
/** Empty this string to disable passkey entry entirely (a tester link still works). */
export const TESTER_PASSKEY = "CTALAB2026";

const STORE_KEY = "cta.prelaunch.unlocked";
/** Chosen from the banner to see the public view while still signed in. */
export const LOCKED_BY_TESTER = "locked";
export const UNLOCKED_BY_TESTER = "unlocked";

/** What a visitor reads when they try to pay before launch. Nothing is ever charged. */
export const PRELAUNCH_CHECKOUT_CLOSED =
  "Checkout isn't open yet — Came Through Audio is still in pre-launch, so nothing was charged. Check back soon, or contact support and we'll help.";

/** The passkey, trimmed; case matters. An empty constant never matches, so it can be switched off. */
export function passkeyAccepted(value: string): boolean {
  return TESTER_PASSKEY.trim().length > 0 && value.trim() === TESTER_PASSKEY.trim();
}

/**
 * A tester is unlocked by a link, the passkey or their own session — unless they picked the public view, which has to
 * win over a session or the Lock button on the banner would do nothing while signed in.
 */
export function testerUnlocked(stored: string | null, signedIn: boolean): boolean {
  if (stored === LOCKED_BY_TESTER) return false;
  return stored === UNLOCKED_BY_TESTER || signedIn;
}

/** Is this visitor meeting a lock right now? */
export function gatedFor(stored: string | null, signedIn: boolean): boolean {
  return IS_PRELAUNCH && !testerUnlocked(stored, signedIn);
}

export function readTesterState(): string | null {
  try {
    return window.sessionStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
}

/** Fires in this tab when a tester unlocks or locks, so the banner and the sign-up card never disagree. */
export const TESTER_EVENT = "cta:prelaunch-changed";

/** Session-scoped on purpose: a tester link unlocks this browser for this sitting, not forever. */
export function writeTesterState(value: string | null) {
  try {
    if (value) window.sessionStorage.setItem(STORE_KEY, value);
    else window.sessionStorage.removeItem(STORE_KEY);
  } catch {
    /* Storage blocked: the page still unlocks, it just won't survive a reload. */
  }
  // `storage` events never fire in the tab that wrote them, so the passkey on the sign-up card would leave the banner
  // showing the public view without this.
  try {
    window.dispatchEvent(new Event(TESTER_EVENT));
  } catch {
    /* No window (tests): nothing to notify. */
  }
}

export function previewInLink(search: string): boolean {
  try {
    return new URLSearchParams(search).get("preview") === "true";
  } catch {
    return false;
  }
}

/**
 * Whatever would stop a payment before Stripe is called, or `null` to let it through. The server refuses a mismatched
 * payment environment; this refuses the visitor who was told not to pay yet.
 */
export async function prelaunchCheckoutBlocked(): Promise<string | null> {
  if (!IS_PRELAUNCH) return null;
  const stored = readTesterState();
  if (stored === LOCKED_BY_TESTER) return PRELAUNCH_CHECKOUT_CLOSED;
  if (stored === UNLOCKED_BY_TESTER) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ? null : PRELAUNCH_CHECKOUT_CLOSED;
}
