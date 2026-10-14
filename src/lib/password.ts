export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { id: "lower", label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { id: "upper", label: "One capital letter", test: (p: string) => /[A-Z]/.test(p) },
  { id: "symbol", label: "One symbol (like ! @ # $)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export const passwordValid = (p: string) => PASSWORD_RULES.every((r) => r.test(p));

/** Remembers where an invited user should land after logging in or confirming email. */
export const RETURN_KEY = "cta_return_path";
export function rememberReturn(path: string) { try { localStorage.setItem(RETURN_KEY, path); } catch { /* ignore */ } }
export function takeReturn(): string | null {
  try {
    const p = localStorage.getItem(RETURN_KEY);
    return p && p.startsWith("/") && !p.startsWith("//") ? p : null;
  } catch { return null; }
}
export function clearReturn() { try { localStorage.removeItem(RETURN_KEY); } catch { /* ignore */ } }
