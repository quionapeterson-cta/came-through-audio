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

/** Contract layouts a kit can use (founder, 2026-10-27). */
export const KIT_STYLES = [
  { id: "classic", label: "Classic", hint: "Logo left, thin color rule under the header." },
  { id: "sidebar", label: "Sidebar", hint: "A slim color bar down the left edge of every page." },
  { id: "banner", label: "Banner", hint: "A solid color band across the top." },
  { id: "minimal", label: "Minimal", hint: "No header band; your logo small in the footer." },
] as const;
export type KitStyle = (typeof KIT_STYLES)[number]["id"];
const isStyle = (v: unknown): v is KitStyle => KIT_STYLES.some((s) => s.id === v);

export type BrandKit = {
  /** Set once saved. A person can have several kits (one per business or project). */
  id?: string;
  name: string;
  tagline: string;
  /** #RRGGBB, as many as they like. The first colors the name, the second the tagline; all of them make the header stripe. */
  colors: string[];
  font: BrandFont;
  logoPath: string | null;
  /** Every logo version uploaded for this kit, so a member can switch one in without rebuilding the kit (founder, 2026-11-06). */
  logoPaths: string[];
  showFooter: boolean;
  style: KitStyle;
  /** Contract section titles. Blank = Primary Black #0b0b0b, so our cobalt never clashes with their colors. */
  headerColor: string | null;
  options: KitOptions;
};

/** Extra contract styling per kit (founder, 2026-10-28). */
export type KitOptions = {
  /** A faint copy of the logo behind the text on page 1. */
  watermark: boolean;
  /** An opening page with the logo, name and contract title. */
  cover: boolean;
  /** Each signer gets a signature line, or a box around their signature block. */
  signature: "line" | "box";
  /** Signer labels, signature lines and boxes, and the footer rule. Blank = the section title color. */
  accent: string | null;
  /** Boxes and the cover frame. */
  corners: "rounded" | "square";
};
export const DEFAULT_KIT_OPTIONS: KitOptions = { watermark: false, cover: false, signature: "line", accent: null, corners: "rounded" };

/** Saved options, cleaned: unknown values fall back to the defaults. */
export function kitOptions(v: unknown): KitOptions {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    watermark: o["watermark"] === true,
    cover: o["cover"] === true,
    signature: o["signature"] === "box" ? "box" : "line",
    accent: typeof o["accent"] === "string" && isHex(o["accent"]) ? o["accent"].toUpperCase() : null,
    corners: o["corners"] === "square" ? "square" : "rounded",
  };
}

/** What a PDF needs: the kit plus the logo as a data URL, so it can be drawn without another request. */
export type PdfBrand = Omit<BrandKit, "logoPath"> & { logo: { dataUrl: string } | null };

/** Where a Personal Branding kit may replace our header: the paperwork and the two catalog downloads. */
export type BrandUse = "splits" | "contracts" | "lyrics" | "catalog";

/** New kits start in Arial, a neutral font that fits any brand (founder, 2026-10-27); Poppins is ours. */
export const DEFAULT_KIT_FONT = "Arial";
export const emptyKit = (name = ""): BrandKit => ({ name, tagline: "", colors: [], font: DEFAULT_KIT_FONT, logoPath: null, logoPaths: [], showFooter: true, style: "classic", headerColor: null, options: { ...DEFAULT_KIT_OPTIONS } });

export const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

/** "#4d8cff" → [77, 140, 255]. */
export function hexRgb(v: string): [number, number, number] {
  const n = parseInt(v.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A kit row from the database, cleaned: bad colors and unknown fonts are dropped instead of breaking a PDF. */
export function kitFromRow(r: { id?: string | null; name?: string | null; tagline?: string | null; colors?: string[] | null; font?: string | null; logo_path?: string | null; logo_paths?: string[] | null; show_footer?: boolean | null; style?: string | null; header_color?: string | null; options?: unknown } | null): BrandKit | null {
  if (!r) return null;
  // A kit saved before logo versions existed keeps its single logo as the first version.
  const saved = (Array.isArray(r.logo_paths) ? r.logo_paths : []).filter((p): p is string => typeof p === "string" && !!p);
  const active = r.logo_path || null;
  return {
    ...(r.id && { id: r.id }),
    name: (r.name ?? "").trim(),
    tagline: (r.tagline ?? "").trim(),
    colors: (r.colors ?? []).filter(isHex).map((c) => c.toUpperCase()),
    font: BRAND_FONTS.includes(r.font ?? "") ? r.font! : DEFAULT_KIT_FONT,
    logoPath: active,
    logoPaths: active && !saved.includes(active) ? [active, ...saved] : saved,
    showFooter: r.show_footer !== false,
    style: isStyle(r.style) ? r.style : "classic",
    headerColor: r.header_color && isHex(r.header_color) ? r.header_color.toUpperCase() : null,
    options: kitOptions(r.options),
  };
}

type BrandingPurchase = { kind: string; created_at: string; details: Record<string, string> };

/** Each Branding Kit purchase is one kit for one year (founder, 2026-10-27: $13.99 per kit per year). */
const activeBuys = (purchases: BrandingPurchase[], now: Date) =>
  purchases.filter((p) => p.kind === "branding" && !p.details["refunded_at"]).map((p) => Date.parse(p.created_at))
    .filter((t) => Number.isFinite(t) && t + BRANDING_DAYS * 86400000 > now.getTime());

/** When the last active kit purchase runs out, or null if none is active now. */
export function brandingUntil(purchases: BrandingPurchase[], now = new Date()): Date | null {
  const buys = activeBuys(purchases, now);
  return buys.length ? new Date(Math.max(...buys) + BRANDING_DAYS * 86400000) : null;
}

/** How many kits can be used now: one with Catalog Management, plus one per active kit purchase. */
export function kitAllowance(tier: Tier, purchases: BrandingPurchase[], now = new Date()): number {
  return (hasTier(tier, "management") ? 1 : 0) + activeBuys(purchases, now).length;
}

/** Where their brand kit shows: everywhere with Catalog Management or the add-on (any plan). */
export function brandAccess(tier: Tier, addOnUntil: Date | null): Record<BrandUse, boolean> {
  const on = hasTier(tier, "management") || !!addOnUntil;
  return { contracts: on, splits: on, lyrics: on, catalog: on };
}

/** A kit is worth drawing once it has a name or a logo; otherwise the Came Through Audio header stays. */
export const kitReady = (k: Pick<BrandKit, "name" | "logoPath"> | null) => !!k && (!!k.name || !!k.logoPath);

/**
 * How readable a colour is, the WCAG way (founder, 2026-11-06): relative luminance, then the contrast ratio between two
 * colours. The page a PDF prints on is white, so that is what the editor checks against.
 */
export function luminance(hex: string): number {
  const [r, g, b] = hexRgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 1 (identical) to 21 (black on white), rounded to one decimal. */
export function contrastRatio(a: string, b: string): number {
  if (!isHex(a) || !isHex(b)) return 21;
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 10) / 10;
}

/** Body text needs 4.5:1; large bold text may go to 3:1. */
export const CONTRAST_MIN = 4.5;
export const CONTRAST_LARGE = 3;

/** A colour that will be hard to read where it is drawn. A warning only: any colour can still be saved. */
export type ContrastWarning = { field: "name" | "tagline" | "sectionTitles"; label: string; hex: string; ratio: number; severe: boolean };

/**
 * Which of the kit's colours will be hard to read on the white page (founder, 2026-11-06). A banner puts the name and
 * tagline on a band of their first colour, where the PDF picks readable text automatically, so only the section titles
 * are checked for that style.
 */
export function contrastWarnings(kit: Pick<BrandKit, "colors" | "headerColor" | "style" | "options">, page = "#FFFFFF"): ContrastWarning[] {
  const out: ContrastWarning[] = [];
  const check = (field: ContrastWarning["field"], label: string, value: string | null | undefined, min: number) => {
    if (!value || !isHex(value)) return;
    const ratio = contrastRatio(value, page);
    if (ratio >= min) return;
    out.push({ field, label, hex: value.toUpperCase(), ratio, severe: ratio < CONTRAST_LARGE });
  };
  if (kit.style !== "banner") {
    check("name", "Your name", kit.colors[0], CONTRAST_LARGE);
    check("tagline", "Your tagline", kit.colors[1], CONTRAST_MIN);
  }
  check("sectionTitles", "Your section titles", kit.headerColor, CONTRAST_MIN);
  if (kit.options.accent) check("sectionTitles", "Your second accent colour", kit.options.accent, CONTRAST_LARGE);
  return out;
}
