import { creditName, writerRole, type Contributor, type Metadata } from "@/lib/metadata";
import { splitStatus } from "@/lib/splits-total";

/** Registration targets. Only PRO registration (BMI/ASCAP) also needs each writer's PRO affiliation. */
export type ReadinessTarget = "mlc" | "soundexchange" | "pro";
export type MissingCode = "author" | "composer" | "legal_name" | "pro" | "split";
/** `field` is the form input id to jump to, e.g. "writers-1-legalName". */
export type MissingItem = { code: MissingCode; message: string; field: string };
export type Readiness = { ready: boolean; missing: MissingItem[] };

type Listed = { row: Contributor; group: "writers" | "composers"; index: number; author: boolean; composer: boolean };

/** A row counts once anything is filled in, so a share or IPI without a name gets flagged too. */
const used = (r: Contributor) => !!(creditName(r) || r.pro?.trim() || r.ipi?.trim() || r.percentage?.trim());

const listed = (m: Pick<Metadata, "writers" | "composers">): Listed[] => {
  const out: Listed[] = [];
  (m.writers ?? []).forEach((row, index) => {
    if (!used(row)) return;
    const role = writerRole(row.role);
    out.push({ row, group: "writers", index, author: role !== "Composer", composer: role !== "Author" });
  });
  // Entries saved before writer roles existed are composers.
  (m.composers ?? []).forEach((row, index) => {
    if (used(row)) out.push({ row, group: "composers", index, author: false, composer: true });
  });
  return out;
};

/**
 * The single source of truth for registration readiness. Every feature (embed indicator, catalog badge,
 * export gate, registration sessions) calls this — never re-implement it.
 * Ready = (has an author OR is instrumental) AND has a composer AND every writer has a legal name
 * AND the writer splits add up to exactly 100% (agencies won't register anything else).
 * SoundExchange registers the recording, not the song, so its export doesn't check splits.
 * Author/Composer counts toward both. Embedding and saving are never gated on this.
 */
export function registrationReadiness(m: Pick<Metadata, "writers" | "composers" | "instrumental">, target?: ReadinessTarget): Readiness {
  const people = listed(m);
  const missing: MissingItem[] = [];
  const first = people[0];
  const roleField = first?.group === "writers" ? `writers-${first.index}-role` : "writers-0-legalName";
  if (!m.instrumental && !people.some((p) => p.author)) missing.push({ code: "author", message: "Who wrote the lyrics? Set a writer's Role to Author or Author/Composer. No lyrics? Check Instrumental.", field: roleField });
  if (!people.some((p) => p.composer)) missing.push({ code: "composer", message: "Who made the music? Set a writer's Role to Composer or Author/Composer.", field: roleField });
  for (const p of people) {
    const who = creditName(p.row) || `writer ${p.index + 1}`;
    if (!p.row.legalName?.trim()) missing.push({ code: "legal_name", message: `Add a legal name for ${who}`, field: `${p.group}-${p.index}-legalName` });
    if (target === "pro" && (!p.row.pro?.trim() || p.row.pro === "None")) missing.push({ code: "pro", message: `Add a PRO affiliation for ${who}`, field: `${p.group}-${p.index}-pro` });
  }
  if (people.length && target !== "soundexchange") {
    const split = splitStatus(people.map((p) => p.row));
    const at = `${first!.group}-${first!.index}-share`;
    if (split.state === "empty") missing.push({ code: "split", message: "Add each writer's split. Splits must add up to exactly 100% to register.", field: at });
    else if (split.state === "under") missing.push({ code: "split", message: `Writer splits total ${split.total}%. Add the missing ${split.left}% so they equal exactly 100%.`, field: at });
    else if (split.state === "over") missing.push({ code: "split", message: `Writer splits total ${split.total}%. Lower them by ${split.over}% so they equal exactly 100%.`, field: at });
  }
  return { ready: missing.length === 0, missing };
}

/** Writers for registration and exports, always under their legal name. Only call on ready songs. */
export function registrationWriters(m: Pick<Metadata, "writers" | "composers">) {
  return listed(m).map(({ row, author, composer }) => ({
    ...row,
    name: creditName(row),
    role: author && composer ? "Author/Composer" : author ? "Author" : "Composer",
  }));
}
