import type { jsPDF as JsPDF } from "jspdf";
import type { CatalogTrack } from "@/lib/catalog";
import { brandFooter, brandHeader, COBALT, ensureSpace, font, INK, label, MARGIN, MUTED, newBrandedPdf, prettyDate, RULE } from "@/lib/brand-pdf";
import { creditName, writerRole, type Contributor } from "@/lib/metadata";

const names = (rows: Contributor[] | undefined) => (rows ?? []).map(creditName).filter(Boolean).join(", ");

/** Writers with their role, e.g. "Jane Doe (Author/Composer)". Legal names only. */
export function writerCredits(t: CatalogTrack) {
  const rows = [
    ...(t.metadata.writers ?? []).map((r) => [creditName(r), writerRole(r.role)] as const),
    ...(t.metadata.composers ?? []).map((r) => [creditName(r), "Composer"] as const),
  ].filter(([n]) => n);
  return [...new Set(rows.map(([n, role]) => `${n} (${role})`))].join(", ");
}

const trackNo = (t: CatalogTrack) => Number(t.metadata.trackNumber) || 999;

/** Releases by album (A–Z), loose songs under "Singles" last; songs in track order. */
function groupByRelease(tracks: CatalogTrack[]) {
  const groups = new Map<string, CatalogTrack[]>();
  for (const t of tracks) {
    const key = t.metadata.album?.trim() || "";
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a ? 0 : 1) - (b ? 0 : 1) || a.localeCompare(b))
    .map(([album, list]) => ({ album, tracks: list.sort((a, b) => trackNo(a) - trackNo(b) || a.title.localeCompare(b.title)) }));
}

const mostCommon = (values: string[]) => {
  const counts = new Map<string, number>();
  for (const v of values.filter(Boolean)) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
};

const PAD = 7;
const ID_LINE = 5.4;
const CREDIT_LINE = 5.6;
const CREDIT_LABEL_W = 35;
const CREDIT_RULE_X = 30.5;

/** One song as a bordered card. Measures first so a card never splits across pages. Returns next y. */
function songCard(pdf: JsPDF, y: number, t: CatalogTrack) {
  const m = t.metadata;
  const w = pdf.internal.pageSize.getWidth() - MARGIN * 2;
  const inner = w - PAD * 2;
  const colW = inner / 3;
  const ids: [string, string][] = [["ISRC", m.isrc], ["UPC", m.upc], ["ISWC", m.iswc], ["Genre", m.primaryGenre], ["Released", prettyDate(m.releaseDate)], ["Label", m.label]];
  font(pdf, "regular", 11.5);
  const idCells = ids.map(([l, v]) => ({ label: l, lines: (pdf.splitTextToSize(v || "—", colW - 4) as string[]).slice(0, 2) }));
  const idRowH = [0, 3].map((s) => 5 + Math.max(...idCells.slice(s, s + 3).map((c) => c.lines.length)) * ID_LINE + 3);
  const credits: [string, string][] = [["Writers", writerCredits(t)], ["Produced by", names(m.producers)], ["Publishers", names(m.publishers)]];
  const creditCells = credits.map(([l, v]) => ({ label: l, lines: pdf.splitTextToSize(v || "—", inner - CREDIT_LABEL_W) as string[] }));
  const featured = m.featured?.filter(Boolean) ?? [];
  const titleText = `${t.title}${featured.length ? ` (feat. ${featured.join(", ")})` : ""}`;
  font(pdf, "semibold", 14);
  const titleLines = (pdf.splitTextToSize(titleText, inner - 12 - 18) as string[]).slice(0, 2);

  const height = PAD + titleLines.length * 6.4 + 4 + idRowH[0]! + idRowH[1]! + 3 + creditCells.reduce((n, c) => n + c.lines.length * CREDIT_LINE + 2.5, 0) + PAD - 2;
  y = ensureSpace(pdf, y, height);

  pdf.setDrawColor(...RULE).setLineWidth(0.35).roundedRect(MARGIN, y, w, height, 2.5, 2.5, "S");
  const x = MARGIN + PAD;
  let yy = y + PAD + 4.2;
  if (m.trackNumber) font(pdf, "semibold", 14).setTextColor(...COBALT).text(m.trackNumber, x, yy);
  font(pdf, "semibold", 14).setTextColor(...INK);
  titleLines.forEach((line, i) => pdf.text(line, x + 12, yy + i * 6.4));
  if (m.duration) font(pdf, "medium", 11.5).setTextColor(...MUTED).text(m.duration, x + inner, yy, { align: "right" });
  yy += (titleLines.length - 1) * 6.4 + 5.5;

  // Identifiers: a fixed 3 × 2 grid, label above value, so every card lines up.
  for (const [ri, start] of [0, 3].entries()) {
    idCells.slice(start, start + 3).forEach((c, ci) => {
      const cx = x + ci * colW;
      label(pdf, c.label, cx, yy + 3.5, MUTED, 8);
      font(pdf, "regular", 11.5).setTextColor(...(c.lines[0] === "—" ? MUTED : INK));
      c.lines.forEach((line, li) => pdf.text(line, cx, yy + 3.5 + ID_LINE + li * ID_LINE));
    });
    yy += idRowH[ri]!;
  }

  pdf.setDrawColor(...RULE).setLineWidth(0.25).line(x, yy, x + inner, yy);
  yy += 3 + 3.6;
  // Credits: labels in one fixed column, a thin blue rule, then names; long names wrap under the value, never under the label.
  const creditsTop = yy - 4;
  for (const c of creditCells) {
    // Blue credit labels match their entries in size.
    font(pdf, "semibold", 11.5).setTextColor(...COBALT).text(c.label, x, yy);
    font(pdf, "regular", 11.5).setTextColor(...(c.lines[0] === "—" ? MUTED : INK));
    c.lines.forEach((line, li) => pdf.text(line, x + CREDIT_LABEL_W, yy + li * CREDIT_LINE));
    yy += c.lines.length * CREDIT_LINE + 2.5;
  }
  pdf.setDrawColor(...COBALT).setLineWidth(0.5).line(x + CREDIT_RULE_X, creditsTop, x + CREDIT_RULE_X, yy - 2.5 - CREDIT_LINE + 1.6);
  return y + height + 5;
}

/** Release heading: album name, with its type and year beside it. */
function releaseHeading(pdf: JsPDF, y: number, album: string, tracks: CatalogTrack[]) {
  const w = pdf.internal.pageSize.getWidth();
  y = ensureSpace(pdf, y, 60);
  const first = tracks[0]?.metadata;
  const year = /^\d{4}/.exec(first?.releaseDate ?? "")?.[0];
  const detail = [album ? first?.releaseType : "", year, `${tracks.length} ${tracks.length === 1 ? "song" : "songs"}`].filter(Boolean).join("  ·  ");
  font(pdf, "bold", 14).setTextColor(...INK);
  const name = album || "Singles";
  pdf.text(name, MARGIN, y);
  font(pdf, "regular", 10).setTextColor(...MUTED).text(detail, w - MARGIN, y, { align: "right" });
  pdf.setFillColor(...COBALT).rect(MARGIN, y + 2.8, 14, 0.8, "F");
  return y + 9;
}

/** The catalog as a branded PDF: songs grouped by release, one card each with identifiers and credits (no splits, PRO or IPI). */
export async function buildCatalogPdf(tracks: CatalogTrack[]) {
  const pdf = await newBrandedPdf();
  const artist = mostCommon(tracks.map((t) => t.artist));
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  let y = brandHeader(pdf, artist || "Catalog", "Master Catalog", `${tracks.length} ${tracks.length === 1 ? "song" : "songs"}  ·  ${date}`);
  for (const g of groupByRelease(tracks)) {
    y = releaseHeading(pdf, y, g.album, g.tracks);
    for (const t of g.tracks) y = songCard(pdf, y, t);
    y += 6;
  }
  brandFooter(pdf);
  return pdf;
}

export async function downloadCatalogPdf(tracks: CatalogTrack[], filename = "Catalog") {
  (await buildCatalogPdf(tracks)).save(`${filename}.pdf`);
}
