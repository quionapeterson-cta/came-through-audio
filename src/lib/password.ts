/** Passwords and fragments attackers try first; a password containing one fails the "not easy to guess" rule. */
const COMMON = ["password", "passw0rd", "123456", "12345678", "qwerty", "abc123", "letmein", "welcome", "iloveyou", "admin", "music", "camethrough"];

export const PASSWORD_RULES = [
  // 12 minimum (founder, 2026-10-25). Supabase → Authentication → Email → Minimum password length = 12 is the real lock.
  { id: "length", label: "At least 12 characters", test: (p: string) => p.length >= 12 },
  { id: "lower", label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { id: "upper", label: "One capital letter", test: (p: string) => /[A-Z]/.test(p) },
  { id: "number", label: "One number", test: (p: string) => /[0-9]/.test(p) },
  { id: "symbol", label: "One symbol (like ! @ # $)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
  { id: "common", label: "Not an easy-to-guess word (like \"password\" or \"123456\")", test: (p: string) => !!p && !COMMON.some((c) => p.toLowerCase().includes(c)) },
];

export const passwordValid = (p: string) => PASSWORD_RULES.every((r) => r.test(p));

/** 0–4 for the strength bar: rules passed, plus credit for extra length (16+ and 20+ characters). */
export function passwordStrength(p: string) {
  if (!p) return 0;
  const passed = PASSWORD_RULES.filter((r) => r.test(p)).length / PASSWORD_RULES.length;
  return Math.min(4, Math.round(passed * 2 + (p.length >= 16 ? 1 : 0) + (p.length >= 20 ? 1 : 0)));
}

/** Remembers where an invited user should land after logging in or confirming email. */
export const RETURN_KEY = "cta_return_path";
export function rememberReturn(path: string) { try { localStorage.setItem(RETURN_KEY, path); } catch { /* ignore */ } }
/** Reads and clears the saved path in one step, so a stale invite link can never trap anyone in a redirect loop. */
export function takeReturn(): string | null {
  try {
    const p = localStorage.getItem(RETURN_KEY);
    localStorage.removeItem(RETURN_KEY);
    return p && p.startsWith("/") && !p.startsWith("//") ? p : null;
  } catch { return null; }
}
export function clearReturn() { try { localStorage.removeItem(RETURN_KEY); } catch { /* ignore */ } }
