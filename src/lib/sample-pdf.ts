import { brandFooter, brandHeader, headerDate, infoGrid, newBrandedPdf, sectionTitle } from "@/lib/brand-pdf";
import type { PdfBrand } from "@/lib/brand-kit";
import { saveBlob } from "@/lib/catalog";

export type SampleKind = "contract" | "split" | "lyrics" | "catalog";

export const SAMPLE_TITLES: Record<SampleKind, string> = {
  contract: "Contract",
  split: "Split sheet",
  lyrics: "Lyrics",
  catalog: "Catalog",
};

/**
 * One page printed with the kit, so the member can check the colours, logo and font before using it on a document they
 * send (founder, 2026-11-06). It goes through the same header and footer as every real download, so the sample can never
 * show something the documents won't.
 */
export async function downloadSamplePdf(brand: PdfBrand, kind: SampleKind, artistName: string) {
  // A split sheet records who owns the song, so it prints the artist's name, exactly as the real download does.
  const shown = kind === "split" && artistName.trim() ? { ...brand, name: artistName.trim() } : brand;
  const pdf = await newBrandedPdf(shown);
  let y = brandHeader(pdf, `Sample ${SAMPLE_TITLES[kind]}`, `${shown.name || "Your business"} — a one-page test print`, headerDate(), shown);
  const rows: [string, string][] = kind === "split"
    ? [["Song", "Your song"], ["Artist", shown.name || "Your artist name"], ["Split", "100%"], ["Status", "Draft"]]
    : kind === "catalog"
      ? [["Songs", "12"], ["Ready to register", "9"], ["Codes", "ISRC · UPC"], ["Printed", headerDate()]]
      : [["Prepared for", "Your collaborator"], ["Reference", "SAMPLE"], ["Status", "Draft"], ["Pages", "1 of 1"]];
  y = infoGrid(pdf, y, rows);
  y = sectionTitle(pdf, y, kind === "lyrics" ? "Verse one" : kind === "split" ? "Ownership splits" : "What this shows");
  pdf.setFontSize(11).setTextColor(82, 82, 82);
  const text = kind === "lyrics"
    ? "Your lyrics print here in black, under your own header, with your section titles in your accent colour. This page uses the same header, rules and footer as every download your kit brands."
    : "This is a real one-page PDF drawn with your kit. Print it to check the colours, the logo and the font before you use the kit on a contract or split sheet you send.";
  for (const line of pdf.splitTextToSize(text, 170) as string[]) { pdf.text(line, 20, y); y += 6; }
  brandFooter(pdf, shown);
  saveBlob(pdf.output("blob"), `Brand kit sample - ${SAMPLE_TITLES[kind]}.pdf`);
}
