import lightLogo from "@/assets/cta-logo-light.png.asset.json";

/** Came Through Audio logo + wordmark. */
export function BrandLogo({ showName = true }: { showName?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      {showName && <span className="text-lg font-bold tracking-tight">Came Through <span className="text-primary">Audio</span></span>}
    </span>
  );
}
