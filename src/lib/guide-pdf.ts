import { brandFooter, brandHeader, COBALT, ensureSpace, font, INK, MARGIN, MUTED, newBrandedPdf, sectionTitle } from "@/lib/brand-pdf";
import { safeName } from "@/lib/catalog";
import type { Guide } from "@/lib/guides";

const LINE = 5.6;

/** A blueprint or cheat sheet as a branded PDF: numbered steps, then the checklist with tick boxes. */
export async function buildGuidePdf(g: Guide) {
  const pdf = await newBrandedPdf();
  const width = pdf.internal.pageSize.getWidth() - MARGIN * 2;
  let y = brandHeader(pdf, g.title, g.kind);
  font(pdf, "regular", 10.5).setTextColor(...MUTED);
  for (const line of pdf.splitTextToSize(g.summary, width) as string[]) { pdf.text(line, MARGIN, y); y += LINE; }
  y += 5;
  g.steps.forEach((st, i) => {
    const lines = pdf.splitTextToSize(st.text, width - 10) as string[];
    y = ensureSpace(pdf, y, 8 + lines.length * LINE);
    font(pdf, "bold", 11).setTextColor(...COBALT).text(`${i + 1}`, MARGIN, y);
    font(pdf, "semibold", 11).setTextColor(...INK).text(st.title, MARGIN + 10, y);
    y += LINE + 0.6;
    font(pdf, "regular", 10).setTextColor(...MUTED);
    for (const line of lines) { pdf.text(line, MARGIN + 10, y); y += LINE; }
    y += 3;
  });
  if (g.checklist?.length) {
    y = ensureSpace(pdf, y, 20);
    y = sectionTitle(pdf, y + 2, "Checklist");
    font(pdf, "regular", 10.5).setTextColor(...INK);
    for (const item of g.checklist) {
      y = ensureSpace(pdf, y, LINE + 1);
      pdf.setDrawColor(...COBALT).setLineWidth(0.4).rect(MARGIN, y - 3.4, 4, 4);
      pdf.text(item, MARGIN + 7, y);
      y += LINE + 1;
    }
  }
  brandFooter(pdf);
  return pdf;
}

export async function downloadGuidePdf(g: Guide) {
  (await buildGuidePdf(g)).save(`${safeName(g.title)}.pdf`);
}
