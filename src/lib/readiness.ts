import { creditName, writerRole, type Contributor, type Metadata } from "@/lib/metadata";
import { splitStatus } from "@/lib/splits-total";
import { isBmi } from "@/lib/publishing";

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

/** Who collects a writer's publisher share on a song (founder, 2026-10-25). Blank = not answered. */
export type WriterPublishing = "" | "publisher" | "self" | "bmi" | "none";
export const PUBLISHING_LABEL: Record<Exclude<WriterPublishing, "">, string> = {
  publisher: "My publisher (listed below)", self: "Self-published", bmi: "BMI pays me the publisher share", none: "None: no publishing on this song",
};
type PubSong = Pick<Metadata, "writers" | "composers" | "publishers"> & Partial<Pick<Metadata, "selfPublished" | "bmiWriterPublishing">>;

/** A writer row's answer, or the song's Self-published / BMI answer when the row has none. */
export function writerPublishing(w: Contributor, m: Partial<Pick<Metadata, "selfPublished" | "bmiWriterPublishing">>): WriterPublishing {
  if (w.publishing) return w.publishing;
  if (m.selfPublished) return "self";
  if (m.bmiWriterPublishing && isBmi(w)) return "bmi";
  return "";
}

/**
 * The publisher half as one pie (founder, 2026-10-25): listed publishers' shares, plus each Self-published or
 * BMI-paid writer's own publisher share (blank = their writer split). Writers with "None" or "My publisher" add 0.
 * It must total exactly 100%, like writer splits: a warning on exports, a block on registration.
 */
export type PiePart = { label: string; share: number; field: string };
export function publisherPie(m: PubSong): { parts: PiePart[]; total: number; state: "ok" | "under" | "over" | "empty" } {
  const parts: PiePart[] = [];
  const pubs = (m.publishers ?? []).map((row, index) => ({ row, index })).filter(({ row }) => creditName(row) || row.percentage?.trim() || row.ipi?.trim());
  for (const { row, index } of pubs) parts.push({ label: creditName(row) || `Publisher ${index + 1}`, share: Number(row.percentage) || 0, field: `publishers-${index}-share` });
  for (const { row, group, index } of listed(m)) {
    const answer = writerPublishing(row, m);
    // The song-wide Self-published / BMI answer next to a listed publisher is a conflict reported on its own.
    if (!row.publishing && pubs.length) continue;
    // A BMI writer with no answer and no publisher listed is paid the publisher share by BMI.
    const paidByBmi = answer === "bmi" || (answer === "" && !pubs.length && isBmi(row));
    if (answer !== "self" && !paidByBmi) continue;
    const share = Number(row.pubShare?.trim() || row.percentage) || 0;
    parts.push({ label: `${creditName(row) || `Writer ${index + 1}`}, ${paidByBmi ? "paid by BMI" : "self-published"}`, share, field: `${group}-${index}-pubShare` });
  }
  const total = Math.round(parts.reduce((n, p) => n + p.share, 0) * 100) / 100;
  // Everyone marked "None" and no publisher listed: the publishing belongs to someone, so they need to be listed.
  if (!parts.length) return { parts, total, state: listed(m).length && listed(m).every(({ row }) => writerPublishing(row, m) === "none") ? "empty" : "ok" };
  return { parts, total, state: total === 100 ? "ok" : total < 100 ? "under" : "over" };
}
/** One line for the pie, e.g. "Publisher shares total 80% (Lee Songs 50% · Ann Lee, self-published 30%)." */
export function pieMessage(pie: ReturnType<typeof publisherPie>): string | undefined {
  const who = pie.parts.map((p) => `${p.label} ${p.share}%`).join(" · ");
  if (pie.state === "empty") return "Every writer is marked \"None\" for publishing. Add the publisher that holds this song's publishing.";
  if (pie.state === "under") return `Publisher shares total ${pie.total}% (${who}). Add the missing ${Math.round((100 - pie.total) * 100) / 100}% so they equal exactly 100%.`;
  if (pie.state === "over") return `Publisher shares total ${pie.total}% (${who}). Lower them by ${Math.round((pie.total - 100) * 100) / 100}% so they equal exactly 100%.`;
  return undefined;
}

/**
 * Writers whose publisher share has nowhere to go on this song. Each writer is covered by a listed publisher,
 * Self-published, "no publishing on this song", or BMI (BMI writers only: BMI pays them the publisher share too, so
 * with no publisher they need nothing else at BMI and The MLC). `rules` "pro" is ASCAP's: a publisher or Self-published.
 */
export function publishingGaps(m: PubSong, rules: "pro" | "bmi" | "mlc" = "mlc"): (MissingItem & { who: string })[] {
  const pubs = (m.publishers ?? []).filter((p) => creditName(p));
  const out: (MissingItem & { who: string })[] = [];
  for (const { row, group, index } of listed(m)) {
    const who = creditName(row) || `writer ${index + 1}`;
    const field = `${group}-${index}-publishing`;
    const answer = writerPublishing(row, m);
    if (answer === "self" || answer === "none") continue;
    if (answer === "bmi") {
      if (!isBmi(row)) out.push({ code: "publisher", who, field, message: `${who} isn't with BMI, so BMI can't pay their publisher share. Choose another publishing answer on their row.` });
    } else if (answer === "publisher") {
      if (!pubs.length) out.push({ code: "publisher", who, field: "publishers-0-name", message: `Add ${who}'s publisher under Publishers, or change the publishing answer on their row.` });
    } else if (!pubs.length && !(isBmi(row) && rules !== "pro")) {
      out.push({ code: "publisher", who, field, message: `Who collects ${who}'s publisher share? Add their publisher, or choose Self-published or "None: no publishing on this song" on their row.` });
    }
  }
  return out;
}

/**
 * The single source of truth for registration readiness. Every feature (embed indicator, catalog badge,
 * export gate, registration sessions) calls this — never re-implement it.
 * Ready = (has an author OR is instrumental) AND has a composer AND every writer has a legal name
 * Splits are checked too, as warnings only: writer splits, and publisher shares when any publisher is listed
 * (100% of the publisher half), should each add up to exactly 100%. Agencies won't register anything else, but the
 * user decides, so warnings never hold back an export. Registration assistance does block on them. SoundExchange registers the recording, so it skips splits.
 * Author/Composer counts toward both. Embedding and saving are never gated on this.
 */
export function registrationReadiness(m: Pick<Metadata, "writers" | "composers" | "instrumental"> & { publishers?: Contributor[]; selfPublished?: boolean; bmiWriterPublishing?: boolean }, target?: ReadinessTarget): Readiness {
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
  // The publisher half as one pie: listed publishers plus Self-published / BMI-paid writers, exactly 100%.
  // Only once every writer's publishing has an answer and the writer splits add up: until then the pie can't be right.
  if (target !== "soundexchange" && !warnings.length && !publishingGaps({ ...m, publishers: m.publishers ?? [] }).length) {
    const pie = publisherPie({ ...m, publishers: m.publishers ?? [] });
    const message = pieMessage(pie);
    if (message) warnings.push({ code: "split", message, field: pie.parts.find((p) => p.share === 0)?.field ?? pie.parts[0]?.field ?? "publishers-0-name" });
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

  // Who collects the publisher share: a listed publisher, or nobody (self-published / self-administered). At BMI, a
  // writer of any role with no publisher is paid the publisher share too, so BMI needs neither (PLAN-bmi-no-publisher).
  // Each writer's publisher share needs a home (publishingGaps): a listed publisher, Self-published, BMI (BMI writers
  // only) or "no publishing on this song". The song-level answers can't sit next to a listed publisher.
  if (m.selfPublished && pubs.length) need("publisher", "You checked Self-published but also listed a publisher. Keep one.", "selfPublished");
  else if (m.bmiWriterPublishing && pubs.length) need("publisher", "You said there's no publishing company but also listed a publisher. Keep one.", "bmiWriterPublishing");
  else {
    const gaps = publishingGaps(m, agency === "bmi" ? "bmi" : agency === "mlc" ? "mlc" : "pro");
    for (const g of gaps) need(g.code, g.message, g.field);
    // The MLC: BMI writers with no publisher still upload; the bulk file lists the writer as publisher with the
    // placeholder IPI, removed in The MLC Portal afterwards (founder-verified, 2026-10-25), so it never costs health.
    if (!gaps.length && !pubs.length && listed(m).some(({ row }) => isBmi(row) && writerPublishing(row, m) !== "none" && writerPublishing(row, m) !== "self")) {
      if (agency === "mlc") tip("publisher", "No publisher: BMI pays you the publisher share. The MLC file lists you as publisher with the placeholder IPI 123456789; remove it in The MLC Portal after the upload.", "selfPublished");
      else if (agency === "bmi") tip("publisher", "No publisher: BMI pays you the publisher share too, in proportion to your split.", "selfPublished");
    }
  }
  for (const { row, index } of pubs) {
    const who = creditName(row) || `publisher ${index + 1}`;
    if (!creditName(row)) need("publisher", `Add a name for ${who}.`, `publishers-${index}-name`);
    if (agency !== "mlc" && !hasPro(row)) need("pro", `Add a PRO affiliation for ${who}.`, `publishers-${index}-pro`);
    if (agency === "bmi" && !row.ipi?.trim()) need("ipi", `Add the IPI name number for ${who}.`, `publishers-${index}-ipi`);
  }

  if (agency === "mlc") {
    if (!m.isrc.trim()) need("isrc", "Add the recording's ISRC. The MLC pays by matching streams to the song through its recordings.", "isrc");
    if (!m.iswc.trim()) tip("iswc", "Not needed to register at The MLC. Add the ISWC later, once your PRO assigns it.", "iswc");
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

