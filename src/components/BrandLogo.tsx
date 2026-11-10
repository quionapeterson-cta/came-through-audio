import { Link } from "@tanstack/react-router";
import { MARK_BOX, MARK_TUCK } from "@/components/BrandLockup";

/**
 * Came Through Audio logo + wordmark. Dark headers (default) get the white logo with Electric Cobalt "Audio";
 * light headers get the black logo with Cobalt "Audio" (BRANDING.md §2).
 *
 * The brand mark now stands in for the "C" of "Came Through" (founder, 11/3/2026), so the name reads as the glyph plus
 * "ame Through Audio". The mark ships in two tones, matching the logo: white on dark headers, ink on light ones.
 * `alt=""` because the link already says the name; nothing is lost for screen readers.
 *
 * The CTA script logo is back at `h-8`, twice the height it was halved to (founder, 2026-11-10): the signature is the
 * brand's own mark and reads at its full size beside the wordmark, which is how the header sat before the halving. It
 * stays hidden on a phone, where the picture and the name were two marks side by side (founder, 2026-11-05), and
 * `showMark={false}` keeps the name alone.
 */
export function BrandLogo({ showName = true, showMark = true, tone = "dark" }: { showName?: boolean; showMark?: boolean; tone?: "dark" | "light" }) {
  const light = tone === "light";
  return (
    <Link to="/" aria-label="Came Through Audio home" className="flex items-center gap-3">
      {showMark && <img src={light ? "/cta-logo-dark.png" : "/cta-logo-light.png"} alt="Came Through Audio logo"
        className={`h-8 w-auto object-contain ${showName ? "hidden sm:block" : ""}`} />}
      {showName && <span className={`flex items-center text-base font-bold tracking-tight sm:text-lg ${light ? "text-foreground" : ""}`}>
        <img src={light ? "/cta-mark-dark.png" : "/cta-mark-light.png"} alt="" aria-hidden className={`${MARK_BOX} ${MARK_TUCK}`} />
        <span>ame Through <span className={light ? "text-primary" : "text-brand-electric"}>Audio</span></span>
      </span>}
    </Link>
  );
}
