import type { CatalogTrack } from "@/lib/catalog";
import { safeName } from "@/lib/catalog";
import { brandFooter, brandHeader, COBALT, ensureSpace, font, infoGrid, INK, MARGIN, newBrandedPdf, prettyDate } from "@/lib/brand-pdf";
import { writerCredits } from "@/lib/catalog-pdf";
import { creditName, type Contributor } from "@/lib/metadata";

const names = (rows: Contributor[] | undefined) => (rows ?? []).map(creditName).filter(Boolean).join(", ");
const LINE = 6.8;

export async function buildLyricsPdf(track: CatalogTrack) {
  const m = track.metadata;
  const pdf = await newBrandedPdf();
  const featured = m.featured?.filter(Boolean) ?? [];
  let y = brandHeader(pdf, track.title, [track.artist + (featured.length ? ` feat. ${featured.join(", ")}` : ""), m.album].filter(Boolean).join("  ·  "));
  y = infoGrid(pdf, y, [["Writers", writerCredits(track)], ["Produced by", names(m.producers)], ["Publishers", names(m.publishers)], ["ISRC", m.isrc], ["ISWC", m.iswc], ["Released", prettyDate(m.releaseDate)]]);
  font(pdf, "semibold", 13).setTextColor(...COBALT).text("Lyrics", MARGIN, y);
  y += 8;
  font(pdf, "regular", 13).setTextColor(...INK);
  const width = pdf.internal.pageSize.getWidth() - MARGIN * 2;
  for (const line of pdf.splitTextToSize(m.lyrics || "", width) as string[]) {
    y = ensureSpace(pdf, y, LINE);
    pdf.text(line, MARGIN, y);
    y += LINE;
  }
  brandFooter(pdf);
  return pdf;
}

export async function downloadLyricsPdf(track: CatalogTrack) {
  (await buildLyricsPdf(track)).save(`${safeName(track.title)}-lyrics.pdf`);
}
