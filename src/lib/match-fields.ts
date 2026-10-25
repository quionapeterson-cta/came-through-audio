import { isIpi, isIsrc, isIswc } from "@/lib/audit";
import type { Finding } from "@/lib/lookups";
import { creditName, type Metadata } from "@/lib/metadata";

/**
 * What royalty collection agencies match a song by: its codes (ISRC, ISWC), its title and its writers (named, with IPI
 * numbers). These carry the most weight in every health score (founder, 2026-10-25); everything else is the rest.
 */
export const MATCH_WEIGHT = 0.6;
/** Duration is required for 100% but weighs little: it only helps tell apart songs with similar titles and artists. */
export const DURATION_WEIGHT = 0.05;

export type MatchCheck = { id: "title" | "isrc" | "iswc" | "writers" | "ipi" | "live"; label: string; ok: boolean };

export function matchChecks(m: Pick<Metadata, "title" | "isrc" | "iswc" | "writers" | "composers" | "duration">, findings: Finding[] = []): MatchCheck[] {
  const writers = [...m.writers, ...m.composers].filter((w) => creditName(w) || w.ipi?.trim());
  const live = findings.some((f) => f.level === "warn" && (f.field === "title" || f.field === "isrc"));
  return [
    { id: "title", label: "Title", ok: !!m.title.trim() },
    { id: "isrc", label: "ISRC", ok: isIsrc(m.isrc ?? "") },
    { id: "iswc", label: "ISWC", ok: isIswc(m.iswc ?? "") },
    { id: "writers", label: "Writers named", ok: writers.length > 0 && writers.every((w) => !!creditName(w)) },
    { id: "ipi", label: "Writer IPI numbers", ok: writers.length > 0 && writers.every((w) => isIpi(w.ipi ?? "")) },
    // Streaming showing a different title or ISRC is a matching problem too.
    { id: "live", label: "Title and ISRC match streaming", ok: !live },
  ];
}

/** Share of the match checks passed, 0–1. */
export const matchScore = (checks: MatchCheck[]) => checks.filter((c) => c.ok).length / checks.length;

/**
 * One song's score: match fields 60%, every other required field 35%, duration 5%. 100% only when all three are
 * complete; anything missing keeps it below 100%.
 */
export function weightedScore(match: number, rest: number, duration = 1) {
  const v = MATCH_WEIGHT * match + (1 - MATCH_WEIGHT - DURATION_WEIGHT) * rest + DURATION_WEIGHT * duration;
  return match === 1 && rest === 1 && duration === 1 ? 1 : Math.min(v, 0.99);
}
export const hasDuration = (m: Pick<Metadata, "duration">) => ((m.duration ?? "").trim() ? 1 : 0);
