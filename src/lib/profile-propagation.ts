import { creditName, type Contributor, type Metadata } from "@/lib/metadata";
import type { ArtistProfile } from "@/lib/artist-profile";

/**
 * Carrying a corrected profile through the catalog (founder, 2026-11-08). Saving Embed Defaults or Catalog Profile used
 * to fill only blanks, so a corrected IPI or PRO never reached the songs already saved — the profile said one thing and
 * every existing song kept the old one. This plan is what the member is shown before anything is written: how many
 * songs gain a code, and how many hold a different one. Nothing is rewritten without that yes, and only the person's own
 * codes move: names, roles, shares and every song-specific field stay exactly as the song has them.
 */

export type SongLike = { id: string; metadata: Metadata };

export type Propagation = {
  /** Songs missing a PRO or IPI the profile now has: filled on the member's yes. */
  fill: { id: string; title: string }[];
  /** Songs holding a different PRO or IPI for the same person: corrected on the member's yes, and named. */
  change: { id: string; title: string; what: string }[];
  total: number;
};

const ROW_GROUPS = ["writers", "composers", "producers", "publishers"] as const;
/**
 * The five agency answers a profile holds (founder, 2026-11-12). A song that is blank takes the profile's answer; a song
 * that already names a different country keeps it, because that is the song's own record and not a mistake to correct.
 */
export const COUNTRY_DEFAULTS = ["masteredIn", "ownerNationality", "firstReleaseCountry", "releaseCountry", "collectionTerritories"] as const;
const CODES = ["pro", "ipi"] as const;

const nameOf = (r: Contributor) => creditName(r).trim().toLowerCase();

/** The saved rows a song's own rows are matched against, by the name on the credit. */
const matches = (song: Contributor[], saved: Contributor[]) =>
  song
    .map((row) => ({ row, saved: saved.find((s) => nameOf(s) && nameOf(s) === nameOf(row)) }))
    .filter((m): m is { row: Contributor; saved: Contributor } => !!m.saved);

/**
 * What a save would reach: codes it can fill, and the songs where the catalog disagrees with the profile. Never
 * proposes adding a person the song doesn't already credit, because a song's writers are the song's own record.
 */
export function propagationPlan(profile: ArtistProfile | null, songs: SongLike[]): Propagation {
  const fill: Propagation["fill"] = [];
  const change: Propagation["change"] = [];
  if (!profile) return { fill, change, total: 0 };
  for (const song of songs) {
    let fills = false;
    const corrections: string[] = [];
    for (const g of ROW_GROUPS) {
      for (const { row, saved } of matches(song.metadata[g] ?? [], profile[g] ?? [])) {
        for (const field of CODES) {
          const want = (saved[field] ?? "").trim();
          const has = (row[field] ?? "").trim();
          if (!want) continue;
          if (!has) fills = true;
          else if (has.toLowerCase() !== want.toLowerCase()) corrections.push(`${creditName(row)}: ${field.toUpperCase()} ${has} → ${want}`);
        }
      }
    }
    for (const key of COUNTRY_DEFAULTS) {
      if (!(song.metadata[key] ?? "").trim() && (profile[key] ?? "").trim()) fills = true;
    }
    if (fills) fill.push({ id: song.id, title: song.metadata.title || "Untitled" });
    if (corrections.length) change.push({ id: song.id, title: song.metadata.title || "Untitled", what: corrections.join("; ") });
  }
  const total = new Set([...fill, ...change].map((s) => s.id)).size;
  return { fill, change, total };
}

/**
 * The song with the person's codes as the profile now has them. Only PRO and IPI are written — the same two fields the
 * plan named — so what the member agreed to is exactly what changes.
 */
export function propagated(m: Metadata, profile: ArtistProfile): Metadata {
  const out = { ...m };
  for (const g of ROW_GROUPS) {
    out[g] = out[g].map((row) => {
      const saved = (profile[g] ?? []).find((s) => nameOf(s) && nameOf(s) === nameOf(row));
      if (!saved) return row;
      const pro = (saved.pro ?? "").trim();
      const ipi = (saved.ipi ?? "").trim();
      if (!pro && !ipi) return row;
      return { ...row, pro: pro || row.pro, ipi: ipi || row.ipi };
    });
  }
  for (const key of COUNTRY_DEFAULTS) {
    const want = (profile[key] ?? "").trim();
    if (want && !(out[key] ?? "").trim()) out[key] = want;
  }
  return out;
}
