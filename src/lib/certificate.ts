import type { Database } from "@/integrations/supabase/types";
import { buildOtsFile, download } from "@/lib/ots";

export type Certificate = Database["public"]["Tables"]["ai_protection_certificates"]["Row"];
type Credits = { writers?: string; composers?: string; producers?: string };

const fileBase = (title: string | null) => (title || "certificate").replace(/[^\w-]+/g, "_");

/** Builds and saves the PDF certificate from its saved record, so it can be downloaded again any time. */
export async function saveCertificatePdf(c: Certificate) {
  const [{ jsPDF }, QR] = await Promise.all([import("jspdf"), import("qrcode")]);
  const credits = (c.legal_credits ?? {}) as Credits;
  const qr = await QR.toDataURL(`CTA-CERT:${c.id}:${c.proof_digest ?? ""}`);
  const pdf = new jsPDF();
  pdf.setFontSize(20); pdf.text("Came Through Audio — Proof Certificate", 15, 22);
  pdf.setFontSize(11);
  const lines = [`Certificate ID: ${c.id}`, `Issued: ${c.issued_at ? new Date(c.issued_at).toUTCString() : "—"}`, `Track: ${c.track_title ?? "—"}`, `Artist: ${c.artist_name ?? "—"}`,
    `Writers: ${credits.writers || "—"}`, `Composers: ${credits.composers || "—"}`, `Producers: ${credits.producers || "—"}`,
    `ISRC: ${c.isrc || "—"}   UPC: ${c.upc || "—"}   ISWC: ${c.iswc || "—"}`, `Chain: ${c.chain_strength ?? "—"}`,
    `DAW session SHA-256: ${c.session_hash ?? "—"}`, `Draft history SHA-256: ${c.notes_hash ?? "—"}`,
    `Proof manifest SHA-256: ${c.proof_digest ?? "—"}`,
    c.ots_receipt ? `Bitcoin timestamp: submitted via OpenTimestamps (${c.ots_calendar}); anchors within a few hours.` : "Bitcoin timestamp: not available",
    c.ots_receipt ? "Verify: upload the manifest .txt and .ots files at opentimestamps.org" : ""];
  let y = 36;
  lines.forEach((l) => { const s = pdf.splitTextToSize(l, 130); pdf.text(s, 15, y); y += 6 * s.length + 3; });
  pdf.addImage(qr, "PNG", 150, 36, 45, 45);
  pdf.save(`${fileBase(c.track_title)}-proof-certificate.pdf`);
}

/** The manifest .txt and its .ots receipt: together they let anyone verify the Bitcoin timestamp. */
export function saveBitcoinProof(c: Certificate) {
  const base = fileBase(c.track_title);
  if (c.manifest) download(`${base}-proof-manifest.txt`, new TextEncoder().encode(c.manifest), "text/plain");
  if (c.ots_receipt && c.proof_digest) download(`${base}-proof-manifest.txt.ots`, buildOtsFile(c.proof_digest, c.ots_receipt), "application/octet-stream");
}
