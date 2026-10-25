import { auditTrack, type Issue, type Pillar } from "@/lib/audit";
import type { CatalogTrack } from "@/lib/catalog";
import { compareLookup, type Finding, type StreamingHit } from "@/lib/lookups";
import { INTERNATIONAL, societyForPro, type Country, type Society } from "@/lib/repertoires";
import { hasDuration, matchChecks, matchScore, weightedScore } from "@/lib/match-fields";
import { registrationCheck, type RegistrationAgency } from "@/lib/readiness";
import { isInspectorSong } from "@/lib/health-songs";

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
  findings: Finding[];
};

/** Societies a song should be found in for one pillar. Performance follows the writers' own PROs, wherever they are. */
export function societiesFor(t: CatalogTrack, country: Country, pillar: Pillar): Society[] {
  if (pillar === "performance") {
    const own = [...t.metadata.writers, ...t.metadata.composers].map((w) => societyForPro(w.pro)).filter((s): s is Society => !!s);
    if (own.length) return [...new Map(own.map((s) => [s.id, s])).values()];
  }
  return country.societies[pillar] ?? [];
}

/**
 * Each pillar's field list. Performance uses BMI's, the strictest PRO list (duration, genre, written-for, label), so
 * "every field" means the same thing for every writer; it still lets BMI writers go without a publisher.
 */
const PILLAR_AGENCY: Record<Pillar, RegistrationAgency> = { performance: "bmi", mechanical: "mlc", digital: "soundexchange" };

/**
 * Every field the agencies require counts toward 100% (founder, 2026-10-25), read from the shared readiness check
 * (registrationCheck), never re-implemented here. Catalog songs only: Royalty Inspector songs are held to the fields
 * the Inspector asks for. Duration comes from the audit as a low-weight item.
 */
function requiredIssues(t: CatalogTrack, pillars: Pillar[], have: Issue[]): Issue[] {
  if (isInspectorSong(t.id)) return [];
  const seen = new Set(have.map((i) => i.field));
  const agency = PILLAR_AGENCY;
  const out: Issue[] = [];
  for (const pillar of pillars) {
    for (const x of registrationCheck(t.metadata, agency[pillar]).missing) {
      if (x.code === "duration" || seen.has(x.field)) continue;
      seen.add(x.field);
      out.push({ pillar, text: x.message, field: x.field });
    }
  }
  return out;
}

export function trackReport(t: CatalogTrack, country: Country, checks: RepertoireCheck[]): TrackReport {
  const mine = checks.filter((c) => c.trackId === t.id);
  const audited = auditTrack(t);
  const issues = [...audited, ...requiredIssues(t, PILLAR_ORDER.filter((p) => societiesFor(t, country, p).length), audited)];
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
  // Saved MusicBrainz results from before it was removed are ignored: they never count toward the score.
  const found = streaming ? compareLookup({ streaming: streaming.hit }, { title: t.title, artist: t.artist, isrc: t.metadata.isrc }) : [];
  const findings = found;
  // When a lookup already says how to fix a field (e.g. "add ISWC T-…"), drop the vaguer data issue for that field.
  const covered = new Set(findings.filter((f) => f.level === "warn").map((f) => f.field));
  const shownIssues = issues.filter((i) => !(i.field && covered.has(i.field as never)));
  return { track: t, issues: shownIssues, pillars: pillars.map((p) => ({ ...p, dataIssues: p.dataIssues.filter((i) => shownIssues.includes(i)) })), streaming, findings };
}

/** 100% healthy: no data issues, no lookup warnings, and confirmed in a society for every pillar. */
export const songHealthy = (r: TrackReport) =>
  !r.issues.length && !r.findings.some((f) => f.level === "warn") && r.pillars.length > 0 && r.pillars.every((p) => p.state === "confirmed");

/**
 * The whole catalog's health. Data = each song's details, where the fields agencies match by (codes, title, writers)
 * weigh most (match-fields.ts) and the rest is its share of pillars with complete data; Registered = share of song ×
 * pillar cells confirmed in a society. The headline score weighs both equally, so a perfectly filled-in but
 * unregistered catalog is 50%.
 */
export function healthReport(tracks: CatalogTrack[], country: Country, checks: RepertoireCheck[]) {
  const rows = tracks.map((t) => trackReport(t, country, checks));
  const cells = rows.flatMap((r) => r.pillars);
  const dataOk = cells.filter((c) => !c.dataIssues.length).length;
  // Low-weight items (duration) don't make a pillar incomplete here; they count through their own small weight.
  const full = (p: PillarRow) => !p.dataIssues.some((i) => !i.low);
  const songData = rows.map((r) => weightedScore(matchScore(matchChecks(r.track.metadata, r.findings)), r.pillars.length ? r.pillars.filter(full).length / r.pillars.length : 1, hasDuration(r.track.metadata)));
  const dataScore = rows.length ? Math.round((songData.reduce((a, b) => a + b, 0) / rows.length) * 100) : 0;
  const confirmed = cells.filter((c) => c.state === "confirmed").length;
  const pct = (n: number) => (cells.length ? Math.round((n / cells.length) * 100) : 0);
  const warnings = rows.reduce((n, r) => n + r.findings.filter((f) => f.level === "warn").length, 0);
  return {
    rows,
    cells: cells.length,
    dataScore,
    dataCells: dataOk,
    registeredScore: pct(confirmed),
    score: cells.length ? Math.round((dataScore + pct(confirmed)) / 2) : 0,
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
