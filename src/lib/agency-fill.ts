import { matchWork, type ListMatch, type ListResult, type ListWork, type ListWriter } from "@/lib/agency-lists";
import type { CatalogTrack } from "@/lib/catalog";
import { emptyContributor, emptyMetadata, type Contributor, type Metadata } from "@/lib/metadata";

/**
 * Filling a catalog from an agency list. The list is the agency's own record of the work, so it can start an entry
 * with the title, codes, writers, IPI numbers and shares it carries; everything only the member knows (album, release
 * date, genre, duration) is left blank for them to finish in My Catalog. A song the catalog already has is never
 * rewritten without the member choosing the agency's version over their own.
 */
export type AgencyFill = { work: ListWork; metadata: Metadata };
export type AgencyDuplicate = { track: CatalogTrack; work: ListWork; agency: Metadata };
export type FillPlan = { creates: AgencyFill[]; duplicates: AgencyDuplicate[] };

/** Shares as the list states them, brought to a 100% total (agencies use 100, 200 or writer-half scales). */
export function writerShares(writers: ListWriter[]): number[] {
  const total = writers.reduce((n, w) => n + (w.share ?? 0), 0);
  const out = writers.map((w) => (w.share === undefined || total <= 0 ? 0 : Math.round((w.share / total) * 10000) / 100));
  // Rounding three 33.33% shares gives 99.99; the last writer with a share carries the difference so the total is 100.
  const sum = out.reduce((n, x) => n + x, 0);
  const last = out.map((v, i) => [v, i] as const).filter(([v]) => v > 0).pop();
  if (last && Math.abs(sum - 100) >= 0.01) out[last[1]] = Math.round((out[last[1]]! + (100 - sum)) * 100) / 100;
  return out;
}

/** The entry a list's work starts: everything the agency sent, and blanks for what only the member knows. */
export function agencyMetadata(work: ListWork, artist: string): Metadata {
  const shares = writerShares(work.writers);
  const writers: Contributor[] = work.writers.map((w, i) => ({
    ...emptyContributor(),
    name: w.name,
    legalName: w.name,
    // The list doesn't say which half a writer wrote, so they start covering both; the member can change it.
    role: "Author/Composer",
    pro: w.pro ?? "",
    ipi: w.ipi ?? "",
    percentage: shares[i] ? String(shares[i]) : "",
  }));
  return {
    ...emptyMetadata(),
    title: work.title,
    artist,
    // Only codes in the shape the catalog validates are kept; anything else would block the member's next save.
    isrc: /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(work.isrc) ? work.isrc : "",
    iswc: /^T\d{10}$/i.test(work.iswc) ? work.iswc.toUpperCase() : "",
    writers: writers.length ? writers : [emptyContributor()],
  };
}

/** The agency's version of a song already in the catalog: its codes and writers replace the catalog's, the rest stays. */
export function agencyVersion(existing: Metadata, work: ListWork, artist: string): Metadata {
  const agency = agencyMetadata(work, artist || existing.artist);
  return {
    ...existing,
    artist: existing.artist || agency.artist,
    isrc: agency.isrc || existing.isrc,
    iswc: agency.iswc || existing.iswc,
    writers: work.writers.length ? agency.writers : existing.writers,
  };
}

/** What filling this list would do: new songs to add, and the ones already catalogued (kept unless chosen). */
export function fillPlan(result: ListResult, tracks: CatalogTrack[], artist: string): FillPlan {
  const creates: AgencyFill[] = [];
  const duplicates: AgencyDuplicate[] = [];
  // Matched against the whole list, never one work at a time: two works can share a title, and the writers decide
  // which of them a catalogued song is. Checked against the catalog as it is now, so a song added after the upload is a
  // duplicate, not a second copy.
  const listed = [...result.matched, ...result.differences].map((m) => m.work).concat(result.extra)
    .filter((w): w is ListWork => !!w);
  for (const work of result.extra) {
    const track = tracks.find((t) => matchWork(listed, t) === work);
    if (track) duplicates.push({ track, work, agency: agencyVersion(track.metadata, work, artist) });
    else creates.push({ work, metadata: agencyMetadata(work, artist) });
  }
  const seen = new Set(duplicates.map((d) => d.track.id));
  for (const m of [...result.matched, ...result.differences] as ListMatch[]) {
    if (!m.work) continue;
    const track = tracks.find((t) => t.id === m.trackId);
    if (track && !seen.has(track.id)) { seen.add(track.id); duplicates.push({ track, work: m.work, agency: agencyVersion(track.metadata, m.work, artist) }); }
  }
  return { creates, duplicates };
}

/** What an entry started from a list still needs before it can be registered, in plain words. */
export function finishItems(m: Metadata): string[] {
  return [
    m.album.trim() ? "" : "album or single title",
    m.releaseType.trim() ? "" : "release type",
    m.duration.trim() ? "" : "duration",
    m.primaryGenre.trim() ? "" : "genre",
    m.releaseDate.trim() || m.unreleased ? "" : "release date",
    m.writers.some((w) => (w.legalName ?? w.name).trim()) ? "" : "writer names",
  ].filter((x): x is string => !!x);
}
