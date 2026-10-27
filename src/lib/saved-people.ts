import { creditName, writerRole, type Contributor } from "@/lib/metadata";
import type { ArtistProfile } from "@/lib/artist-profile";
import type { SavedContributor } from "@/lib/splits";

/**
 * Writers, publishers and producers the user has worked with, from their Catalog Profile, Contributor Library and past
 * songs, so a name typed (or picked) on a new song brings that person's saved details with it (founder, 2026-10-27).
 */
export type PeopleGroup = "writers" | "publishers" | "producers";
export type SavedPeople = Record<PeopleGroup, Contributor[]>;

const WRITER_KINDS = ["Writer", "Composer"];
const key = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/** The library row as a song row. Writers keep one name, their legal name. */
export function fromLibrary(c: SavedContributor): Contributor {
  const writer = WRITER_KINDS.includes(c.kind);
  return {
    name: writer ? "" : c.name, ...(writer && { legalName: c.name }), pro: c.pro, ipi: c.ipi, percentage: c.share ?? "",
    ...(writer && { role: c.role || (c.kind === "Composer" ? "Composer" : undefined) }),
  };
}

/** Earlier sources win; later ones only fill what's still blank. */
function merge(lists: Contributor[][]): Contributor[] {
  const out = new Map<string, Contributor>();
  for (const row of lists.flat()) {
    const name = creditName(row);
    if (!name) continue;
    const k = key(name);
    const prev = out.get(k);
    if (!prev) { out.set(k, { ...row }); continue; }
    out.set(k, {
      ...prev,
      pro: prev.pro || row.pro, ipi: prev.ipi || row.ipi, percentage: prev.percentage || row.percentage,
      role: prev.role || row.role, hfa: prev.hfa || row.hfa,
    });
  }
  return [...out.values()].sort((a, b) => creditName(a).localeCompare(creditName(b)));
}

/**
 * Everyone saved, by group. A writer's usual split comes only from the profile or the library: a share on one past song
 * isn't their usual share on the next, so past songs give names, roles, PROs and IPIs only.
 */
export function savedPeople(profile: ArtistProfile | null, library: SavedContributor[], songs: { writers: Contributor[]; composers?: Contributor[]; publishers?: Contributor[]; producers?: Contributor[] }[]): SavedPeople {
  const lib = (kinds: string[]) => library.filter((c) => kinds.includes(c.kind)).map(fromLibrary);
  const past = (pick: (s: (typeof songs)[number]) => Contributor[] | undefined) => songs.flatMap((s) => pick(s) ?? []).map((r) => ({ ...r, percentage: "", pubShare: "", publishing: undefined }));
  return {
    writers: merge([profile?.writers ?? [], profile?.composers ?? [], lib(WRITER_KINDS), past((s) => [...s.writers, ...(s.composers ?? [])])]),
    publishers: merge([profile?.publishers ?? [], lib(["Publisher"]), past((s) => s.publishers)]),
    producers: merge([profile?.producers ?? [], lib(["Producer"]), past((s) => s.producers)]),
  };
}

/** The saved person whose name matches exactly (ignoring case and extra spaces), if any. */
export function findSaved(list: Contributor[], name: string): Contributor | undefined {
  const k = key(name);
  return k ? list.find((p) => key(creditName(p)) === k) : undefined;
}

/** Fills a row's blanks from the saved person. Nothing already on the row is replaced. */
export function fillFromSaved(row: Contributor, saved: Contributor, writer: boolean): Contributor {
  return {
    ...row,
    pro: row.pro || saved.pro, ipi: row.ipi || saved.ipi, percentage: row.percentage || saved.percentage,
    ...(writer && { role: row.role || saved.role }),
    ...(!writer && (row.hfa || saved.hfa) && { hfa: row.hfa || saved.hfa }),
  };
}

/** A song's writers, publishers and producers as library rows, to remember them for next time. */
export function libraryRowsOf(m: { writers: Contributor[]; composers?: Contributor[]; publishers?: Contributor[]; producers?: Contributor[] }): SavedContributor[] {
  const row = (r: Contributor, kind: string, writer = false): SavedContributor => ({
    name: creditName(r), kind, email: "", pro: r.pro, ipi: r.ipi, publisher: "", label: "",
    ...(writer && { role: writerRole(r.role) }),
  });
  return [
    ...m.writers.filter(creditName).map((r) => row(r, "Writer", true)),
    // Entries saved before writer roles existed were composers.
    ...(m.composers ?? []).filter(creditName).map((r) => row({ ...r, role: r.role || "Composer" }, "Writer", true)),
    ...(m.publishers ?? []).filter(creditName).map((r) => row(r, "Publisher")),
    ...(m.producers ?? []).filter(creditName).map((r) => row(r, "Producer")),
  ];
}
