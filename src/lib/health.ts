import { auditTrack, type Issue, type Pillar } from "@/lib/audit";
import type { CatalogTrack } from "@/lib/catalog";
import { compareLookup, type Finding, type StreamingHit, type WorkHit } from "@/lib/lookups";
import { creditName } from "@/lib/metadata";
import { INTERNATIONAL, societyForPro, type Country, type Society } from "@/lib/repertoires";

/** A saved repertoire check (public.repertoire_checks). */
export type RepertoireCheck = { trackId: string; society: string; status: "found" | "not_listed"; source: "self" | "auto"; workId?: string | null; details?: unknown; checkedAt: string };

export const PILLAR_ORDER: Pillar[] = ["performance", "digital", "mechanical"];
/** Plain-language name for each kind of royalty; pillarTerm is the official term shown underneath. */
export function pillarLabel(p: Pillar, country: Country) {
  if (p === "performance") return "Songwriter airplay pay";
  if (p === "mechanical") return "Songwriter streaming pay";
  return country.code === "US" ? "Artist radio pay" : "Recording airplay pay";
}
export function pillarTerm(p: Pillar, country: Country) {
  if (p === "performance") return "Performance royalties";
  if (p === "mechanical") return "Mechanical royalties";
  return country.code === "US" ? "Digital performance royalties" : "Neighbouring rights";
}
export const PILLAR_HINT: Record<Pillar, string> = {
  performance: "Paid to songwriters when the song is played on radio, TV, streaming and live.",
  digital: "Paid to the artist and label when the recording is played on digital and satellite radio.",
  mechanical: "Paid to songwriters each time the song is streamed or downloaded.",
};

/** "confirmed": found in a society; "missing": every society checked says not listed; "unchecked": not looked yet. */
export type PillarState = "confirmed" | "missing" | "unchecked";
export type PillarRow = { pillar: Pillar; societies: { society: Society; check?: RepertoireCheck | undefined }[]; state: PillarState; dataIssues: Issue[] };
export type TrackReport = {
  track: CatalogTrack;
  issues: Issue[];
  pillars: PillarRow[];
  streaming?: { hit: StreamingHit | null; checkedAt: string } | undefined;
  work?: { hit: WorkHit | null; checkedAt: string } | undefined;
  findings: Finding[];
};

const writerNames = (t: CatalogTrack) => [...t.metadata.writers, ...t.metadata.composers].map(creditName).filter(Boolean);

/** Societies a song should be found in for one pillar. Performance follows the writers' own PROs, wherever they are. */
export function societiesFor(t: CatalogTrack, country: Country, pillar: Pillar): Society[] {
  if (pillar === "performance") {
    const own = [...t.metadata.writers, ...t.metadata.composers].map((w) => societyForPro(w.pro)).filter((s): s is Society => !!s);
    if (own.length) return [...new Map(own.map((s) => [s.id, s])).values()];
  }
  return country.societies[pillar] ?? [];
}

export function trackReport(t: CatalogTrack, country: Country, checks: RepertoireCheck[]): TrackReport {
  const mine = checks.filter((c) => c.trackId === t.id);
  const issues = auditTrack(t);
  const pillars = PILLAR_ORDER.flatMap((pillar): PillarRow[] => {
    const list = societiesFor(t, country, pillar);
    if (!list.length) return [];
    const societies = list.map((society) => ({ society, check: mine.find((c) => c.society === society.id) }));
    const state: PillarState = societies.some((s) => s.check?.status === "found") ? "confirmed"
      : societies.every((s) => s.check?.status === "not_listed") ? "missing" : "unchecked";
    return [{ pillar, societies, state, dataIssues: issues.filter((i) => i.pillar === pillar) }];
  });
  const auto = (id: string) => { const c = mine.find((x) => x.society === id && x.source === "auto"); return c && { hit: c.status === "found" ? (c.details as never) : null, checkedAt: c.checkedAt }; };
  const streaming = auto(INTERNATIONAL.deezer.id) as TrackReport["streaming"];
  const work = auto(INTERNATIONAL.musicbrainz.id) as TrackReport["work"];
  const found = streaming || work ? compareLookup({ streaming: streaming?.hit ?? null, work: work?.hit ?? null }, {
    title: t.title, artist: t.artist, isrc: t.metadata.isrc, iswc: t.metadata.iswc, writers: writerNames(t),
  }) : [];
  const findings = found;
  // When a lookup already says how to fix a field (e.g. "add ISWC T-…"), drop the vaguer data issue for that field.
  const covered = new Set(findings.filter((f) => f.level === "warn").map((f) => f.field));
  const shownIssues = issues.filter((i) => !(i.field && covered.has(i.field as never)));
  return { track: t, issues: shownIssues, pillars: pillars.map((p) => ({ ...p, dataIssues: p.dataIssues.filter((i) => shownIssues.includes(i)) })), streaming, work, findings };
}

/**
 * The whole catalog's health. Data = share of song × pillar cells with complete data; Registered = share confirmed
 * in a society. The headline score weighs both equally, so a perfectly filled-in but unregistered catalog is 50%.
 */
export function healthReport(tracks: CatalogTrack[], country: Country, checks: RepertoireCheck[]) {
  const rows = tracks.map((t) => trackReport(t, country, checks));
  const cells = rows.flatMap((r) => r.pillars);
  const dataOk = cells.filter((c) => !c.dataIssues.length).length;
  const confirmed = cells.filter((c) => c.state === "confirmed").length;
  const pct = (n: number) => (cells.length ? Math.round((n / cells.length) * 100) : 0);
  const warnings = rows.reduce((n, r) => n + r.findings.filter((f) => f.level === "warn").length, 0);
  return {
    rows,
    cells: cells.length,
    dataScore: pct(dataOk),
    registeredScore: pct(confirmed),
    score: cells.length ? Math.round((pct(dataOk) + pct(confirmed)) / 2) : 0,
    confirmed,
    missing: cells.filter((c) => c.state === "missing").length,
    unchecked: cells.filter((c) => c.state === "unchecked").length,
    needsAction: rows.filter((r) => r.issues.length || r.findings.some((f) => f.level === "warn") || r.pillars.some((p) => p.state === "missing")).length,
    warnings,
    byPillar: PILLAR_ORDER.map((pillar) => {
      const list = cells.filter((c) => c.pillar === pillar);
      return { pillar, total: list.length, confirmed: list.filter((c) => c.state === "confirmed").length, dataOk: list.filter((c) => !c.dataIssues.length).length };
    }).filter((p) => p.total),
  };
}

/** One thing the user can do to get paid, in the order it should be done: fix song info, register, then confirm. */
export type TodoItem =
  | { kind: "fix"; track: CatalogTrack; text: string; field?: string | undefined }
  | { kind: "register" | "confirm"; track: CatalogTrack; pillar: Pillar; society: Society };

export function todoList(report: { rows: TrackReport[] }): TodoItem[] {
  const fix: TodoItem[] = [], register: TodoItem[] = [], confirm: TodoItem[] = [];
  for (const r of report.rows) {
    for (const i of r.issues) fix.push({ kind: "fix", track: r.track, text: i.text, field: i.field });
    for (const f of r.findings) if (f.level === "warn") fix.push({ kind: "fix", track: r.track, text: f.text, field: f.field === "writers" ? "writers-0-legalName" : f.field });
    for (const p of r.pillars) {
      if (p.state === "confirmed") continue;
      for (const { society, check } of p.societies) {
        // Performance lists every possible PRO when writers have none; the writer only joins one, so ask once.
        if (check?.status === "not_listed") register.push({ kind: "register", track: r.track, pillar: p.pillar, society });
        else if (!check && (p.pillar !== "performance" || p.societies.length === 1 || society === p.societies[0]!.society)) confirm.push({ kind: "confirm", track: r.track, pillar: p.pillar, society });
      }
    }
  }
  return [...fix, ...register, ...confirm];
}
