import lightLogo from "@/assets/cta-logo-light.png.asset.json";
import darkLogo from "@/assets/cta-logo-black.png.asset.json";

/** Came Through Audio logo + wordmark. `tone="light"` for dark backgrounds. */
export function BrandLogo({ tone = "light", showName = true }: { tone?: "light" | "dark"; showName?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <img src={tone === "light" ? lightLogo.url : darkLogo.url} alt="Came Through Audio logo" className="h-11 w-11 object-contain" />
      {showName && <span className="text-lg font-bold tracking-tight">Came Through <span className="text-primary">Audio</span></span>}
    </span>
  );
}
