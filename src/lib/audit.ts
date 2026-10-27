import type { CatalogTrack } from "@/lib/catalog";
import { creditName, type Contributor } from "@/lib/metadata";
import { isBmi } from "@/lib/publishing";
import { pieMessage, publisherPie, publishingGaps } from "@/lib/readiness";
import { splitStatus } from "@/lib/splits-total";

export type Pillar = "performance" | "digital" | "mechanical";
/** `field` is the catalog form field id to jump to, so each warning can link straight to the fix. */
/** `low`: still needed for 100%, but weighs little in the score (duration). */
export type Issue = { pillar: Pillar; text: string; field?: string; low?: boolean };

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

export { isBmi } from "@/lib/publishing";
/**
 * Every writer's publisher share has a home: a listed publisher, Self-published, BMI (BMI writers only) or "no
 * publishing on this song" (readiness.ts publishingGaps, the shared rule).
 */
export function publisherCovered(m: { writers: Contributor[]; composers: Contributor[]; publishers?: Contributor[]; selfPublished?: boolean; bmiWriterPublishing?: boolean }) {
  return publishingGaps({ ...m, publishers: m.publishers ?? [] }).length === 0;
}
/** Writers on a song marked "BMI writer with no publishing company" who aren't with BMI (BMI can't pay them). */
export const notBmiWriters = (m: { writers: Contributor[]; composers: Contributor[] }) =>
  [...m.writers, ...m.composers].filter((w) => creditName(w) && !isBmi(w)).map(creditName);

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
  // Needed for 100%, but only a small part of the score: it helps agencies tell apart songs with similar titles and artists.
  // Recording details (duration, release date) reach The MLC and SoundExchange from the streaming services, so only the
  // PRO side asks for duration, and lightly (founder's call with The MLC, 2026-10-27).
  if (!(m.duration ?? "").trim()) out.push({ pillar: "performance", text: "Add the duration (mm:ss). BMI asks for it when you register. The MLC and SoundExchange get it from the streaming services.", field: "duration", low: true });
  if (!m.isrc) out.push({ pillar: "digital", text: "Missing ISRC", field: "isrc" });
  else if (!isIsrc(m.isrc)) out.push({ pillar: "digital", text: "ISRC is not 12 characters (CC-XXX-YY-NNNNN)", field: "isrc" });
  if (!t.artist.trim()) out.push({ pillar: "digital", text: "No featured artist name", field: "artist" });
  const pubs = m.publishers.filter((p) => p.name.trim());
  if (pubs.length && m.bmiWriterPublishing) out.push({ pillar: "mechanical", text: "You said there's no publishing company but also listed a publisher. Keep one.", field: "bmiWriterPublishing" });
  for (const g of publishingGaps(m)) out.push({ pillar: "mechanical", text: g.message, field: g.field });
  // The publisher half as one pie (readiness.ts publisherPie): it has to total exactly 100% for 100% health.
  const pie = publisherPie(m);
  const pieText = publishingGaps(m).length || splitStatus(m.writers.filter(creditName)).state !== "full" ? undefined : pieMessage(pie);
  if (pieText) out.push({ pillar: "mechanical", text: pieText, field: pie.parts[0]?.field ?? "publishers-0-name" });
  m.publishers.forEach((p, index) => {
    // A listed publisher collects its share through a PRO, so it needs one too (Self-published and BMI writers with no
    // publisher list none, so they're never asked).
    if (p.name.trim() && !hasPro(p.pro)) out.push({ pillar: "performance", text: `${p.name}: no PRO affiliation for the publisher`, field: `publishers-${index}-pro` });
    if (p.name.trim() && !isIpi(p.ipi ?? "")) out.push({ pillar: "mechanical", text: `${p.name}: missing publisher IPI`, field: `publishers-${index}-ipi` });
  });
  // Your PRO assigns the ISWC after you register; The MLC doesn't need one to register the song.
  if (!m.iswc) out.push({ pillar: "performance", text: "No ISWC yet. Your PRO assigns it after you register the song; add it then. The MLC doesn't need it to register.", field: "iswc", low: true });
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
