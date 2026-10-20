import type { jsPDF as JsPDF } from "jspdf";
import { LOGO_PATH, LOGO_RATIO, LOGO_VIEWBOX } from "@/lib/brand-logo";

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

export async function newBrandedPdf() {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "letter" });
  const fonts = await loadPoppins();
  if (fonts) {
    for (const [w, data] of Object.entries(fonts) as [Weight, string][]) {
      pdf.addFileToVFS(`${WEIGHT_FILES[w]}.ttf`, data);
      pdf.addFont(`${WEIGHT_FILES[w]}.ttf`, "Poppins", w);
    }
    withPoppins.add(pdf);
  }
  return pdf;
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

/** Branded header: vector logo, wordmark, tagline, cobalt rule, then the document title. `meta` sits right-aligned on the subtitle line. Returns next y. */
export function brandHeader(pdf: JsPDF, title: string, subtitle?: string, meta?: string) {
  const w = pdf.internal.pageSize.getWidth();
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

/** "2026-03-03" → "Mar 3, 2026"; anything else is shown as typed. */
export function prettyDate(v: string | undefined) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? "");
  if (!m) return v ?? "";
  return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Footer on every page with brand and page numbers. */
export function brandFooter(pdf: JsPDF) {
  const pages = pdf.getNumberOfPages();
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  const generated = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(...RULE).setLineWidth(0.3).line(MARGIN, h - 17, w - MARGIN, h - 17);
    font(pdf, "regular", 8.5).setTextColor(...MUTED);
    pdf.text(`Came Through Audio, LLC  ·  Generated ${generated}`, MARGIN, h - 11);
    pdf.text(`Page ${i} of ${pages}`, w - MARGIN, h - 11, { align: "right" });
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
