import { luminance, type PdfBrand } from "@/lib/brand-kit";

/**
 * The branding a Financial Lab download carries. A member with a Personal Branding kit (their own paid kit, or the
 * one included with Catalog Management) gets their name, tagline and first colour; everyone else gets Came Through
 * Audio's. The server decides whether the kit may be used (`myBrand("lab")`); this module only maps what it returned,
 * so a signed-out member or a failed check can never break a download.
 */
export type LabBrandSource =
  | Pick<PdfBrand, "name" | "tagline" | "colors">
  | { name?: string | null; tagline?: string | null; colors?: string[] | null }
  | null
  | undefined;

export const LAB_BRAND_NAME = "Came Through Audio";
export const LAB_BRAND_TAGLINE = "Your First Stop Before Distribution";
export const LAB_BRAND_ACCENT = "#004AAD";

export type LabBrand = { name: string; tagline: string; accent: string };

export function labBrand(brand: LabBrandSource): LabBrand {
  return {
    name: brand?.name?.trim() || LAB_BRAND_NAME,
    // A kit with no tagline stays quiet rather than borrowing ours.
    tagline: brand ? (brand.tagline ?? "").trim() : LAB_BRAND_TAGLINE,
    accent: brand?.colors?.[0] || LAB_BRAND_ACCENT,
  };
}

/** Text colour for a filled band in the brand's accent: Primary Black on a light colour, white on a dark one. */
export const inkOn = (hex: string): "FF0B0B0B" | "FFFFFFFF" =>
  luminance(hex) > 0.5 ? "FF0B0B0B" : "FFFFFFFF";

/** `#2E073E` → the `FF2E073E` ARGB ExcelJS stores in a cell. */
export const argb = (hex: string): string => `FF${hex.replace(/^#/, "").slice(0, 6).toUpperCase()}`;
