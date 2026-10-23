import type { Database } from "@/integrations/supabase/types";
import { buildOtsFile, download } from "@/lib/ots";
import { makeZip } from "@/lib/zip";

export type Certificate = Database["public"]["Tables"]["ai_protection_certificates"]["Row"];
type Credits = { writers?: string; composers?: string; producers?: string };

const fileBase = (title: string | null) => (title || "certificate").replace(/[^\w-]+/g, "_");

/** Builds and saves the PDF certificate from its saved record, so it can be downloaded again any time. */
export async function saveCertificatePdf(c: Certificate) {
  const [{ jsPDF }, QR] = await Promise.all([import("jspdf"), import("qrcode")]);
  const credits = (c.legal_credits ?? {}) as Credits;
  // Scanning opens the public verify page for this certificate.
  const qr = await QR.toDataURL(verifyUrl(c.id), { margin: 1, width: 400 });
  const pdf = new jsPDF();
  pdf.setFontSize(20); pdf.text("Came Through Audio — Proof Certificate", 15, 22);
  pdf.setFontSize(11);
  const lines = [`Certificate ID: ${c.id}`, `Issued: ${c.issued_at ? new Date(c.issued_at).toUTCString() : "—"}`, `Track: ${c.track_title ?? "—"}`, `Artist: ${c.artist_name ?? "—"}`,
    `Writers: ${credits.writers || "—"}`, `Composers: ${credits.composers || "—"}`, `Producers: ${credits.producers || "—"}`,
    `ISRC: ${c.isrc || "—"}   UPC: ${c.upc || "—"}   ISWC: ${c.iswc || "—"}`, ...(c.chain_strength ? [`Chain: ${c.chain_strength}`] : []),
    `DAW session SHA-256: ${c.session_hash ?? "—"}`, `Draft history SHA-256: ${c.notes_hash ?? "—"}`,
    `Proof manifest SHA-256: ${c.proof_digest ?? "—"}`,
    "Keep your original proof videos unchanged: the fingerprints above match only those exact files.",
    c.ots_receipt ? `Bitcoin timestamp: submitted via OpenTimestamps (${c.ots_calendar}); anchors within a few hours.` : "Bitcoin timestamp: not available",
    c.ots_receipt ? "To verify on the Bitcoin blockchain: open opentimestamps.org, drop in the .ots file from your Bitcoin proof ZIP, then the proof-manifest.txt (not this PDF). It shows as pending for the first few hours." : "",
    `Scan the QR code or visit ${verifyUrl(c.id)} to check this certificate.`];
  let y = 36;
  lines.forEach((l) => { const s = pdf.splitTextToSize(l, 130); pdf.text(s, 15, y); y += 6 * s.length + 3; });
  pdf.addImage(qr, "PNG", 150, 36, 45, 45);
  pdf.setFontSize(8); pdf.text("Scan to verify", 172.5, 84, { align: "center" });
  pdf.save(`${fileBase(c.track_title)}-proof-certificate.pdf`);
}

export const verifyUrl = (id: string) => `${typeof window !== "undefined" ? window.location.origin : "https://camethroughaudio.com"}/verify/${id}`;

const HOW_TO_VERIFY = (c: Certificate, base: string) => `HOW TO VERIFY THIS CERTIFICATE ON THE BITCOIN BLOCKCHAIN

1. Go to https://opentimestamps.org
2. Drop in ${base}-proof-manifest.txt.ots
3. When it asks for the original file, drop in ${base}-proof-manifest.txt
   (the .txt in this folder, unchanged. Not the PDF certificate.)
4. It confirms the date the fingerprint was recorded on Bitcoin. In the first few hours after issue
   it shows as pending while Bitcoin confirms. That's normal; check again later.

Fingerprint (SHA-256 of the manifest): ${c.proof_digest ?? "-"}
Check the certificate online: ${verifyUrl(c.id)}

Keep your original proof videos too: the fingerprints in the manifest match those exact files.
`;

/** One ZIP with the manifest .txt, its .ots receipt and how to verify them, so the pair never gets split up. */
export function saveBitcoinProof(c: Certificate) {
  if (!c.manifest || !c.ots_receipt || !c.proof_digest) {
    // Older certificates without a saved manifest: the receipt alone, for the manifest downloaded at issue.
    if (c.ots_receipt && c.proof_digest) download(`${fileBase(c.track_title)}-proof-manifest.txt.ots`, buildOtsFile(c.proof_digest, c.ots_receipt), "application/octet-stream");
    return;
  }
  const base = fileBase(c.track_title);
  const blob = makeZip([
    { name: `${base}-proof-manifest.txt`, data: new TextEncoder().encode(c.manifest) },
    { name: `${base}-proof-manifest.txt.ots`, data: buildOtsFile(c.proof_digest, c.ots_receipt) },
    { name: "HOW TO VERIFY.txt", data: new TextEncoder().encode(HOW_TO_VERIFY(c, base)) },
  ]);
  download(`${base}-bitcoin-proof.zip`, blob, "application/zip");
}
