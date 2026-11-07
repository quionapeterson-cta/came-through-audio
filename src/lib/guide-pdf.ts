import { brandFooter, brandHeader, COBALT, ensureSpace, font, INK, MARGIN, MUTED, newBrandedPdf, sectionTitle } from "@/lib/brand-pdf";
import { safeName, saveBlob } from "@/lib/catalog";
import type { Guide } from "@/lib/guides";

const LINE = 5.6;
/** jsPDF works in mm from the top-left corner; a PDF form field is in points from the bottom-left. */
const MM_TO_PT = 72 / 25.4;
const BOX_MM = 4;

/** One tick box, where jsPDF drew it: millimetres from the page's top-left corner. */
type Tick = { page: number; left: number; top: number };

/** Where that drawn box sits in the finished PDF, in points from the bottom-left — what a form field needs. */
export function tickBox(pageHeightMm: number, tick: Pick<Tick, "left" | "top">, sizeMm = BOX_MM) {
  return {
    x: tick.left * MM_TO_PT,
    y: (pageHeightMm - tick.top - sizeMm) * MM_TO_PT,
    width: sizeMm * MM_TO_PT,
    height: sizeMm * MM_TO_PT,
  };
}

/** A blueprint or cheat sheet as a branded PDF: numbered steps, then the checklist with tick boxes. */
export async function buildGuidePdf(g: Guide) {
  const pdf = await newBrandedPdf();
  const width = pdf.internal.pageSize.getWidth() - MARGIN * 2;
  const ticks: Tick[] = [];
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
      pdf.setDrawColor(...COBALT).setLineWidth(0.4).rect(MARGIN, y - 3.4, BOX_MM, BOX_MM);
      ticks.push({ page: pdf.getNumberOfPages(), left: MARGIN, top: y - 3.4 });
      pdf.text(item, MARGIN + 7, y);
      y += LINE + 1;
    }
  }
  // The pamphlet: the long-form detail behind the steps, so the downloaded copy reads on its own (founder, 2026-11-06).
  if (g.pamphlet?.length) {
    y = ensureSpace(pdf, y, 22);
    y = sectionTitle(pdf, y + 2, "The pamphlet");
    for (const part of g.pamphlet) {
      const lines = pdf.splitTextToSize(part.body, width) as string[];
      y = ensureSpace(pdf, y, 8 + lines.length * LINE);
      font(pdf, "semibold", 11).setTextColor(...INK).text(part.heading, MARGIN, y);
      y += LINE + 1.4;
      font(pdf, "regular", 10).setTextColor(...MUTED);
      for (const line of lines) { pdf.text(line, MARGIN, y); y += LINE; }
      // Same order as the screen: the bullets sit under the paragraph they belong to. The bullet glyphs stay on screen;
      // jsPDF's built-in fonts have no emoji, so the PDF prints the same sentence with the bullet instead.
      for (const point of part.points ?? []) {
        const plain = point.replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, "").replace(/\s+/g, " ").trim();
        const pointLines = pdf.splitTextToSize(`• ${plain}`, width - 4) as string[];
        y = ensureSpace(pdf, y, pointLines.length * LINE + 1);
        font(pdf, "regular", 10).setTextColor(...MUTED);
        for (const line of pointLines) { pdf.text(line, MARGIN + 4, y); y += LINE; }
        y += 1;
      }
      y += 4;
    }
  }
  brandFooter(pdf);
  return { pdf, ticks };
}

/**
 * The same guide with real, tickable checkboxes (founder, 2026-11-06), so a downloaded blueprint still works as a
 * checklist in a PDF reader or in PDF Fill & Sign. jsPDF can't create form fields, so the finished pages are reopened
 * with pdf-lib and a box is added on top of each square that was drawn. A PDF that comes back without its boxes is
 * still a readable guide, so a failure here is logged rather than turned into an error the member sees.
 */
export async function buildGuidePdfBytes(g: Guide) {
  const { pdf, ticks } = await buildGuidePdf(g);
  const bytes = pdf.output("arraybuffer");
  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(bytes);
    const form = doc.getForm();
    const pages = doc.getPages();
    const height = pdf.internal.pageSize.getHeight();
    ticks.forEach((tick, i) => {
      const page = pages[tick.page - 1];
      if (!page) return;
      form.createCheckBox(`checklist-${i + 1}`).addToPage(page, { ...tickBox(height, tick), borderWidth: 0 });
    });
    return await doc.save();
  } catch (e) {
    console.warn("Blueprint PDF came out without tick boxes:", e);
    return new Uint8Array(bytes);
  }
}

export async function downloadGuidePdf(g: Guide) {
  saveBlob(new Blob([new Uint8Array(await buildGuidePdfBytes(g))], { type: "application/pdf" }), `${safeName(g.title)}.pdf`);
}
