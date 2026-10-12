import type { CatalogTrack } from "@/lib/catalog";
import { safeName } from "@/lib/catalog";
import { brandFooter, brandHeader, ensureSpace, infoGrid, INK, newBrandedPdf, sectionTitle } from "@/lib/brand-pdf";

const names = (rows: { name: string }[] | undefined) => (rows ?? []).map((r) => r.name).filter(Boolean).join(", ");

export async function downloadLyricsPdf(track: CatalogTrack) {
  const m = track.metadata;
  const pdf = await newBrandedPdf();
  let y = brandHeader(pdf, track.title, `${track.artist}${m.album ? ` · ${m.album}` : ""}`);
  y = infoGrid(pdf, y, [["Writers", names(m.writers)], ["Composers", names(m.composers)], ["Producers", names(m.producers)], ["Publishers", names(m.publishers)], ["ISRC", m.isrc], ["ISWC", m.iswc]]);
  y = sectionTitle(pdf, y, "Lyrics");
  pdf.setFont("helvetica", "normal").setFontSize(11).setTextColor(...INK);
  for (const line of pdf.splitTextToSize(m.lyrics || "", 175) as string[]) {
    y = ensureSpace(pdf, y, 6);
    pdf.text(line, 18, y);
    y += 5.6;
  }
  brandFooter(pdf);
  pdf.save(`${safeName(track.title)}-lyrics.pdf`);
}
