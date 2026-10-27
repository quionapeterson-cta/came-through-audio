import { FONT_GROUPS, SINGLE_WEIGHT } from "@/lib/brand-fonts";
import { hasTier, type Tier } from "@/lib/plans";

/**
 * Personal Branding (PLAN-master-notes 3.6). A user's brand kit replaces the Came Through Audio header on documents
 * they send. Catalog Management includes it; anyone else can add it for $13.99 a year per kit (founder, 2026-10-27; was $14.99), on their
 * split sheets and the contracts they make (a $3.99 generated contract on any plan).
 */
export const BRANDING_LOOKUP_KEY = "branding_yearly";
export const BRANDING_PRICE = "$13.99";
/** One add-on purchase covers this many days; buying again early adds a year after the current one ends. */
export const BRANDING_DAYS = 365;

export const BRAND_FONTS: string[] = FONT_GROUPS.flatMap((g) => g.fonts);
export type BrandFont = string;
/** Header font files in public/fonts: medium for the tagline, bold for the name (one file for single-weight fonts). */
export const fontFile = (f: BrandFont, weight: "medium" | "bold") => `${f.replace(/ /g, "")}-${weight === "bold" || SINGLE_WEIGHT.has(f) ? "Bold" : "Medium"}`;

export type BrandKit = {
  name: string;
  tagline: string;
  /** #RRGGBB, as many as they like. The first colors the name, the second the tagline; all of them make the header stripe. */
  colors: string[];
  font: BrandFont;
  logoPath: string | null;
  showFooter: boolean;
};

/** What a PDF needs: the kit plus the logo as a data URL, so it can be drawn without another request. */
export type PdfBrand = Omit<BrandKit, "logoPath"> & { logo: { dataUrl: string } | null };

export type BrandUse = "splits" | "contracts";

/** New kits start in Arial, a neutral font that fits any brand (founder, 2026-10-27); Poppins is ours. */
export const DEFAULT_KIT_FONT = "Arial";
export const emptyKit = (name = ""): BrandKit => ({ name, tagline: "", colors: [], font: DEFAULT_KIT_FONT, logoPath: null, showFooter: true });

export const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

/** "#4d8cff" → [77, 140, 255]. */
export function hexRgb(v: string): [number, number, number] {
  const n = parseInt(v.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A kit row from the database, cleaned: bad colors and unknown fonts are dropped instead of breaking a PDF. */
export function kitFromRow(r: { name?: string | null; tagline?: string | null; colors?: string[] | null; font?: string | null; logo_path?: string | null; show_footer?: boolean | null } | null): BrandKit | null {
  if (!r) return null;
  return {
    name: (r.name ?? "").trim(),
    tagline: (r.tagline ?? "").trim(),
    colors: (r.colors ?? []).filter(isHex).map((c) => c.toUpperCase()),
    font: BRAND_FONTS.includes(r.font ?? "") ? r.font! : DEFAULT_KIT_FONT,
    logoPath: r.logo_path || null,
    showFooter: r.show_footer !== false,
  };
}

type BrandingPurchase = { kind: string; created_at: string; details: Record<string, string> };

/** When the Personal Branding add-on runs out, or null if they don't have it now. Purchases stack, a year each. */
export function brandingUntil(purchases: BrandingPurchase[], now = new Date()): Date | null {
  const buys = purchases.filter((p) => p.kind === "branding" && !p.details["refunded_at"]).map((p) => Date.parse(p.created_at)).filter(Number.isFinite).sort((a, b) => a - b);
  let end = 0;
  for (const t of buys) end = Math.max(end, t) + BRANDING_DAYS * 86400000;
  return end > now.getTime() ? new Date(end) : null;
}

/** Where their brand kit shows: everywhere with Catalog Management or the add-on (any plan). */
export function brandAccess(tier: Tier, addOnUntil: Date | null): Record<BrandUse, boolean> {
  const on = hasTier(tier, "management") || !!addOnUntil;
  return { contracts: on, splits: on };
}

/** A kit is worth drawing once it has a name or a logo; otherwise the Came Through Audio header stays. */
export const kitReady = (k: Pick<BrandKit, "name" | "logoPath"> | null) => !!k && (!!k.name || !!k.logoPath);
