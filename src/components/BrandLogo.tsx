import { Link } from "@tanstack/react-router";

/** Came Through Audio logo + wordmark, for dark headers. */
export function BrandLogo({ showName = true }: { showName?: boolean }) {
  return (
    <Link to="/" aria-label="Came Through Audio home" className="flex items-center gap-3">
      <img src="/cta-logo-light.png" alt="Came Through Audio logo" className="h-9 w-auto object-contain" />
      {showName && <span className="text-lg font-bold tracking-tight">Came Through <span className="text-brand-electric">Audio</span></span>}
    </Link>
  );
}
