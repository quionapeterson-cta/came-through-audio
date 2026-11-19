import { FONT_GROUPS, SINGLE_WEIGHT } from "@/lib/brand-fonts";
import { hasTier, type Tier } from "@/lib/plans";

/**
 * Personal Branding (PLAN-master-notes 3.6). A user's brand kit replaces the Came Through Audio header on documents
 * they send. Catalog Management includes it; anyone else can add it as its own $13.99-a-year subscription per kit (founder,
 * 2026-10-27; was $14.99, and a yearly subscription since 2026-11-19), on their split sheets and the contracts they make
 * (a $3.99 generated contract on any plan).
 */
export const BRANDING_LOOKUP_KEY = "branding_yearly";
export const BRANDING_PRICE = "$13.99";
/** A kit's subscription pays for this many days at a time; each renewal starts another year. */
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
  // Four that set the page, not just the header (founder, 2026-11-07).
  { id: "label", label: "Label", hint: "Centred: logo above a short rule, your name and tagline under it." },
  { id: "ticket", label: "Ticket", hint: "Your header in a thin box with punched notches, like a tear-off stub." },
  { id: "frame", label: "Frame", hint: "A thin colour frame around the whole first page." },
  { id: "editorial", label: "Editorial", hint: "Your name large on the left, your tagline in the right column." },
] as const;
export type KitStyle = (typeof KIT_STYLES)[number]["id"];
const isStyle = (v: unknown): v is KitStyle => KIT_STYLES.some((s) => s.id === v);

export type BrandKit = {
  /** Set once saved. A person can have several kits (one per business or project). */
  id?: string;
  /**
   * The paid year that keeps this kit on: the `sub:<subscription_id>` key of the purchase row that paid for it
   * (founder, 2026-11-19). Null on the kit included with Catalog Management, and on a kit no paid year is linked to.
   */
  paidKey?: string | null;
  name: string;
  tagline: string;
  /** #RRGGBB, as many as they like. The first colors the name, the second the tagline; all of them make the header stripe. */
  colors: string[];
  /** Palettes the member saved, so a whole set of colours comes back in one click (founder, 2026-11-07). */
  colorSets: ColorSet[];
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

/** Which side of the heading a kit's logo sits on. */
export type LogoSide = "left" | "right";
/** The line on the heading a logo lines up with. */
export type LogoSnap = "top" | "middle" | "bottom";

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
  /** The document's own title ("Producer Agreement"). Blank = Primary Black, the way every kit prints it today. */
  titleColor: string | null;
  /** Boxes and the cover frame. */
  corners: "rounded" | "square";
  /** The side of the heading the logo sits on. Left is how every kit printed before the control (founder, 2026-11-07). */
  logoAlign: LogoSide;
  /** The line of the heading the logo lines up with: the name's top, the settled middle, or its bottom. */
  logoSnap: LogoSnap;
  /**
   * Fine movement in mm, positive = down (founder, 2026-11-07). Artwork with empty space above its ink can never be
   * snapped into line by its box alone, so the member moves it until the ink looks level with the name.
   */
  logoNudge: number;
};
export const DEFAULT_KIT_OPTIONS: KitOptions = { watermark: false, cover: false, signature: "line", accent: null, titleColor: null, corners: "rounded", logoAlign: "left", logoSnap: "middle", logoNudge: 0 };

/** Saved options, cleaned: unknown values fall back to the defaults. */
export function kitOptions(v: unknown): KitOptions {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    watermark: o["watermark"] === true,
    cover: o["cover"] === true,
    signature: o["signature"] === "box" ? "box" : "line",
    accent: typeof o["accent"] === "string" && isHex(o["accent"]) ? o["accent"].toUpperCase() : null,
    titleColor: typeof o["titleColor"] === "string" && isHex(o["titleColor"]) ? o["titleColor"].toUpperCase() : null,
    corners: o["corners"] === "square" ? "square" : "rounded",
    logoAlign: o["logoAlign"] === "right" ? "right" : "left",
    logoSnap: o["logoSnap"] === "top" ? "top" : o["logoSnap"] === "bottom" ? "bottom" : "middle",
    logoNudge: logoNudgeValue(o["logoNudge"]),
  };
}

/* ----------------------------------------------------------------------------------------------------------------
 * Where the logo sits in the header (founder, 2026-11-07): the member picks a side, a line to line up with, and then
 * moves the picture by the millimetre, because a logo file often carries empty space above its ink and no snap can
 * guess where that ink starts. The PDF and the editor's guides read the same numbers from here.
 * --------------------------------------------------------------------------------------------------------------*/

/** How far the logo may be moved from its line, in mm: enough to fix any artwork's padding, not enough to lose it. */
export const LOGO_NUDGE_MAX = 12;

/** The logo's fine movement: one decimal, kept inside ±LOGO_NUDGE_MAX, anything unreadable is no movement at all. */
export function logoNudgeValue(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(-LOGO_NUDGE_MAX, Math.min(LOGO_NUDGE_MAX, n)) * 10) / 10;
}

/**
 * A kit header's heading on the page, in mm from the top of a letter page: the cap-top of the name, the line the logo
 * has always been centred on, and the bottom of the tagline — or of the name when the kit has no tagline.
 */
export const HEADING = {
  withTagline: { top: 15.1, centre: 19.4, bottom: 24.6 },
  nameOnly: { top: 17.5, centre: 19.4, bottom: 22.1 },
} as const;

/**
 * The logo's top edge in mm. `middle` is the settled 19.4 mm every kit has always printed at, so a kit that never
 * touches these controls prints exactly as it did; `top` and `bottom` put the picture's own edges on the heading's.
 * The member's fine movement is added last, and the whole thing is kept inside the header: never off the page, never
 * into the document title drawn at 42 mm.
 */
export function logoTop(o: { snap: LogoSnap; nudge: number; height: number; hasTagline: boolean }): number {
  const band = o.hasTagline ? HEADING.withTagline : HEADING.nameOnly;
  const y = o.snap === "top" ? band.top : o.snap === "bottom" ? band.bottom - o.height : band.centre - o.height / 2;
  return Math.max(6, Math.min(38 - o.height, y + logoNudgeValue(o.nudge)));
}

/** What a PDF needs: the kit plus the logo as a data URL, so it can be drawn without another request. */
export type PdfBrand = Omit<BrandKit, "logoPath"> & { logo: { dataUrl: string } | null };

/** Where a Personal Branding kit may replace our header: the paperwork and the two catalog downloads. */
export type BrandUse = "splits" | "contracts" | "lyrics" | "catalog";

/** New kits start in Arial, a neutral font that fits any brand (founder, 2026-10-27); Poppins is ours. */
export const DEFAULT_KIT_FONT = "Arial";
export const emptyKit = (name = ""): BrandKit => ({ name, tagline: "", colors: [], colorSets: [], font: DEFAULT_KIT_FONT, logoPath: null, logoPaths: [], showFooter: true, style: "classic", headerColor: null, paidKey: null, options: { ...DEFAULT_KIT_OPTIONS } });

export const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

/** "#4d8cff" → [77, 140, 255]. */
export function hexRgb(v: string): [number, number, number] {
  const n = parseInt(v.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A kit row from the database, cleaned: bad colors and unknown fonts are dropped instead of breaking a PDF. */
export function kitFromRow(r: { id?: string | null; name?: string | null; tagline?: string | null; colors?: string[] | null; font?: string | null; logo_path?: string | null; logo_paths?: string[] | null; show_footer?: boolean | null; style?: string | null; header_color?: string | null; options?: unknown; color_sets?: unknown; paid_key?: string | null } | null): BrandKit | null {
  if (!r) return null;
  // A kit saved before logo versions existed keeps its single logo as the first version.
  const saved = (Array.isArray(r.logo_paths) ? r.logo_paths : []).filter((p): p is string => typeof p === "string" && !!p);
  const active = r.logo_path || null;
  return {
    ...(r.id && { id: r.id }),
    paidKey: r.paid_key ?? null,
    name: (r.name ?? "").trim(),
    tagline: (r.tagline ?? "").trim(),
    colors: (r.colors ?? []).filter(isHex).map((c) => c.toUpperCase()),
    colorSets: kitColorSets(r.color_sets),
    font: BRAND_FONTS.includes(r.font ?? "") ? r.font! : DEFAULT_KIT_FONT,
    logoPath: active,
    logoPaths: active && !saved.includes(active) ? [active, ...saved] : saved,
    showFooter: r.show_footer !== false,
    style: isStyle(r.style) ? r.style : "classic",
    headerColor: r.header_color && isHex(r.header_color) ? r.header_color.toUpperCase() : null,
    options: kitOptions(r.options),
  };
}

type BrandingPurchase = { id?: string; kind: string; created_at: string; details: Record<string, string> };

/**
 * When one paid kit year ends, in milliseconds. Stripe's own `period_end` is what the money bought, so it wins; the
 * fixed year is only a fallback for a row written before it was stored (founder, 2026-11-19).
 */
const yearEnd = (p: BrandingPurchase): number => {
  const stated = p.details["period_end"] ? Date.parse(p.details["period_end"]) : NaN;
  if (Number.isFinite(stated)) return stated;
  const start = Date.parse(p.created_at);
  return Number.isFinite(start) ? start + BRANDING_DAYS * 86400000 : NaN;
};

/** Each paid year of a kit's subscription is one kit for one year (founder, 2026-10-27: $13.99 per kit per year). */
const activeBuys = (purchases: BrandingPurchase[], now: Date) =>
  purchases.filter((p) => p.kind === "branding" && !p.details["refunded_at"]).map(yearEnd)
    .filter((t) => Number.isFinite(t) && t > now.getTime());

/** The year a kit is in right now: when it ends, and whether another one follows it. */
export type BrandPeriod = { until: Date; renews: boolean };

/**
 * The kit's current year, or null when none is active now. `renews` is false once the subscription has been cancelled,
 * so the page can say the kit ends instead of promising a renewal (founder, 2026-11-19).
 */
export function brandingPeriod(purchases: BrandingPurchase[], now = new Date()): BrandPeriod | null {
  const years = purchases
    .filter((p) => p.kind === "branding" && !p.details["refunded_at"])
    .map((p) => ({ until: yearEnd(p), renews: p.details["renews"] !== "no" && !p.details["canceled_at"] }))
    .filter((y) => Number.isFinite(y.until) && y.until > now.getTime());
  if (!years.length) return null;
  // The year that runs latest decides when access ends, and whether another one follows it.
  const latest = years.reduce((a, b) => (b.until > a.until ? b : a));
  return { until: new Date(latest.until), renews: latest.renews };
}

/** When the last active kit purchase runs out, or null if none is active now. */
export function brandingUntil(purchases: BrandingPurchase[], now = new Date()): Date | null {
  return brandingPeriod(purchases, now)?.until ?? null;
}

/** How many kits can be used now: one with Catalog Management, plus one per active kit purchase. */
export function kitAllowance(tier: Tier, purchases: BrandingPurchase[], now = new Date()): number {
  return (hasTier(tier, "management") ? 1 : 0) + activeBuys(purchases, now).length;
}

/**
 * The key a kit row is linked by: the purchase row's own `sub:<subscription_id>`, or — for a year bought before the
 * subscription was stored (the sandbox rows of 2026-11-07 carry only `kind` and `userId`) — `row:<purchase id>`, so a
 * year that is still counted by `kitAllowance` can also name the kit it paid for (founder, 2026-11-19).
 */
export function kitYearKey(p: BrandingPurchase): string | null {
  if (p.details["subscription"]) return `sub:${p.details["subscription"]}`;
  return p.id ? `row:${p.id}` : null;
}

/** The key of every kit year that is running now: exactly what a kit row is linked by. */
export function activeKitKeys(purchases: BrandingPurchase[], now = new Date()): Set<string> {
  const keys = purchases
    .filter((p) => p.kind === "branding" && !p.details["refunded_at"])
    .filter((p) => { const end = yearEnd(p); return Number.isFinite(end) && end > now.getTime(); })
    .map((p) => kitYearKey(p) ?? "")
    .filter(Boolean);
  return new Set(keys);
}

/** What `usableKits` needs from a kit row: its id, and the paid year linked to it. */
export type KitLinkLike = { id?: string | null; paidKey?: string | null };

/**
 * The link to make for a member who has exactly one kit and a running paid year that names no kit (founder,
 * 2026-11-19). Their year was bought before the kit existed, or before this link did, so it can only belong to the one
 * kit they have: there is nothing to choose, and leaving it unlinked would charge them for a kit that can't print.
 * More than one kit is a choice, so this returns null and the member picks (or the purchase names the kit).
 */
export function autoBindKit(kits: KitLinkLike[], paid: Set<string>): { kitId: string; key: string } | null {
  if (kits.length !== 1) return null;
  const kit = kits[0]!;
  if (!kit.id) return null;
  // Already tied to a year that is still running: nothing to do.
  if (kit.paidKey && paid.has(kit.paidKey)) return null;
  const key = [...paid].find((k) => k !== kit.paidKey);
  return key ? { kitId: kit.id, key } : null;
}

/**
 * Which kits this account may use right now, in the order documents pick them (founder, 2026-11-19).
 *
 * A paid year unlocks the kit it was actually bought for: the kit row carries that subscription's key (`paidKey`, set
 * by the server), and the key has to be in `paid` (the years still running). Nothing is guessed from a kit's age.
 * The kit included with Catalog Management is the oldest kit, so the default never moves under a member.
 *
 * An unlinked paid year (bought before its kit existed, or written before this link did) fills the next free slot
 * with the newest unlinked kit, because an extra kit is bought and then created. A kit whose own year has lapsed is
 * only picked when a running year has no unlinked kit to name: that is the member who renewed from the locked screen,
 * where no kit could be named, and leaving their own kit locked after paying would be the worse answer.
 */
export function usableKits<T extends KitLinkLike>(kits: T[], allowance: number, included: boolean, paid: Set<string>): T[] {
  const slots = Math.max(0, allowance);
  if (!slots) return [];
  const chosen: T[] = [];
  const take = (k: T | undefined) => { if (k && chosen.length < slots && !chosen.includes(k)) chosen.push(k); };
  const isPaid = (k: T) => !!k.paidKey && paid.has(k.paidKey);
  const linked = kits.filter(isPaid).length;
  // The included kit is the oldest one, linked or not: the kit a document falls back to stays the same.
  if (included) take(kits[0]);
  // Exactly the kits their running paid years were bought for.
  for (const k of kits) if (isPaid(k)) take(k);
  // A year still waiting for its kit goes to the newest unlinked kit.
  for (let i = kits.length - 1; i >= 0; i--) {
    const k = kits[i]!;
    if (k.paidKey && !paid.has(k.paidKey)) continue;
    take(k);
  }
  // A running year with no unlinked kit left takes the newest kit whose own year lapsed, so a member who renewed from
  // the locked screen (which cannot name a kit) prints with the kit they already have instead of nothing at all.
  if (linked < paid.size) {
    for (let i = kits.length - 1; i >= 0; i--) {
      const k = kits[i]!;
      if (!k.paidKey || paid.has(k.paidKey)) continue;
      take(k);
    }
  }
  return chosen;
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
export type ContrastWarning = { field: "name" | "tagline" | "sectionTitles" | "documentTitle"; label: string; hex: string; ratio: number; severe: boolean };

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
  // The document title is 24 pt bold, so it may go to the large-text ratio.
  check("documentTitle", "Your document title", kit.options.titleColor, CONTRAST_LARGE);
  if (kit.options.accent) check("sectionTitles", "Your second accent colour", kit.options.accent, CONTRAST_LARGE);
  return out;
}

/* ----------------------------------------------------------------------------------------------------------------
 * Saved colour sets (founder, 2026-11-07): a palette the member names once and can put back in one click. Kept on the
 * kit's row (`color_sets`), so the palettes follow them to any device and each business keeps its own.
 * --------------------------------------------------------------------------------------------------------------*/

/** A named palette. */
export type ColorSet = { name: string; colors: string[] };
/** A kit keeps this many palettes, and a palette this many colours: enough for any brand, small enough to draw. */
export const MAX_COLOR_SETS = 20;
export const MAX_SET_COLORS = 20;
export const COLOR_SET_NAME_MAX = 40;

/** Saved palettes, cleaned: an unnamed set or an unreadable colour is dropped instead of breaking the editor. */
export function kitColorSets(v: unknown): ColorSet[] {
  if (!Array.isArray(v)) return [];
  const out: ColorSet[] = [];
  for (const raw of v) {
    const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const name = typeof o["name"] === "string" ? o["name"].trim().slice(0, COLOR_SET_NAME_MAX) : "";
    const colors = (Array.isArray(o["colors"]) ? o["colors"] : [])
      .filter((c): c is string => typeof c === "string" && isHex(c)).map((c) => c.toUpperCase()).slice(0, MAX_SET_COLORS);
    if (!name || !colors.length) continue;
    if (out.some((s) => s.name.toLowerCase() === name.toLowerCase())) continue;
    out.push({ name, colors });
    if (out.length >= MAX_COLOR_SETS) break;
  }
  return out;
}

/** Saves a palette under its name, replacing one already saved under that name; the newest set sits last. */
export function withColorSet(sets: ColorSet[], raw: { name: string; colors: string[] }): ColorSet[] {
  const name = raw.name.trim().slice(0, COLOR_SET_NAME_MAX);
  const colors = raw.colors.filter(isHex).map((c) => c.toUpperCase()).slice(0, MAX_SET_COLORS);
  if (!name || !colors.length) return sets;
  return [...sets.filter((s) => s.name.toLowerCase() !== name.toLowerCase()), { name, colors }].slice(-MAX_COLOR_SETS);
}

/** Deletes a saved palette by its name. */
export const withoutColorSet = (sets: ColorSet[], name: string): ColorSet[] => sets.filter((s) => s.name !== name);

/* ----------------------------------------------------------------------------------------------------------------
 * Undo and redo in the kit editor (founder, 2026-11-07): whole-kit snapshots, so a restyle can be taken back without
 * retyping every colour. History belongs to the kit being edited and is cleared when another kit is opened.
 * --------------------------------------------------------------------------------------------------------------*/

export const HISTORY_LIMIT = 50;
export type KitHistory = { past: BrandKit[]; future: BrandKit[] };
export const emptyHistory = (): KitHistory => ({ past: [], future: [] });

/** Records the kit as it was before a change and makes that change the newest one: redo starts fresh. */
export const recordHistory = (h: KitHistory, previous: BrandKit): KitHistory =>
  ({ past: [...h.past, previous].slice(-HISTORY_LIMIT), future: [] });

/** One step back, or null when there is nothing to go back to. The kit being left becomes the next redo. */
export function undoHistory(h: KitHistory, current: BrandKit): { history: KitHistory; kit: BrandKit } | null {
  const previous = h.past[h.past.length - 1];
  if (!previous) return null;
  return { history: { past: h.past.slice(0, -1), future: [current, ...h.future].slice(0, HISTORY_LIMIT) }, kit: previous };
}

/** One step forward again, or null when nothing was undone. */
export function redoHistory(h: KitHistory, current: BrandKit): { history: KitHistory; kit: BrandKit } | null {
  const next = h.future[0];
  if (!next) return null;
  return { history: { past: [...h.past, current].slice(-HISTORY_LIMIT), future: h.future.slice(1) }, kit: next };
}
