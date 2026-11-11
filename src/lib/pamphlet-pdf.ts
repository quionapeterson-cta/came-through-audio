import type { jsPDF as JsPDF } from "jspdf";
import { brandFooter, brandHeader, newBrandedPdf, ensureSpace, font, headerDate, INK, label, MARGIN, MUTED, PANEL, accentOf, sectionTitle } from "@/lib/brand-pdf";
import { saveBlob } from "@/lib/catalog";
import type { Pamphlet } from "@/lib/waiting-area";

/**
 * A Waiting Area pamphlet as a PDF to take home (founder, 2026-11-11). Text is drawn as text through the shared header and
 * footer, like every download; the leaflet picture stays on screen, because it comes from the art bucket and a canvas
 * can't always read it back. Ours to hand out, so it always carries the Came Through Audio header, never a member's kit.
 */
const width = (pdf: JsPDF) => pdf.internal.pageSize.getWidth() - MARGIN * 2;

function para(pdf: JsPDF, y: number, text: string, size = 11, color: [number, number, number] = INK) {
  font(pdf, "regular", size).setTextColor(...color);
  const lines = pdf.splitTextToSize(text, width(pdf)) as string[];
  y = ensureSpace(pdf, y, lines.length * size * 0.45);
  lines.forEach((l, i) => pdf.text(l, MARGIN, y + i * size * 0.45));
  return y + lines.length * size * 0.45 + 3;
}

export async function buildPamphletPdf(p: Pamphlet, title: string) {
  const pdf = await newBrandedPdf();
  let y = brandHeader(pdf, `${title}: ${p.subject}`, "Waiting Area pamphlet", headerDate());
  y = para(pdf, y, p.lede, 12, INK) + 2;
  for (const b of p.body) y = para(pdf, y, b, 10.5) + 1;

  // The same three readings the drawer shows, under the same names.
  y = ensureSpace(pdf, y + 2, 40);
  y = sectionTitle(pdf, y, "Readings");
  const rows: [string, string][] = [["Healthy reading", p.healthy], ["Bad reading", p.unhealthy], ["In your report", p.meaning]];
  for (const [k, v] of rows) {
    font(pdf, "regular", 10);
    const lines = pdf.splitTextToSize(v, width(pdf) - 44) as string[];
    const h = 6 + lines.length * 4.6;
    y = ensureSpace(pdf, y, h + 2);
    pdf.setFillColor(...PANEL).roundedRect(MARGIN, y - 4, width(pdf), h, 2, 2, "F");
    label(pdf, k, MARGIN + 4, y + 0.5, accentOf(pdf), 8);
    font(pdf, "regular", 10).setTextColor(...INK);
    lines.forEach((l, i) => pdf.text(l, MARGIN + 40, y + 0.5 + i * 4.6));
    y += h + 2;
  }
  y = ensureSpace(pdf, y + 4, 12);
  para(pdf, y, "General information to help you understand your royalties, not legal or financial advice. Each agency's own rules decide what it pays.", 8.5, MUTED);
  brandFooter(pdf);
  return pdf;
}

export async function downloadPamphletPdf(p: Pamphlet, title: string) {
  const pdf = await buildPamphletPdf(p, title);
  saveBlob(pdf.output("blob"), `${title} pamphlet - ${p.subject.replace(/[\\/:*?"<>|]/g, "")}.pdf`);
}
