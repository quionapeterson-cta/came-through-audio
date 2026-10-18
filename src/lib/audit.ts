import type { CatalogTrack } from "@/lib/catalog";
import { creditName } from "@/lib/metadata";

export type Pillar = "performance" | "digital" | "mechanical";
export type Issue = { pillar: Pillar; text: string };

export const PILLARS: { id: Pillar; label: string; registry: string; search: string; searchLabel: string }[] = [
  { id: "performance", label: "Performance Royalties", registry: "ASCAP · BMI", search: "https://www.ascap.com/repertory", searchLabel: "ASCAP Repertory" },
  { id: "digital", label: "Digital Performance", registry: "SoundExchange", search: "https://isrc.soundexchange.com/", searchLabel: "SoundExchange ISRC Search" },
  { id: "mechanical", label: "Mechanical Royalties", registry: "The MLC", search: "https://portal.themlc.com/search", searchLabel: "The MLC Public Search" },
];
export const BMI_SEARCH = "https://repertoire.bmi.com/";

export const isIsrc = (v: string) => /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(v.replace(/-/g, "").toUpperCase());
export const isIswc = (v: string) => /^T\d{10}$/.test(v.replace(/[-.\s]/g, "").toUpperCase());
export const isIpi = (v: string) => /^\d{9,11}$/.test(v.trim());
const PROS = ["ascap", "bmi", "sesac", "gmr"];

/** Checks one catalog track against what each repertoire system needs to match and pay it. */
export function auditTrack(t: CatalogTrack): Issue[] {
  const m = t.metadata;
  const out: Issue[] = [];
  const writers = [...m.writers, ...m.composers].filter(creditName).map((w) => ({ ...w, name: creditName(w) }));
  if (!writers.length) out.push({ pillar: "performance", text: "No songwriters listed" });
  writers.forEach((w) => {
    if (!PROS.some((p) => w.pro?.toLowerCase().includes(p))) out.push({ pillar: "performance", text: `${w.name}: no PRO affiliation` });
    if (!isIpi(w.ipi ?? "")) out.push({ pillar: "performance", text: `${w.name}: missing or invalid IPI` });
  });
  if (writers.length) {
    const split = m.writers.filter(creditName).reduce((s, w) => s + Number(w.percentage || 0), 0);
    if (split && Math.round(split) !== 100) out.push({ pillar: "performance", text: `Writer splits total ${split}% (must be 100%)` });
  }
  if (!m.isrc) out.push({ pillar: "digital", text: "Missing ISRC" });
  else if (!isIsrc(m.isrc)) out.push({ pillar: "digital", text: "ISRC is not 12 characters (CC-XXX-YY-NNNNN)" });
  if (!t.artist.trim()) out.push({ pillar: "digital", text: "No featured artist name" });
  const pubs = m.publishers.filter((p) => p.name.trim());
  if (!pubs.length) out.push({ pillar: "mechanical", text: "No publisher listed (self-published writers can list their own entity)" });
  pubs.forEach((p) => { if (!isIpi(p.ipi ?? "")) out.push({ pillar: "mechanical", text: `${p.name}: missing publisher IPI` }); });
  if (!m.iswc) out.push({ pillar: "mechanical", text: "Missing ISWC — sound recording can't be linked to its composition" });
  else if (!isIswc(m.iswc)) out.push({ pillar: "mechanical", text: "ISWC format should be T-123.456.789-0" });
  return out;
}

/** Score = share of tracks × pillars with no issues. */
export function auditCatalog(tracks: CatalogTrack[]) {
  const rows = tracks.map((t) => ({ t, issues: auditTrack(t) }));
  const cells = rows.length * PILLARS.length;
  const clean = rows.reduce((s, r) => s + PILLARS.filter((p) => !r.issues.some((i) => i.pillar === p.id)).length, 0);
  const pillar = Object.fromEntries(PILLARS.map((p) => [p.id, rows.filter((r) => !r.issues.some((i) => i.pillar === p.id)).length])) as Record<Pillar, number>;
  return { rows, score: cells ? Math.round((clean / cells) * 100) : 0, pillar, atRisk: rows.filter((r) => r.issues.length).length };
}
