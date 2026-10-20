/** Returns a same-site path for redirects, or the fallback for anything that could leave the site. */
export function safeRedirectPath(n: unknown, fallback = "/"): string {
  if (typeof n !== "string" || !n.startsWith("/") || n.startsWith("//") || /[\\\s]/.test(n.slice(0, 2)) || n.includes("\\")) return fallback;
  try {
    const u = new URL(n, "https://cta.invalid");
    if (u.origin !== "https://cta.invalid") return fallback;
    return u.pathname + u.search + u.hash;
  } catch { return fallback; }
}
