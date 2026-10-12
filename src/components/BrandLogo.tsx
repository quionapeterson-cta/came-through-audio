import lightLogo from "@/assets/cta-logo-light.png.asset.json";

/** Came Through Audio logo + wordmark, for dark headers. */
export function BrandLogo({ showName = true }: { showName?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <img src={lightLogo.url} alt="Came Through Audio logo" className="h-9 w-auto object-contain" />
      {showName && <span className="text-lg font-bold tracking-tight">Came Through <span className="text-primary">Audio</span></span>}
    </span>
  );
}
