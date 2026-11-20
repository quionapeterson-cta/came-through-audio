/**
 * Sign in with Google (founder, 2026-11-20). The browser leaves the app for Google's consent screen and comes back to
 * our own /auth/callback, so the address is built in one place instead of three copies drifting apart.
 */
import { planSignupNext } from "@/lib/plans";

export const GOOGLE_CALLBACK_PATH = "/auth/callback";

/** Where Supabase sends the browser back: the origin it started from, never a domain written into the code. */
export function googleRedirectUrl(origin: string): string {
  return `${origin.replace(/\/+$/, "")}${GOOGLE_CALLBACK_PATH}`;
}

/**
 * A refused sign-in comes back as query parameters rather than a session, so the reason is read from the address bar.
 * Google's own description is preferred because it says what went wrong; the code alone is the fallback.
 */
export function oauthError(search: string): string | null {
  const params = new URLSearchParams(search);
  const code = params.get("error");
  const detail = params.get("error_description");
  if (!code && !detail) return null;
  // Some providers send a bare "access_denied" when the person closes the consent screen.
  const raw = (detail || code || "").replace(/\+/g, " ").trim();
  return raw || "That sign-in didn't finish.";
}

/**
 * Where the workspace opens afterwards: a saved invite path first (someone arrived from a split sheet or a signature
 * request), then the plan picked before signing up, so a Google sign-up still reaches the checkout they chose.
 */
export function googleLandingPath(plan: string | null, next: string | null): string {
  return next ?? planSignupNext(plan);
}
