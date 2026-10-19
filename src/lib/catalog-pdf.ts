import type { CatalogTrack } from "@/lib/catalog";
import { brandFooter, brandHeader, COBALT, ensureSpace, INK, MUTED, newBrandedPdf, RULE } from "@/lib/brand-pdf";
import { creditName, type Contributor } from "@/lib/metadata";

const names = (rows: Contributor[] | undefined) => (rows ?? []).map(creditName).filter(Boolean).join(", ");

/** The catalog as a branded PDF: one block per song with its identifiers and credits (no splits, PRO or IPI). */
export async function downloadCatalogPdf(tracks: CatalogTrack[], filename = "Catalog") {
  const pdf = await newBrandedPdf();
  const w = pdf.internal.pageSize.getWidth();
  const sorted = [...tracks].sort((a, b) => (a.metadata.album || a.title).localeCompare(b.metadata.album || b.title)
    || (Number(a.metadata.trackNumber) || 999) - (Number(b.metadata.trackNumber) || 999));
  let y = brandHeader(pdf, "Catalog", `${sorted.length} ${sorted.length === 1 ? "song" : "songs"}`);

  for (const t of sorted) {
    const m = t.metadata;
    const ids = [m.releaseType, m.primaryGenre, m.duration, m.releaseDate && `Released ${m.releaseDate}`, m.label && `Label ${m.label}`,
      m.isrc && `ISRC ${m.isrc}`, m.upc && `UPC ${m.upc}`, m.iswc && `ISWC ${m.iswc}`].filter(Boolean).join("  ·  ");
    const credits = ([["Writers", names(m.writers)], ["Composers", names(m.composers)], ["Producers", names(m.producers)], ["Publishers", names(m.publishers)]] as const)
      .filter(([, v]) => v);
    const creditLines = credits.map(([label, v]) => ({ label, lines: pdf.splitTextToSize(v, w - 66) as string[] }));
    const idLines = ids ? (pdf.splitTextToSize(ids, w - 36) as string[]) : [];
    const height = 14 + idLines.length * 4.6 + creditLines.reduce((n, c) => n + c.lines.length * 4.8, 0) + 6;
    y = ensureSpace(pdf, y, height);

    pdf.setFont("helvetica", "bold").setFontSize(13).setTextColor(...INK);
    pdf.text(`${m.trackNumber && m.album ? `${m.trackNumber}. ` : ""}${t.title}`, 18, y);
    pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(...MUTED);
    pdf.text(`${t.artist}${m.featured?.filter(Boolean).length ? ` feat. ${m.featured.filter(Boolean).join(", ")}` : ""}${m.album ? `  ·  ${m.album}` : ""}`, 18, y + 5.5);
    y += 11;
    pdf.setFontSize(8.5);
    for (const line of idLines) { pdf.text(line, 18, y); y += 4.6; }
    y += 1;
    for (const c of creditLines) {
      pdf.setFont("helvetica", "bold").setFontSize(7).setTextColor(...COBALT).text(c.label.toUpperCase(), 18, y);
      pdf.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...INK);
      for (const line of c.lines) { pdf.text(line, 48, y); y += 4.8; }
    }
    y += 2;
    pdf.setDrawColor(...RULE).setLineWidth(0.3).line(18, y, w - 18, y);
    y += 8;
  }
  brandFooter(pdf);
  pdf.save(`${filename}.pdf`);
}
