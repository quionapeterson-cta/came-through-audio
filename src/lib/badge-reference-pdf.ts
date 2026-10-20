import type { jsPDF as JsPDF } from "jspdf";
import { ALL_BADGES, COLLECTIONS, TIER_LABEL, isBigTier, type BadgeDef } from "@/lib/badges";
import { brandFooter, brandHeader, COBALT, ensureSpace, font, INK, label, MARGIN, MUTED, newBrandedPdf, PANEL, RULE } from "@/lib/brand-pdf";

/** A badge picture ready for the PDF (JPEG on white), or null when it can't be drawn. */
export type BadgeArt = { data: string; format: "JPEG" | "PNG" } | null;
export type ArtLoader = (src: string) => Promise<BadgeArt>;

const ART = 18;
const GOLD: [number, number, number] = [176, 141, 0];

/** Browser loader: draws each badge onto white and shrinks it, so a 100-badge PDF stays a few MB. */
export const browserArt: ArtLoader = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    const size = 160, canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return resolve(null);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight);
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    resolve({ data: canvas.toDataURL("image/jpeg", 0.85), format: "JPEG" });
  };
  img.onerror = () => resolve(null);
  img.src = src;
});

function row(pdf: JsPDF, y: number, step: number, b: BadgeDef, art: BadgeArt) {
  const width = pdf.internal.pageSize.getWidth() - MARGIN * 2;
  const textX = MARGIN + 8 + ART + 5, textW = width - (textX - MARGIN);
  font(pdf, "regular", 9.5);
  const milestone = pdf.splitTextToSize(b.milestone, textW) as string[];
  font(pdf, "regular", 8.5);
  const popup = pdf.splitTextToSize(`Pop-up: "${b.popup.replace(/\{artist\}/g, "[artist name]")}"`, textW) as string[];
  const h = Math.max(ART, 6 + milestone.length * 4.6 + 1.5 + popup.length * 4) + 6;
  y = ensureSpace(pdf, y, h);

  font(pdf, "semibold", 9).setTextColor(...MUTED).text(String(step), MARGIN + 3, y + ART / 2 + 1.5, { align: "center" });
  if (art) pdf.addImage(art.data, art.format, MARGIN + 8, y, ART, ART);
  else {
    pdf.setFillColor(...PANEL).roundedRect(MARGIN + 8, y, ART, ART, 2, 2, "F");
    font(pdf, "medium", 6.5).setTextColor(...MUTED).text(["Art", "coming"], MARGIN + 8 + ART / 2, y + ART / 2 - 1, { align: "center" });
  }

  let ty = y + 4.5;
  font(pdf, "bold", 11).setTextColor(...INK).text(b.title, textX, ty);
  let tx = textX + pdf.getTextWidth(b.title) + 3;
  const tags = [TIER_LABEL[b.tier], b.every ? "Repeats" : "", b.artPending ? "Art coming" : ""].filter(Boolean);
  for (const t of tags) {
    const color = t === "Repeats" ? COBALT : t === "Art coming" ? MUTED : isBigTier(b.tier) ? GOLD : COBALT;
    label(pdf, t, tx, ty, color, 7);
    tx += pdf.getTextWidth(t.toUpperCase()) + t.length * 0.35 + 3;
  }
  ty += 5.5;
  font(pdf, "regular", 9.5).setTextColor(...INK);
  milestone.forEach((line, i) => pdf.text(line, textX, ty + i * 4.6));
  ty += milestone.length * 4.6 + 1.5;
  font(pdf, "regular", 8.5).setTextColor(...MUTED);
  popup.forEach((line, i) => pdf.text(line, textX, ty + i * 4));

  pdf.setDrawColor(...RULE).setLineWidth(0.2).line(MARGIN, y + h - 2.5, MARGIN + width, y + h - 2.5);
  return y + h;
}

/**
 * Every badge and its milestone, in the order users earn them, one collection at a time. Built from src/lib/badges.ts,
 * so it always matches the app. The founder and the Branding, Marketing and Social Media teams use the same document.
 */
export async function buildBadgeReferencePdf(loadArt: ArtLoader = browserArt) {
  const pdf = await newBrandedPdf();
  const live = ALL_BADGES.filter((b) => !b.artPending).length;
  let y = brandHeader(pdf, "Badge Reference", "Every badge and milestone, in earning order", `${live} live · ${ALL_BADGES.length - live} waiting on art`);

  const width = pdf.internal.pageSize.getWidth() - MARGIN * 2;
  const notes = [
    "Badges are earned from real work saved in the app, checked by the server, and never taken away.",
    "Instant Win marks a first-time badge. MEGA and Ultimate get the biggest celebration.",
    "Repeats: the badge is earned again at each step after the first, and the profile shows the count (×3).",
    "Pop-ups fill in the user's own artist name where you see [artist name].",
  ];
  font(pdf, "regular", 9.5);
  const lines = notes.flatMap((n) => pdf.splitTextToSize(n, width - 12) as string[]);
  const boxH = lines.length * 4.8 + 8;
  pdf.setFillColor(...PANEL).roundedRect(MARGIN, y - 4, width, boxH, 2.5, 2.5, "F");
  font(pdf, "regular", 9.5).setTextColor(...INK);
  lines.forEach((l, i) => pdf.text(l, MARGIN + 6, y + 2 + i * 4.8));
  y += boxH + 6;

  const art = new Map(await Promise.all(ALL_BADGES.map(async (b) => [b.id, b.artPending ? null : await loadArt(b.src)] as const)));
  for (const c of COLLECTIONS) {
    const list = ALL_BADGES.filter((b) => b.collection === c.id);
    if (!list.length) continue;
    y = ensureSpace(pdf, y, 16 + ART);
    font(pdf, "bold", 14).setTextColor(...COBALT).text(c.title, MARGIN, y + 2);
    font(pdf, "regular", 9).setTextColor(...MUTED).text(`${list.length} badges`, MARGIN + width, y + 2, { align: "right" });
    y += 9;
    list.forEach((b, i) => { y = row(pdf, y, i + 1, b, art.get(b.id) ?? null); });
    y += 6;
  }
  brandFooter(pdf);
  return pdf;
}

export async function downloadBadgeReferencePdf() {
  (await buildBadgeReferencePdf()).save("Came Through Audio Badge Reference.pdf");
}
