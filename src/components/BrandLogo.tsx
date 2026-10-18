import { Link } from "@tanstack/react-router";

/**
 * Came Through Audio logo + wordmark. Dark headers (default) get the white logo with Electric Cobalt "Audio";
 * light headers get the black logo with Cobalt "Audio" (BRANDING.md §2).
 */
export function BrandLogo({ showName = true, tone = "dark" }: { showName?: boolean; tone?: "dark" | "light" }) {
  const light = tone === "light";
  return (
    <Link to="/" aria-label="Came Through Audio home" className="flex items-center gap-3">
      <img src={light ? "/cta-logo-dark.png" : "/cta-logo-light.png"} alt="Came Through Audio logo" className="h-9 w-auto object-contain" />
      {showName && <span className={`text-lg font-bold tracking-tight ${light ? "text-foreground" : ""}`}>Came Through <span className={light ? "text-primary" : "text-brand-electric"}>Audio</span></span>}
    </Link>
  );
}
