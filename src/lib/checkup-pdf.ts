import type { jsPDF as JsPDF } from "jspdf";
import { brandFooter, brandHeader, COBALT, ensureSpace, font, INK, label, MARGIN, MUTED, newBrandedPdf, PANEL, RULE } from "@/lib/brand-pdf";
import { CLEAR_DX, CLEAR_WHAT, STATE_LABEL, type Checkup, type Finding, type OrganState } from "@/lib/royalty-checkup";

/** The Royalty Health Report as a branded PDF: the main finding and treatment, then every organ's report. */
const RED: [number, number, number] = [193, 18, 31];
const GOLD: [number, number, number] = [255, 215, 0];
const CHIP: Record<OrganState, { fill?: [number, number, number]; text: [number, number, number] }> = {
  healthy: { fill: COBALT, text: [255, 255, 255] },
  watch: { fill: GOLD, text: INK },
  treat: { fill: RED, text: [255, 255, 255] },
  noflow: { text: MUTED },
};
const width = (pdf: JsPDF) => pdf.internal.pageSize.getWidth() - MARGIN * 2;

/** Wrapped paragraph; returns next y. */
function para(pdf: JsPDF, y: number, text: string, size = 11, color: [number, number, number] = INK, x = MARGIN, w = width(pdf)) {
  font(pdf, "regular", size).setTextColor(...color);
  const lines = pdf.splitTextToSize(text, w) as string[];
  y = ensureSpace(pdf, y, lines.length * size * 0.45);
  lines.forEach((l, i) => pdf.text(l, x, y + i * size * 0.45));
  return y + lines.length * size * 0.45 + 2;
}

function chip(pdf: JsPDF, x: number, y: number, state: OrganState) {
  const c = CHIP[state], text = STATE_LABEL[state];
  font(pdf, "semibold", 8.5);
  const w = pdf.getTextWidth(text) + 6;
  if (c.fill) pdf.setFillColor(...c.fill).roundedRect(x - w, y - 4, w, 5.8, 2.9, 2.9, "F");
  else pdf.setDrawColor(...MUTED).setLineDashPattern([0.8, 0.8], 0).roundedRect(x - w, y - 4, w, 5.8, 2.9, 2.9, "S").setLineDashPattern([], 0);
  pdf.setTextColor(...c.text).text(text, x - w / 2, y, { align: "center" });
}

/** ℞ treatment steps, numbered in cobalt circles. */
function steps(pdf: JsPDF, y: number, f: Finding) {
  y = ensureSpace(pdf, y, 14);
  label(pdf, "Treatment plan", MARGIN, y, COBALT, 8.5);
  y += 6;
  f.steps.forEach((s, i) => {
    font(pdf, "regular", 10.5);
    const lines = pdf.splitTextToSize(`${s.title}. ${s.text}`, width(pdf) - 10) as string[];
    y = ensureSpace(pdf, y, lines.length * 4.8 + 3);
    pdf.setFillColor(...COBALT).circle(MARGIN + 2.6, y - 1.3, 2.6, "F");
    font(pdf, "bold", 8).setTextColor(255, 255, 255).text(String(i + 1), MARGIN + 2.6, y - 0.2, { align: "center" });
    font(pdf, "regular", 10.5).setTextColor(...INK);
    lines.forEach((l, li) => pdf.text(l, MARGIN + 8, y + li * 4.8));
    y += lines.length * 4.8 + 2.5;
  });
  return y;
}

function finding(pdf: JsPDF, y: number, f: Finding) {
  y = ensureSpace(pdf, y, 40);
  font(pdf, "bold", 13).setTextColor(...INK).text(f.dx, MARGIN, y);
  y = para(pdf, y + 6, f.what, 10.5, MUTED);
  for (const [l, v] of [["Symptom", f.symptom], ["Cause", f.cause]] as const) {
    y = ensureSpace(pdf, y, 12);
    label(pdf, l, MARGIN, y + 2, COBALT, 8);
    y = para(pdf, y + 2, v, 10.5, INK, MARGIN + 24, width(pdf) - 24);
  }
  y = ensureSpace(pdf, y, 12);
  label(pdf, "Songs", MARGIN, y + 2, COBALT, 8);
  y = para(pdf, y + 2, f.songs.slice(0, 20).map((s) => `${s.title} (${s.why})`).join(" · ") + (f.songs.length > 20 ? ` · and ${f.songs.length - 20} more` : ""), 10, INK, MARGIN + 24, width(pdf) - 24);
  y = steps(pdf, y + 2, f);
  if (f.note) y = para(pdf, y + 1, f.note, 10, MUTED);
  return y + 4;
}

export async function buildCheckupPdf(c: Checkup, artist: string, country: string) {
  const pdf = await newBrandedPdf();
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  let y = brandHeader(pdf, "Royalty Health Report", artist || undefined, `${c.songs} ${c.songs === 1 ? "song" : "songs"}  ·  ${country}  ·  ${date}`);

  // Main finding, in a panel.
  const lead = c.lead;
  font(pdf, "regular", 11);
  const what = pdf.splitTextToSize(lead ? `${lead.what} Cause: ${lead.cause}` : CLEAR_WHAT, width(pdf) - 16) as string[];
  const h = 26 + what.length * 5;
  pdf.setFillColor(...PANEL).roundedRect(MARGIN, y, width(pdf), h, 3, 3, "F");
  label(pdf, `Overall health ${c.score}%  ·  Main finding`, MARGIN + 8, y + 8, COBALT, 8.5);
  font(pdf, "bold", 16).setTextColor(...INK).text(lead?.dx ?? CLEAR_DX, MARGIN + 8, y + 16);
  font(pdf, "regular", 11).setTextColor(...INK);
  what.forEach((l, i) => pdf.text(l, MARGIN + 8, y + 23 + i * 5));
  y += h + 8;
  if (lead) y = steps(pdf, y, lead) + 6;

  // Organ overview.
  y = ensureSpace(pdf, y, 20 + c.organs.length * 8);
  label(pdf, "Organ overview", MARGIN, y, COBALT, 9);
  y += 7;
  for (const o of c.organs) {
    pdf.setDrawColor(...RULE).setLineWidth(0.3).line(MARGIN, y + 2.5, MARGIN + width(pdf), y + 2.5);
    font(pdf, "semibold", 11).setTextColor(...INK).text(o.name, MARGIN, y);
    font(pdf, "regular", 10).setTextColor(...MUTED);
    const line = pdf.splitTextToSize(`${o.system}${o.findings.length ? `  ·  ${o.findings.map((f) => f.dx.replace(/\.$/, "")).join("; ")}` : ""}`, width(pdf) - 26 - 36) as string[];
    pdf.text(line.length > 1 ? `${line[0]!.replace(/[\s;·]+$/, "")}…` : line[0]!, MARGIN + 26, y);
    chip(pdf, MARGIN + width(pdf), y, o.state);
    y += 8.5;
  }
  y += 6;

  // One report per organ.
  for (const o of c.organs) {
    // Keep each organ's heading with the start of its report.
    y = ensureSpace(pdf, y, o.findings.length ? 90 : 30);
    font(pdf, "bold", 15).setTextColor(...INK).text(`${o.name} report`, MARGIN, y);
    chip(pdf, MARGIN + width(pdf), y, o.state);
    pdf.setFillColor(...GOLD).rect(MARGIN, y + 2.8, 14, 0.9, "F");
    y += 10;
    if (o.findings.length) for (const f of o.findings) y = finding(pdf, y, f);
    else y = para(pdf, y, `Healthy and strong. What we examined: ${o.checks.join("; ")}.`, 10.5, MUTED) + 4;
  }
  y = ensureSpace(pdf, y, 16);
  para(pdf, y, "Based on your catalog, the steps you've confirmed and live streaming lookups. Agency databases can't be searched automatically yet; upload your agency lists in the Royalty Health Hub to confirm for real.", 9, MUTED);
  brandFooter(pdf);
  return pdf;
}

export async function downloadCheckupPdf(c: Checkup, artist: string, country: string) {
  (await buildCheckupPdf(c, artist, country)).save(`Royalty Health Report ${new Date().toISOString().slice(0, 10)}.pdf`);
}
