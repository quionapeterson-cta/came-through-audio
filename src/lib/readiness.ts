import { creditName, writerRole, type Contributor, type Metadata } from "@/lib/metadata";
import { splitStatus } from "@/lib/splits-total";

/** Registration targets. Only PRO registration (BMI/ASCAP) also needs each writer's PRO affiliation. */
export type ReadinessTarget = "mlc" | "soundexchange" | "pro";
export type MissingCode = "author" | "composer" | "legal_name" | "pro" | "split"
  | "ipi" | "publisher" | "samples" | "written_for" | "duration" | "genre" | "release" | "isrc" | "upc" | "master" | "iswc";
/** `field` is the form input id to jump to, e.g. "writers-1-legalName". */
export type MissingItem = { code: MissingCode; message: string; field: string };
/** `missing` blocks registration and exports; `warnings` (splits not at 100%) are shown but never hold a song back. */
export type Readiness = { ready: boolean; missing: MissingItem[]; warnings: MissingItem[] };
// Registration assistance treats warnings as blocking: splits must be settled before registering (ExpertAssistance).

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
 * Splits are checked too, as warnings only: writer splits, and publisher shares when any publisher is listed
 * (100% of the publisher half), should each add up to exactly 100%. Agencies won't register anything else, but the
 * user decides, so warnings never hold back an export. Registration assistance does block on them. SoundExchange registers the recording, so it skips splits.
 * Author/Composer counts toward both. Embedding and saving are never gated on this.
 */
export function registrationReadiness(m: Pick<Metadata, "writers" | "composers" | "instrumental"> & { publishers?: Contributor[] }, target?: ReadinessTarget): Readiness {
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
  const warnings: MissingItem[] = [];
  if (people.length && target !== "soundexchange") {
    const split = splitStatus(people.map((p) => p.row));
    const at = `${first!.group}-${first!.index}-share`;
    if (split.state === "empty") warnings.push({ code: "split", message: "Add each writer's split. Splits must add up to exactly 100% to register.", field: at });
    else if (split.state === "under") warnings.push({ code: "split", message: `Writer splits total ${split.total}%. Add the missing ${split.left}% so they equal exactly 100%.`, field: at });
    else if (split.state === "over") warnings.push({ code: "split", message: `Writer splits total ${split.total}%. Lower them by ${split.over}% so they equal exactly 100%.`, field: at });
  }
  const pubs = (m.publishers ?? []).map((row, index) => ({ row, index })).filter(({ row }) => row.name.trim() || row.percentage?.trim() || row.ipi?.trim());
  if (pubs.length && target !== "soundexchange") {
    const share = splitStatus(pubs.map((p) => p.row));
    const at = `publishers-${pubs[0]!.index}-share`;
    if (share.state === "empty") warnings.push({ code: "split", message: "Add each publisher's share. Publisher shares must add up to exactly 100%.", field: at });
    else if (share.state === "under") warnings.push({ code: "split", message: `Publisher shares total ${share.total}%. Add the missing ${share.left}% so they equal exactly 100%.`, field: at });
    else if (share.state === "over") warnings.push({ code: "split", message: `Publisher shares total ${share.total}%. Lower them by ${share.over}% so they equal exactly 100%.`, field: at });
  }
  return { ready: missing.length === 0, missing, warnings };
}

/** Writers for registration and exports, always under their legal name. Only call on ready songs. */
export function registrationWriters(m: Pick<Metadata, "writers" | "composers">) {
  return listed(m).map(({ row, author, composer }) => ({
    ...row,
    name: creditName(row),
    role: author && composer ? "Author/Composer" : author ? "Author" : "Composer",
  }));
}

/** Agencies our team registers with (Expert Registration Assistance). */
export type RegistrationAgency = "ascap" | "bmi" | "mlc" | "soundexchange";
export const REGISTRATION_AGENCY_LABEL: Record<RegistrationAgency, string> = { ascap: "ASCAP", bmi: "BMI", mlc: "The MLC", soundexchange: "SoundExchange" };
/** "ASCAP" / "The MLC" (as stored on a purchase) → agency key. */
export const registrationAgency = (label: string): RegistrationAgency | undefined =>
  (Object.entries(REGISTRATION_AGENCY_LABEL) as [RegistrationAgency, string][]).find(([, l]) => l === label.trim())?.[0];
/** `missing` blocks submitting the song for registration with that agency; `tips` are recommended, never blocking. */
export type RegistrationCheck = { agency: RegistrationAgency; ready: boolean; missing: MissingItem[]; tips: MissingItem[] };

const hasPro = (r: Contributor) => !!r.pro?.trim() && r.pro !== "None";
const isReleased = (date: string, today: string) => !!date && date <= today;

/**
 * What one agency needs before our team registers the song (PLAN-registration-intake §5). Built on registrationReadiness,
 * so the core rules stay in one place. Stricter than the export gate on purpose: it is only used for registration
 * assistance, never for saving, embedding or the user's own exports. Splits always block here.
 */
export function registrationCheck(m: Metadata, agency: RegistrationAgency, today = new Date().toISOString().slice(0, 10)): RegistrationCheck {
  const missing: MissingItem[] = [];
  const tips: MissingItem[] = [];
  const need = (code: MissingCode, message: string, field: string) => missing.push({ code, message, field });
  const tip = (code: MissingCode, message: string, field: string) => tips.push({ code, message, field });
  const pubs = (m.publishers ?? []).map((row, index) => ({ row, index })).filter(({ row }) => creditName(row) || row.percentage?.trim() || row.ipi?.trim());

  if (agency === "soundexchange") {
    if (!m.isrc.trim()) need("isrc", "Add the recording's ISRC. SoundExchange matches every play to it.", "isrc");
    const share = Number(m.masterShare || 0);
    if (!(share > 0 && share <= 100)) need("master", "Add the share of the master you own (most independent artists own 100%).", "masterShare");
    if (!m.upc.trim()) need("upc", "Add the release's UPC (or EAN). SoundExchange needs at least one release for each recording.", "upc");
    if (!m.releaseDate) tip("release", "Add the release date.", "releaseDate");
    if (!m.recordedIn.trim()) tip("release", "Add the country it was recorded in (helps collect royalties outside the US).", "recordedIn");
    return { agency, ready: !missing.length, missing, tips };
  }

  const base = registrationReadiness(m, agency === "mlc" ? "mlc" : "pro");
  missing.push(...base.missing, ...base.warnings);
  // Every writer who belongs to a PRO has an IPI number; all three agencies identify writers by it.
  for (const { row, group, index } of listed(m)) {
    if (hasPro(row) && !row.ipi?.trim()) need("ipi", `Add the IPI name number for ${creditName(row) || `writer ${index + 1}`}. Find it in their ${row.pro} account.`, `${group}-${index}-ipi`);
  }

  // Who collects the publisher share: a listed publisher, or nobody (self-published / self-administered).
  if (m.selfPublished && pubs.length) need("publisher", "You checked Self-published but also listed a publisher. Keep one.", "selfPublished");
  else if (!m.selfPublished && !pubs.length) need("publisher", "Add the song's publisher, or check Self-published (no publisher).", "selfPublished");
  for (const { row, index } of pubs) {
    const who = creditName(row) || `publisher ${index + 1}`;
    if (!creditName(row)) need("publisher", `Add a name for ${who}.`, `publishers-${index}-name`);
    if (agency !== "mlc" && !hasPro(row)) need("pro", `Add a PRO affiliation for ${who}.`, `publishers-${index}-pro`);
    if (agency === "bmi" && !row.ipi?.trim()) need("ipi", `Add the IPI name number for ${who}.`, `publishers-${index}-ipi`);
  }

  if (agency === "mlc") {
    if (!m.isrc.trim()) need("isrc", "Add the recording's ISRC. The MLC pays by matching streams to the song through its recordings.", "isrc");
    if (!m.iswc.trim()) tip("iswc", "Add the ISWC if your PRO has assigned one.", "iswc");
    return { agency, ready: !missing.length, missing, tips };
  }

  if (!m.samples) need("samples", "Answer whether the song uses a sample or is based on another song.", "samples");
  else if (m.samples === "Yes") {
    if (!m.sampleTitle.trim()) need("samples", "Add the title of the song it samples or is based on.", "sampleTitle");
    if (!m.sampleWriters.trim()) need("samples", "Add the writers of the song it samples or is based on.", "sampleWriters");
  }
  if (agency === "bmi") {
    if (!m.duration.trim()) need("duration", "Add the song's duration (mm:ss).", "duration");
    if (!m.primaryGenre) need("genre", "Choose the song's primary genre.", "primaryGenre");
    if (!m.writtenFor) need("written_for", "Answer whether the song was written for a film, TV show, stage show or ad.", "writtenFor");
    else if (m.writtenFor !== "No" && !m.productionTitle.trim()) need("written_for", "Add the title of the production it was written for.", "productionTitle");
    if (isReleased(m.releaseDate, today) && !m.label.trim()) need("release", "Released songs need a record label. Self-released? Use your artist or label name.", "label");
    if (!m.iswc.trim()) tip("iswc", "Add the ISWC if one has been assigned.", "iswc");
  } else {
    if (!m.isrc.trim()) tip("isrc", "Add the ISRC so ASCAP can match streams to the song.", "isrc");
    if (!m.duration.trim()) tip("duration", "Add the song's duration.", "duration");
  }
  return { agency, ready: !missing.length, missing, tips };
}

/** One song checked against every agency in an order. */
export function registrationChecks(m: Metadata, agencies: RegistrationAgency[], today?: string): RegistrationCheck[] {
  return agencies.map((a) => registrationCheck(m, a, today));
}

