import { Link } from "@tanstack/react-router";
import { MARK_BOX } from "@/components/BrandLockup";

/**
 * Came Through Audio logo + wordmark. Dark headers (default) get the white logo with Electric Cobalt "Audio";
 * light headers get the black logo with Cobalt "Audio" (BRANDING.md §2).
 *
 * The brand mark now stands in for the "C" of "Came Through" (founder, 11/3/2026), so the name reads as the glyph plus
 * "ame Through Audio". The mark ships in two tones, matching the logo: white on dark headers, ink on light ones.
 * `alt=""` because the link already says the name; nothing is lost for screen readers.
 */
export function BrandLogo({ showName = true, tone = "dark" }: { showName?: boolean; tone?: "dark" | "light" }) {
  const light = tone === "light";
  return (
    <Link to="/" aria-label="Came Through Audio home" className="flex items-center gap-3">
      {/* On a phone the logo picture and the wordmark were two marks side by side (founder, 2026-11-05), which is what
          pushed the C off the name. Small screens show the wordmark alone; the logo returns from sm up, and a
          showName={false} header keeps its picture at every size because that is all it has. */}
      <img src={light ? "/cta-logo-dark.png" : "/cta-logo-light.png"} alt="Came Through Audio logo"
        className={`h-9 w-auto object-contain ${showName ? "hidden sm:block" : ""}`} />
      {showName && <span className={`flex items-center text-base font-bold tracking-tight sm:text-lg ${light ? "text-foreground" : ""}`}>
        <img src={light ? "/cta-mark-dark.png" : "/cta-mark-light.png"} alt="" aria-hidden className={`${MARK_BOX} mr-[0.02em]`} />
        <span>ame Through <span className={light ? "text-primary" : "text-brand-electric"}>Audio</span></span>
      </span>}
    </Link>
  );
}
