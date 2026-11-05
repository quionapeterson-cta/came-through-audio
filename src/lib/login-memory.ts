/**
 * The email this browser last signed in with (founder, 2026-11-05). `/login` pre-fills it so a returning member types
 * one thing — a password — instead of the address they have already given us. It is only ever an email, never a token
 * or a session, and "Use a different account" clears it. Per browser, like every other `cta.*` preference.
 */
export const LOGIN_EMAIL_KEY = "cta.loginEmail";

export function rememberLoginEmail(email: string) {
  const value = email.trim().toLowerCase();
  try {
    if (value) localStorage.setItem(LOGIN_EMAIL_KEY, value);
  } catch {
    /* storage blocked: they type it once more, nothing breaks */
  }
}

export function lastLoginEmail(): string | null {
  try {
    const value = localStorage.getItem(LOGIN_EMAIL_KEY)?.trim();
    return value ? value : null;
  } catch {
    return null;
  }
}

export function forgetLoginEmail() {
  try {
    localStorage.removeItem(LOGIN_EMAIL_KEY);
  } catch {
    /* storage blocked */
  }
}
