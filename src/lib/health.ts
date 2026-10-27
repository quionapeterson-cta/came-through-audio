import { auditTrack, type Issue, type Pillar } from "@/lib/audit";
import type { CatalogTrack } from "@/lib/catalog";
import { compareLookup, type Finding, type StreamingHit } from "@/lib/lookups";
import { INTERNATIONAL, societyForPro, type Country, type Society } from "@/lib/repertoires";
import { hasDuration, matchChecks, matchScore, weightedScore, type MatchCheck } from "@/lib/match-fields";
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
 * Which agency's field list a pillar uses (registrationCheck in readiness.ts, never re-implemented here): the writers'
 * own PRO for performance (BMI's list for BMI writers, ASCAP's for everyone else), The MLC's for mechanicals and
 * SoundExchange's for the recording, wherever the song is.
 */
export function pillarRules(t: CatalogTrack, pillar: Pillar, society?: Society | undefined): RegistrationAgency {
  if (pillar === "mechanical") return "mlc";
  if (pillar === "digital") return "soundexchange";
  return society?.id === "bmi" || (!society && [...t.metadata.writers, ...t.metadata.composers].some((w) => societyForPro(w.pro)?.id === "bmi")) ? "bmi" : "ascap";
}

/**
 * Every field the song's agencies require counts toward 100% (founder, 2026-10-25). Catalog songs only: Royalty
 * Inspector songs are held to the fields the Inspector asks for. Duration comes from the audit as a low-weight item.
 */
function requiredIssues(t: CatalogTrack, pillars: { pillar: Pillar; society?: Society | undefined }[], have: Issue[]): Issue[] {
  if (isInspectorSong(t.id)) return [];
  const seen = new Set(have.map((i) => `${i.pillar}|${i.field}`));
  const out: Issue[] = [];
  for (const { pillar, society } of pillars) {
    for (const x of registrationCheck(t.metadata, pillarRules(t, pillar, society)).missing) {
      const key = `${pillar}|${x.field}`;
      if (x.code === "duration" || seen.has(key) || have.some((i) => i.field === x.field)) continue;
      seen.add(key);
      out.push({ pillar, text: x.message, field: x.field });
    }
  }
  return out;
}

export function trackReport(t: CatalogTrack, country: Country, checks: RepertoireCheck[]): TrackReport {
  const mine = checks.filter((c) => c.trackId === t.id);
  const audited = auditTrack(t);
  const issues = [...audited, ...requiredIssues(t, PILLAR_ORDER.flatMap((pillar) => { const list = societiesFor(t, country, pillar); return list.length ? [{ pillar, society: list[0] }] : []; }), audited)];
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

/** What each agency matches a song by (match-fields.ts): PROs by the composition, SoundExchange by the recording. */
const AGENCY_MATCH: Record<Pillar, MatchCheck["id"][]> = {
  performance: ["title", "iswc", "writers", "ipi"],
  // The MLC matches by title, ISRC and writers; it doesn't need an ISWC to register (The MLC, to the founder, 2026-10-27).
  mechanical: ["title", "isrc", "writers", "ipi"],
  digital: ["title", "isrc", "live"],
};
const MATCH_FIELD = (f?: string) => !!f && (["title", "isrc", "iswc"].includes(f) || /^(writers|composers)-\d+-(legalName|ipi)$/.test(f));

/**
 * One score per agency (founder, 2026-10-25): each agency counts only its own fields. `data` (0–1): what that agency
 * matches by 60%, its other required fields 35%, duration 5% (PROs only). `registered`: found in that society.
 * `waiting`: doesn't count yet (SoundExchange before the release date), so it never pulls the song down.
 */
export type AgencyScore = { pillar: Pillar; society: Society; data: number; registered: boolean; missing: Issue[]; waiting?: string | undefined };
export function agencyScores(r: TrackReport, today = new Date().toISOString().slice(0, 10)): AgencyScore[] {
  const m = r.track.metadata;
  const checks = matchChecks(m, r.findings);
  const unreleased = !!m.releaseDate && m.releaseDate > today;
  return r.pillars.map((p) => {
    const society = p.societies.find((s) => s.check?.status === "found")?.society ?? p.societies[0]!.society;
    const match = matchScore(checks.filter((c) => AGENCY_MATCH[p.pillar].includes(c.id)));
    const other = p.dataIssues.filter((i) => !i.low && !MATCH_FIELD(i.field));
    const rest = Math.max(0, 1 - 0.2 * other.length);
    const duration = p.pillar === "performance" ? hasDuration(m) : 1;
    return {
      pillar: p.pillar, society, data: weightedScore(match, rest, duration), registered: p.state === "confirmed", missing: p.dataIssues,
      waiting: p.pillar === "digital" && unreleased ? `${society.name} counts once the song is released (${m.releaseDate}).` : undefined,
    };
  });
}
/** The song's details score (0–1): the average of the agencies that count for it now. */
export function songDataScore(r: TrackReport) {
  const list = agencyScores(r).filter((a) => !a.waiting);
  return list.length ? list.reduce((n, a) => n + a.data, 0) / list.length : 0;
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
  // Each song's details are scored per agency, then averaged (agencyScores); SoundExchange waits for the release.
  const songData = rows.map(songDataScore);
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
