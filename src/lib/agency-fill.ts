import { matchWork, sameWriter, scaledShares, workIssues, type ListMatch, type ListResult, type ListWork, type ListWriter } from "@/lib/agency-lists";
import type { CatalogTrack } from "@/lib/catalog";
import { creditName, emptyContributor, emptyMetadata, type Contributor, type Metadata } from "@/lib/metadata";

/**
 * Filling a catalog from an agency list. The list is the agency's own record of the work, so it can start an entry
 * with the title, codes, writers, IPI numbers and shares it carries; everything only the member knows (album, release
 * date, genre, duration) is left blank for them to finish in My Catalog. A song the catalog already has is never
 * rewritten without the member choosing the agency's version over their own.
 */
export type AgencyFill = { work: ListWork; metadata: Metadata };
/** One row of the side-by-side the member sees before choosing: the catalog's value, and the agency's. */
export type FieldChange = { field: string; catalog: string; agency: string };
export type AgencyDuplicate = { track: CatalogTrack; work: ListWork; agency: Metadata; issues: string[]; changes: FieldChange[] };
export type FillPlan = { creates: AgencyFill[]; duplicates: AgencyDuplicate[] };

/**
 * Shares as the list states them, brought to a 100% total. The rule lives in agency-lists.ts (`scaledShares`), so the
 * comparison, this dialog and the saved catalog can never disagree about a BMI 200% row.
 */
export const writerShares = scaledShares;

/** The entry a list's work starts: everything the agency sent, and blanks for what only the member knows. */
export function agencyMetadata(work: ListWork, artist: string): Metadata {
  const shares = writerShares(work.writers);
  const writers: Contributor[] = work.writers.map((w, i) => ({
    ...emptyContributor(),
    name: w.name,
    legalName: w.name,
    // A registration doesn't say who wrote the words and who wrote the music (founder, 2026-11-09), so it stays blank
    // and `finishItems` asks for it rather than claiming both halves for every writer.
    role: "",
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
  // The list never says author or composer, so it leaves the role blank; a role the catalog already knows is kept rather
  // than wiped by adopting the agency's writers, which would throw away the member's own answer.
  const known = [...existing.writers, ...existing.composers].filter((w) => (w.role ?? "").trim());
  const keptRole = (name: string) => (known.find((k) => sameWriter(creditName(k) || k.name, name))?.role ?? "");
  return {
    ...existing,
    artist: existing.artist || agency.artist,
    isrc: agency.isrc || existing.isrc,
    iswc: agency.iswc || existing.iswc,
    writers: work.writers.length ? agency.writers.map((w) => ({ ...w, role: (w.role ?? "").trim() ? w.role : keptRole(w.name) })) : existing.writers,
  };
}

/** The catalog's writers as one line: "Qui-Ona Peterson 100% · Bo Ray 50%". */
const catalogWriters = (m: Metadata) => [...m.writers, ...m.composers].filter((w) => creditName(w))
  .map((w) => `${creditName(w)}${w.percentage ? ` ${Number(w.percentage)}%` : ""}`).join(" · ");
/**
 * The list's writers the same way, so the two columns read alike — on the composition's 100% scale, because BMI prints
 * the writer's half and the publisher's half together (200% there is 100% of the composition).
 */
const listWriters = (writers: ListWriter[]) => {
  const shares = scaledShares(writers);
  return writers.map((w, i) => `${w.name}${shares[i] ? ` ${Math.round(shares[i]!)}%` : ""}`).join(" · ");
};

/** The fields that actually differ, so the dialog only shows what the member has to decide about. */
export function fieldChanges(existing: Metadata, work: ListWork): FieldChange[] {
  const rows: FieldChange[] = [];
  // A field the list doesn't carry is never offered: adopting the agency's version would leave the catalog's value in place.
  if (work.isrc) rows.push({ field: "ISRC", catalog: existing.isrc.trim() || "none", agency: work.isrc });
  if (work.iswc) rows.push({ field: "ISWC", catalog: existing.iswc.trim() || "none", agency: work.iswc });
  if (work.writers.length) rows.push({ field: "Writers", catalog: catalogWriters(existing) || "none", agency: listWriters(work.writers) });
  return rows.filter((r) => r.catalog.toUpperCase() !== r.agency.toUpperCase());
}

/** One duplicate, ready for the dialog: what differs, in words and field by field. */
const duplicateOf = (track: CatalogTrack, work: ListWork, artist: string): AgencyDuplicate => ({
  track, work, agency: agencyVersion(track.metadata, work, artist),
  issues: workIssues(work, track.metadata),
  changes: fieldChanges(track.metadata, work),
});

/** What filling this list would do: new songs to add, and the differing songs already catalogued. */
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
    if (!track) { creates.push({ work, metadata: agencyMetadata(work, artist) }); continue; }
    // Only a song that actually differs needs a decision; one already identical to the list is left alone.
    const duplicate = duplicateOf(track, work, artist);
    if (duplicate.issues.length || duplicate.changes.length) duplicates.push(duplicate);
  }
  const seen = new Set(duplicates.map((d) => d.track.id));
  // Read again from the catalog as it is now, not from the upload: a song fixed since then has nothing left to decide.
  for (const m of [...result.matched, ...result.differences] as ListMatch[]) {
    if (!m.work) continue;
    const track = tracks.find((t) => t.id === m.trackId);
    if (!track || seen.has(track.id)) continue;
    const duplicate = duplicateOf(track, m.work, artist);
    if (!duplicate.issues.length && !duplicate.changes.length) continue;
    seen.add(track.id);
    duplicates.push(duplicate);
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
    m.writers.every((w) => !(w.role ?? "").trim()) ? "each writer's role, author or composer — the list doesn't say which" : "",
  ].filter((x): x is string => !!x);
}
