import { brandFooter, brandHeader, COBALT, ensureSpace, INK, MUTED, newBrandedPdf, sectionTitle } from "@/lib/brand-pdf";
import { safeName } from "@/lib/catalog";
import { CONTRACT_DISCLAIMER } from "@/lib/contract-blueprints";

export type PdfSignature = { name: string; role: string; signedAt: string | null; signatureName?: string | null; signatureHash?: string | null };

/**
 * A contract as a branded PDF: the text, then a signature block per party. Signed copies add each typed signature,
 * its time stamp and verification hash, and the SHA-256 of the locked text, so any later change is detectable.
 */
export async function downloadContractPdf(o: { title: string; body: string; parties: PdfSignature[]; bodyHash?: string | null; status: string }) {
  const pdf = await newBrandedPdf();
  const w = pdf.internal.pageSize.getWidth();
  const label = o.status === "signed" ? "Fully signed" : o.status === "sent" ? "Out for signature" : "Draft";
  let y = brandHeader(pdf, o.title, label);

  // The first line repeats the title in capitals; skip it since the header already shows the title.
  const lines = o.body.split("\n");
  if (lines[0]?.trim() === o.title.trim().toUpperCase()) lines.shift();
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { y += 3; continue; }
    const heading = /^[A-Z0-9 &().,'-]+$/.test(line) && /[A-Z]/.test(line) && line.length < 60 || /^\d+\.\s+[A-Z][A-Z &()'-]+$/.test(line);
    pdf.setFont("helvetica", heading ? "bold" : "normal").setFontSize(heading ? 10.5 : 10).setTextColor(...(heading ? COBALT : INK));
    for (const part of pdf.splitTextToSize(line, w - 36) as string[]) {
      y = ensureSpace(pdf, y, 6);
      pdf.text(part, 18, y);
      y += 5;
    }
    if (heading) y += 0.5;
  }

  y = ensureSpace(pdf, y + 6, 20 + o.parties.length * 30);
  y = sectionTitle(pdf, y, "Signatures");
  for (const p of o.parties) {
    y = ensureSpace(pdf, y, 30);
    pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(...COBALT).text(p.role.toUpperCase(), 18, y);
    y += 7;
    if (p.signedAt && p.signatureName) {
      pdf.setFont("times", "italic").setFontSize(18).setTextColor(...INK).text(p.signatureName, 18, y);
    }
    y += 2;
    pdf.setDrawColor(...MUTED).setLineWidth(0.3).line(18, y, 110, y);
    y += 5;
    pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(...INK).text(p.name || "Legal name", 18, y);
    pdf.setTextColor(...MUTED).text(p.signedAt ? `Signed ${new Date(p.signedAt).toLocaleString()}` : "Date: ____________________", 120, y);
    y += 4.5;
    if (p.signatureHash) {
      pdf.setFontSize(6.5).text(`Verification hash: ${p.signatureHash}`, 18, y);
      y += 4;
    }
    y += 6;
  }

  y = ensureSpace(pdf, y, 22);
  pdf.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
  if (o.bodyHash) {
    pdf.text(`Contract text SHA-256: ${o.bodyHash}`, 18, y);
    y += 5;
  }
  for (const part of pdf.splitTextToSize(CONTRACT_DISCLAIMER, w - 36) as string[]) { pdf.text(part, 18, y); y += 4; }

  brandFooter(pdf);
  pdf.save(`${safeName(o.title)}${o.status === "signed" ? " - Signed" : ""}.pdf`);
}
