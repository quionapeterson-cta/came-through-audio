import type { jsPDF as JsPDF } from "jspdf";
import { LOGO_PATH, LOGO_RATIO, LOGO_VIEWBOX } from "@/lib/brand-logo";
import { SITE_URL } from "@/lib/email-layout";
import { fontFile, hexRgb, type BrandFont, type PdfBrand } from "@/lib/brand-kit";
import { SYSTEM_FONTS } from "@/lib/brand-fonts";

export const COBALT: [number, number, number] = [0, 74, 173];
export const INK: [number, number, number] = [11, 11, 11];
export const MUTED: [number, number, number] = [82, 82, 82];
export const RULE: [number, number, number] = [222, 226, 234];
export const PANEL: [number, number, number] = [246, 248, 252];
/** Page side margin in mm. */
export const MARGIN = 20;

export type Weight = "regular" | "medium" | "semibold" | "bold";
const WEIGHT_FILES: Record<Weight, string> = { regular: "Poppins-Regular", medium: "Poppins-Medium", semibold: "Poppins-SemiBold", bold: "Poppins-Bold" };
let fontCache: Promise<Record<Weight, string> | null> | undefined;
const withPoppins = new WeakSet<JsPDF>();

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

/** Poppins (the brand font) is fetched once per session; PDFs fall back to Helvetica if it can't load. */
function loadPoppins() {
  fontCache ??= Promise.all((Object.entries(WEIGHT_FILES) as [Weight, string][]).map(async ([w, file]) => {
    const res = await fetch(`/fonts/${file}.ttf`);
    if (!res.ok) throw new Error(`font ${file}`);
    return [w, toBase64(await res.arrayBuffer())] as const;
  })).then((pairs) => Object.fromEntries(pairs) as Record<Weight, string>).catch(() => { fontCache = undefined; return null; });
  return fontCache;
}

/** A Personal Branding header font (medium + bold), fetched once per session; Poppins is used if it can't load. */
const brandFontCache = new Map<BrandFont, Promise<Record<"medium" | "bold", string> | null>>();
function loadBrandFont(f: BrandFont) {
  let p = brandFontCache.get(f);
  if (!p) {
    p = Promise.all((["medium", "bold"] as const).map(async (w) => {
      const res = await fetch(`/fonts/${fontFile(f, w)}.ttf`);
      if (!res.ok) throw new Error(`font ${f} ${w}`);
      return [w, toBase64(await res.arrayBuffer())] as const;
    })).then((pairs) => Object.fromEntries(pairs) as Record<"medium" | "bold", string>).catch(() => { brandFontCache.delete(f); return null; });
    brandFontCache.set(f, p);
  }
  return p;
}
const withBrandFont = new WeakSet<JsPDF>();

/** A new letter-size PDF with Poppins, plus the header font of a Personal Branding kit when one is given. */
export async function newBrandedPdf(brand?: PdfBrand | null) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "letter" });
  const [fonts, extra] = await Promise.all([loadPoppins(), brand && brand.font !== "Poppins" && !SYSTEM_FONTS.has(brand.font) ? loadBrandFont(brand.font) : null]);
  if (fonts) {
    for (const [w, data] of Object.entries(fonts) as [Weight, string][]) {
      pdf.addFileToVFS(`${WEIGHT_FILES[w]}.ttf`, data);
      pdf.addFont(`${WEIGHT_FILES[w]}.ttf`, "Poppins", w);
    }
    withPoppins.add(pdf);
  }
  if (brand && extra) {
    for (const w of ["medium", "bold"] as const) {
      pdf.addFileToVFS(`${fontFile(brand.font, w)}.ttf`, extra[w]);
      pdf.addFont(`${fontFile(brand.font, w)}.ttf`, brand.font, w);
    }
    withBrandFont.add(pdf);
  }
  return pdf;
}

/** Adds the cursive signature font to a PDF; returns false (Times italic is used) if it can't load. */
export async function addSignatureFont(pdf: JsPDF, family: string) {
  const files = await loadBrandFont(family);
  if (!files) return false;
  pdf.addFileToVFS(`${fontFile(family, "bold")}.ttf`, files.bold);
  pdf.addFont(`${fontFile(family, "bold")}.ttf`, family, "bold");
  return true;
}

/** Sets the brand kit's header font (falls back to Poppins). */
function kitFont(pdf: JsPDF, brand: PdfBrand, weight: "medium" | "bold", size: number) {
  // Arial: the PDF's built-in Helvetica has the same letter shapes and needs no file.
  if (brand.font === "Arial") return pdf.setFont("helvetica", weight === "bold" ? "bold" : "normal").setFontSize(size);
  if (brand.font !== "Poppins" && withBrandFont.has(pdf)) return pdf.setFont(brand.font, weight).setFontSize(size);
  return font(pdf, weight === "bold" ? "semibold" : "medium", size);
}

/** Sets the brand font at a weight and size. */
export function font(pdf: JsPDF, weight: Weight, size: number) {
  if (withPoppins.has(pdf)) pdf.setFont("Poppins", weight);
  else pdf.setFont("helvetica", weight === "regular" ? "normal" : "bold");
  return pdf.setFontSize(size);
}

/** Small uppercase, letter-spaced label. */
export function label(pdf: JsPDF, text: string, x: number, y: number, color: [number, number, number] = MUTED, size = 7.5) {
  font(pdf, "semibold", size).setTextColor(...color).text(text.toUpperCase(), x, y, { charSpace: 0.35 });
}

/** The logo outline as filled vector paths, `w` mm wide with its top-left corner at (x, y). */
export function drawLogo(pdf: JsPDF, x: number, y: number, w: number) {
  const s = w / LOGO_VIEWBOX[0];
  const t = LOGO_PATH.split(" ");
  const n = (i: number) => Number(t[i]);
  const px = (i: number) => x + n(i) * s, py = (i: number) => y + n(i) * s;
  for (let i = 0; i < t.length;) {
    const op = t[i++];
    if (op === "M") { if (i > 1) pdf.close(); pdf.moveTo(px(i), py(i + 1)); i += 2; }
    else if (op === "L") { pdf.lineTo(px(i), py(i + 1)); i += 2; }
    else if (op === "C") { pdf.curveTo(px(i), py(i + 1), px(i + 2), py(i + 3), px(i + 4), py(i + 5)); i += 6; }
    else i++;
  }
  pdf.close();
  pdf.setFillColor(...INK).fillEvenOdd();
}

/**
 * Branded header: vector logo, wordmark, tagline, cobalt rule, then the document title. `meta` sits right-aligned on
 * the subtitle line. With a Personal Branding kit, their logo, name, tagline and colors replace ours. Returns next y.
 */
export function brandHeader(pdf: JsPDF, title: string, subtitle?: string, meta?: string, brand?: PdfBrand | null) {
  const w = pdf.internal.pageSize.getWidth();
  if (brand) kitHeader(pdf, brand);
  else {
    const logoW = 23;
    // Logo centered on the two text lines (wordmark cap top ≈ 15.6, tagline baseline 23.2).
    drawLogo(pdf, MARGIN, 19.4 - (logoW * LOGO_RATIO) / 2, logoW);
    const x = MARGIN + logoW + 5;
    font(pdf, "semibold", 12).setTextColor(...INK).text("CAME THROUGH", x, 18.6, { charSpace: 0.2 });
    const cameW = pdf.getTextWidth("CAME THROUGH ") + 0.2 * 12;
    pdf.setTextColor(...COBALT).text("AUDIO", x + cameW, 18.6, { charSpace: 0.2 });
    // Tagline: always uppercase with 2px (≈0.53 mm) letter spacing.
    font(pdf, "medium", 7).setTextColor(...MUTED).text("YOUR FIRST STOP BEFORE DISTRIBUTION", x, 23.2, { charSpace: 0.53 });
    pdf.setFillColor(...COBALT).rect(MARGIN, 28.5, w - MARGIN * 2, 0.8, "F");
  }

  font(pdf, "bold", 24).setTextColor(...INK);
  const titleLines = (pdf.splitTextToSize(title, w - MARGIN * 2) as string[]).slice(0, 2);
  let y = 42;
  titleLines.forEach((line, i) => pdf.text(line, MARGIN, y + i * 9.5));
  y += (titleLines.length - 1) * 9.5;
  if (subtitle || meta) {
    y += 7.5;
    if (subtitle) font(pdf, "regular", 11.5).setTextColor(...MUTED).text(subtitle, MARGIN, y);
    if (meta) font(pdf, "regular", 10).setTextColor(...MUTED).text(meta, w - MARGIN, y, { align: "right" });
  }
  return y + 12;
}

/** Their logo (fit in a 34 × 16 mm box), name in the first color, tagline in the second, and one stripe of every color. */
function kitHeader(pdf: JsPDF, brand: PdfBrand) {
  const w = pdf.internal.pageSize.getWidth();
  let x = MARGIN;
  if (brand.logo) {
    try {
      const p = pdf.getImageProperties(brand.logo.dataUrl);
      const s = Math.min(34 / p.width, 16 / p.height);
      const lw = p.width * s, lh = p.height * s;
      pdf.addImage(brand.logo.dataUrl, p.fileType, MARGIN, 19.4 - lh / 2, lw, lh);
      x += lw + 5;
    } catch { /* an unreadable logo leaves the name on its own */ }
  }
  const colors = brand.colors.map(hexRgb);
  const nameY = brand.tagline ? 18.6 : 21;
  if (brand.name) kitFont(pdf, brand, "bold", 14).setTextColor(...(colors[0] ?? INK)).text(brand.name, x, nameY);
  if (brand.tagline) kitFont(pdf, brand, "medium", 7.5).setTextColor(...(colors[1] ?? MUTED)).text(brand.tagline, x, 24);
  const stripe = colors.length ? colors : [INK];
  const seg = (w - MARGIN * 2) / stripe.length;
  stripe.forEach((c, i) => pdf.setFillColor(...c).rect(MARGIN + i * seg, 28.5, seg + 0.05, 0.8, "F"));
}

/** "2026-03-03" → "Mar 3, 2026"; anything else is shown as typed. */
export function prettyDate(v: string | undefined) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? "");
  if (!m) return v ?? "";
  return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export const GENERATED_ON = "Generated on camethroughaudio.com";

/**
 * Footer on every page with brand and page numbers. A Personal Branding document names its owner instead, plus the
 * "Generated on camethroughaudio.com · YOUR FIRST STOP BEFORE DISTRIBUTION" link unless they turned it off.
 */
export function brandFooter(pdf: JsPDF, brand?: PdfBrand | null) {
  const pages = pdf.getNumberOfPages();
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  const generated = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(...RULE).setLineWidth(0.3).line(MARGIN, h - 17, w - MARGIN, h - 17);
    font(pdf, "regular", 8.5).setTextColor(...MUTED);
    pdf.text(brand ? [brand.name, `Generated ${generated}`].filter(Boolean).join("  ·  ") : `Came Through Audio, LLC  ·  Generated ${generated}`, MARGIN, h - 11);
    pdf.text(`Page ${i} of ${pages}`, w - MARGIN, h - 11, { align: "right" });
    if (brand?.showFooter) {
      font(pdf, "regular", 7).setTextColor(...MUTED);
      pdf.textWithLink(`${GENERATED_ON}  ·  `, MARGIN, h - 6.5, { url: SITE_URL });
      const at = MARGIN + pdf.getTextWidth(`${GENERATED_ON}  ·  `);
      // Same gray as "Generated on…", so it blends with any brand's colors (founder, 2026-10-27).
      font(pdf, "medium", 7).setTextColor(...MUTED);
      pdf.textWithLink("YOUR FIRST STOP BEFORE DISTRIBUTION", at, h - 6.5, { url: SITE_URL, charSpace: 0.53 } as never);
    }
  }
}

/** Two-column label/value grid in a light panel; long values wrap inside their column. Returns next y. */
export function infoGrid(pdf: JsPDF, y: number, items: [string, string][]) {
  const w = pdf.internal.pageSize.getWidth() - MARGIN * 2;
  const colW = (w - 16) / 2;
  font(pdf, "regular", 11.5);
  const cells = items.map(([l, v]) => ({ label: l, lines: (pdf.splitTextToSize(v || "—", colW - 6) as string[]).slice(0, 3) }));
  const rows: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));
  const rowH = rows.map((r) => 6.5 + Math.max(...r.map((c) => c.lines.length)) * 5.6 + 3);
  const h = rowH.reduce((a, b) => a + b, 0) + 8;
  pdf.setFillColor(...PANEL).roundedRect(MARGIN, y, w, h, 2.5, 2.5, "F");
  let yy = y + 9;
  rows.forEach((r, ri) => {
    r.forEach((c, ci) => {
      const x = MARGIN + 8 + ci * colW;
      // Blue labels match their entries in size.
      font(pdf, "semibold", 11.5).setTextColor(...COBALT).text(c.label, x, yy);
      font(pdf, "regular", 11.5).setTextColor(...(c.lines[0] === "—" ? MUTED : INK));
      c.lines.forEach((line, li) => pdf.text(line, x, yy + 6 + li * 5.6));
    });
    yy += rowH[ri]!;
  });
  return y + h + 10;
}

export function sectionTitle(pdf: JsPDF, y: number, text: string) {
  label(pdf, text, MARGIN, y, COBALT, 9);
  return y + 8;
}

export function ensureSpace(pdf: JsPDF, y: number, needed: number) {
  if (y + needed > pdf.internal.pageSize.getHeight() - 26) { pdf.addPage(); return 24; }
  return y;
}
