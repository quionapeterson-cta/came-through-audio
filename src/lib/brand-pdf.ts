import type { jsPDF as JsPDF } from "jspdf";
import { LOGO_PNG, LOGO_RATIO } from "@/lib/brand-logo";

export const COBALT: [number, number, number] = [0, 74, 173];
export const INK: [number, number, number] = [17, 17, 17];
export const MUTED: [number, number, number] = [110, 110, 110];
export const RULE: [number, number, number] = [225, 228, 235];

export async function newBrandedPdf() {
  const { jsPDF } = await import("jspdf");
  return new jsPDF({ unit: "mm", format: "letter" });
}

/** Branded header: logo + wordmark, cobalt rule, document title. Returns next y. */
export function brandHeader(pdf: JsPDF, title: string, subtitle?: string) {
  const w = pdf.internal.pageSize.getWidth();
  pdf.addImage(LOGO_PNG, "PNG", 18, 14, 22, 22 * LOGO_RATIO);
  pdf.setFont("helvetica", "bold").setFontSize(13).setTextColor(...INK);
  pdf.text("CAME THROUGH", 44, 19.5);
  pdf.setTextColor(...COBALT).text("AUDIO", 44 + pdf.getTextWidth("CAME THROUGH "), 19.5);
  pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
  pdf.text("Organize your music business like a pro", 44, 24);
  pdf.setFillColor(...COBALT).rect(18, 30, w - 36, 1.2, "F");
  pdf.setFont("helvetica", "bold").setFontSize(22).setTextColor(...INK);
  pdf.text(title, 18, 44);
  let y = 44;
  if (subtitle) {
    pdf.setFont("helvetica", "normal").setFontSize(11).setTextColor(...MUTED);
    pdf.text(subtitle, 18, 51);
    y = 51;
  }
  return y + 10;
}

/** Footer on every page with brand and page numbers. */
export function brandFooter(pdf: JsPDF) {
  const pages = pdf.getNumberOfPages();
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(...RULE).setLineWidth(0.3).line(18, h - 16, w - 18, h - 16);
    pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
    pdf.text(`Came Through Audio, LLC  ·  Generated ${new Date().toLocaleDateString()}`, 18, h - 10);
    pdf.text(`Page ${i} of ${pages}`, w - 18, h - 10, { align: "right" });
  }
}

/** Two-column label/value grid in a light panel. Returns next y. */
export function infoGrid(pdf: JsPDF, y: number, items: [string, string][]) {
  const w = pdf.internal.pageSize.getWidth() - 36;
  const rows = Math.ceil(items.length / 2);
  const h = rows * 12 + 6;
  pdf.setFillColor(245, 247, 251).roundedRect(18, y, w, h, 2, 2, "F");
  items.forEach(([label, value], i) => {
    const x = 24 + (i % 2) * (w / 2);
    const yy = y + 9 + Math.floor(i / 2) * 12;
    pdf.setFont("helvetica", "bold").setFontSize(7).setTextColor(...COBALT).text(label.toUpperCase(), x, yy);
    pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(...INK).text(value || "—", x, yy + 5);
  });
  return y + h + 10;
}

export function sectionTitle(pdf: JsPDF, y: number, text: string) {
  pdf.setFont("helvetica", "bold").setFontSize(10).setTextColor(...COBALT).text(text.toUpperCase(), 18, y);
  return y + 6;
}

export function ensureSpace(pdf: JsPDF, y: number, needed: number) {
  if (y + needed > pdf.internal.pageSize.getHeight() - 24) { pdf.addPage(); return 24; }
  return y;
}
