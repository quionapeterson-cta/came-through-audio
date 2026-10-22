import type { CatalogTrack } from "@/lib/catalog";
import { creditName, type Contributor } from "@/lib/metadata";
import { societyForPro } from "@/lib/repertoires";
import { splitStatus } from "@/lib/splits-total";

export type Pillar = "performance" | "digital" | "mechanical";
/** `field` is the catalog form field id to jump to, so each warning can link straight to the fix. */
export type Issue = { pillar: Pillar; text: string; field?: string };

export const PILLARS: { id: Pillar; label: string; registry: string; search: string; searchLabel: string }[] = [
  { id: "performance", label: "Performance Royalties", registry: "ASCAP · BMI", search: "https://www.ascap.com/repertory", searchLabel: "ASCAP Repertory" },
  { id: "digital", label: "Digital Performance", registry: "SoundExchange", search: "https://isrc.soundexchange.com/", searchLabel: "SoundExchange ISRC Search" },
  { id: "mechanical", label: "Mechanical Royalties", registry: "The MLC", search: "https://portal.themlc.com/search", searchLabel: "The MLC Public Search" },
];
export const BMI_SEARCH = "https://repertoire.bmi.com/";

export const isIsrc = (v: string) => /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(v.replace(/-/g, "").toUpperCase());
export const isIswc = (v: string) => /^T\d{10}$/.test(v.replace(/[-.\s]/g, "").toUpperCase());
export const isIpi = (v: string) => /^\d{9,11}$/.test(v.trim());
/** Any society counts, from the worldwide PRO list or typed in under "Other"; only a blank or "None" means unaffiliated. */
export const hasPro = (pro?: string) => !["", "none", "other"].includes((pro ?? "").trim().toLowerCase());

/** A BMI writer: with no publisher, BMI pays the publisher share to the writers, in proportion to their splits. */
export const isBmi = (w: Contributor) => societyForPro(w.pro)?.id === "bmi";
/** No publisher is needed: Self-published is checked, or every named writer is with BMI. */
export function publisherCovered(m: { writers: Contributor[]; composers: Contributor[]; selfPublished?: boolean }) {
  if (m.selfPublished) return true;
  const named = [...m.writers, ...m.composers].filter(creditName);
  return named.length > 0 && named.every(isBmi);
}

/** Checks one catalog track against what each repertoire system needs to match and pay it. */
export function auditTrack(t: CatalogTrack): Issue[] {
  const m = t.metadata;
  const out: Issue[] = [];
  const writers = (["writers", "composers"] as const).flatMap((group) => m[group].map((w, index) => ({ ...w, name: creditName(w), at: `${group}-${index}` }))).filter((w) => w.name);
  if (!writers.length) out.push({ pillar: "performance", text: "No songwriters listed", field: "writers-0-legalName" });
  writers.forEach((w) => {
    if (!hasPro(w.pro)) out.push({ pillar: "performance", text: `${w.name}: no PRO affiliation`, field: `${w.at}-pro` });
    if (!isIpi(w.ipi ?? "")) out.push({ pillar: "performance", text: `${w.name}: missing or invalid IPI`, field: `${w.at}-ipi` });
  });
  if (writers.length) {
    const split = splitStatus(m.writers.filter(creditName));
    if (split.state === "over") out.push({ pillar: "performance", text: `Writer splits total ${split.total}%, ${split.over}% over 100%. Lower one to fix it.`, field: "writers-0-share" });
    else if (split.state === "under" && Math.round(split.total) !== 100) out.push({ pillar: "performance", text: `Writer splits total ${split.total}%, ${split.left}% short of 100%`, field: "writers-0-share" });
  }
  if (!m.isrc) out.push({ pillar: "digital", text: "Missing ISRC", field: "isrc" });
  else if (!isIsrc(m.isrc)) out.push({ pillar: "digital", text: "ISRC is not 12 characters (CC-XXX-YY-NNNNN)", field: "isrc" });
  if (!t.artist.trim()) out.push({ pillar: "digital", text: "No featured artist name", field: "artist" });
  const pubs = m.publishers.filter((p) => p.name.trim());
  if (!pubs.length && !publisherCovered(m)) out.push({ pillar: "mechanical", text: "No publisher listed. Add one, or check Self-published if there isn't one.", field: "selfPublished" });
  const pubSplit = splitStatus(pubs);
  if (pubSplit.state === "over") out.push({ pillar: "mechanical", text: `Publisher shares total ${pubSplit.total}%, ${pubSplit.over}% over 100%. Lower one to fix it.`, field: "publishers-0-share" });
  m.publishers.forEach((p, index) => { if (p.name.trim() && !isIpi(p.ipi ?? "")) out.push({ pillar: "mechanical", text: `${p.name}: missing publisher IPI`, field: `publishers-${index}-ipi` }); });
  if (!m.iswc) out.push({ pillar: "mechanical", text: "Missing ISWC — sound recording can't be linked to its composition", field: "iswc" });
  else if (!isIswc(m.iswc)) out.push({ pillar: "mechanical", text: "ISWC format should be T-123.456.789-0", field: "iswc" });
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
