import { hasTier, type Tier } from "@/lib/plans";

/**
 * Personal Branding (PLAN-master-notes 3.6). A user's brand kit replaces the Came Through Audio header on documents
 * they send: Catalog Management includes it on contracts and split sheets; the add-on covers split sheets only.
 */
export const BRANDING_LOOKUP_KEY = "branding_yearly";
export const BRANDING_PRICE = "$14.99";
/** One add-on purchase covers this many days; buying again early adds a year after the current one ends. */
export const BRANDING_DAYS = 365;

export const BRAND_FONTS = ["Poppins", "Montserrat", "Playfair Display", "Roboto Slab"] as const;
export type BrandFont = (typeof BRAND_FONTS)[number];
/** Header font files in public/fonts: medium for the tagline, bold for the name. */
export const fontFile = (f: BrandFont, weight: "medium" | "bold") => `${f.replace(/ /g, "")}-${weight === "bold" ? "Bold" : "Medium"}`;

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

export const emptyKit = (name = ""): BrandKit => ({ name, tagline: "", colors: [], font: "Poppins", logoPath: null, showFooter: true });

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
    font: (BRAND_FONTS as readonly string[]).includes(r.font ?? "") ? (r.font as BrandFont) : "Poppins",
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

/** Where their brand kit shows: Catalog Management everywhere, the add-on on split sheets. */
export function brandAccess(tier: Tier, addOnUntil: Date | null): Record<BrandUse, boolean> {
  const management = hasTier(tier, "management");
  return { contracts: management, splits: management || !!addOnUntil };
}

/** A kit is worth drawing once it has a name or a logo; otherwise the Came Through Audio header stays. */
export const kitReady = (k: Pick<BrandKit, "name" | "logoPath"> | null) => !!k && (!!k.name || !!k.logoPath);
