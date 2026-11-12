import { readIntake } from "@/lib/intake-session";
import { stripVersion, versionTail, type ListResult, type ListWork } from "@/lib/agency-lists";
import type { CatalogTrack } from "@/lib/catalog";

/**
 * The "Music Royalty Doctors" difference model (founder, 2026-11-13).
 *
 * One place turns the comparisons the agency intake already saved into the rows the Differences panel and chart read, and
 * one place decides what each difference needs. The panel, the chart, the intake handoff and the catalog deep link all
 * call these functions, so a rule can never say one thing on the chart and another in a link.
 *
 * Nothing here writes: a resolution is saved by the caller through `saveTrack`, so the catalog stays the only store and
 * no new table is created.
 */

/** The store name the agency intake has always used (`AgencyLists.tsx`). Kept here so both sides read the same key. */
export const STORED_LISTS_KEY = "agency-lists";

export type StoredLists = { byId: Record<string, { file: string; result: ListResult }>; shownId?: string | undefined };

/** The saved comparisons for this account on this device, or nothing once the 12-hour sitting has expired. */
export function readStoredLists(userId: string | undefined): StoredLists | undefined {
  const saved = readIntake<StoredLists>(userId, STORED_LISTS_KEY);
  return saved?.byId ? saved : undefined;
}

/** What a difference is about. The chart's conflict pill reads this, and the treatment engine keys off it. */
export type DisagreementKind =
  | "isrc-mismatch"
  | "earlier-isrc"
  | "missing-catalog-isrc"
  | "cross-agency-split"
  | "same-title-different-isrc"
  | "title-mismatch"
  | "version-difference"
  | "missing-release"
  | "missing-from-list"
  | "other";

export const KIND_LABEL: Record<DisagreementKind, string> = {
  "isrc-mismatch": "ISRC mismatch",
  "earlier-isrc": "Earlier / retired ISRC",
  "missing-catalog-isrc": "Missing catalog ISRC",
  "cross-agency-split": "Cross-agency ISRC split",
  "same-title-different-isrc": "Same title / different ISRC",
  "title-mismatch": "Title mismatch",
  "version-difference": "Version difference",
  "missing-release": "Missing release",
  "missing-from-list": "Not on the list",
  other: "Different details",
};

/** What kind of fix the difference takes. The chart decides which buttons to offer from this. */
export type TreatmentAction = "check-distributor" | "add-version" | "keep-both" | "adopt" | "waiting" | "review";

export type Treatment = {
  headline: string;
  /** One sentence, with `{isrc}` where the row's own code belongs. */
  detail: string;
  /** The button the member presses first. */
  primary: string;
  /** The quieter link beside it. */
  secondary: string;
  action: TreatmentAction;
};

/**
 * The treatment rules, written once (founder, 2026-11-13). Everything that shows a difference reads these strings, so a
 * rule can never say one thing on the card and another in the link beside it.
 */
export const TREATMENTS = {
  checkDistributor: {
    headline: "Check your distributor for which copy is right",
    detail: "Your catalog and the agency list different titles for ISRC {isrc}. Check the public repertoire listing and your distributor dashboard, then update the mismatched side.",
    primary: "Copy ISRC & Check Repertoire ↗",
    secondary: "Edit in My Catalog",
    action: "check-distributor",
  } as Treatment,
  crossAgency: {
    headline: "Check your distributor for which copy is right",
    detail: "Two agencies disagree about ISRC {isrc} for this same recording. Check the public repertoire listing and your distributor dashboard, then bring the other agency onto the copy your distributor delivered.",
    primary: "Copy ISRC & Check Repertoire ↗",
    secondary: "Edit in My Catalog",
    action: "check-distributor",
  } as Treatment,
  addVersion: {
    headline: "Add the version",
    detail: "Two distinct ISRCs share this song title. Verify both recordings in the public repertoire search, then add the missing version to your catalog.",
    primary: "+ Add Version to Catalog",
    secondary: "Check Repertoire ↗",
    action: "add-version",
  } as Treatment,
  keepBoth: {
    headline: "Register both ISRCs and mark the old release Retired",
    detail: "Keep the newer ISRC active for current royalties, verify the older ISRC in repertoire search, and set the old release status to Retired in your catalog.",
    primary: "Manage Versions in Catalog",
    secondary: "Check Repertoire ↗",
    action: "keep-both",
  } as Treatment,
  submit: {
    headline: "Submit recording to agency",
    detail: "ISRC {isrc} is in your catalog but missing from the public repertoire database. Double-check via ISRC Search, then submit it through your distributor or agency portal.",
    primary: "Copy ISRC & Check Repertoire ↗",
    secondary: "Open Catalog Entry",
    action: "review",
  } as Treatment,
  adoptAgency: {
    headline: "Add this ISRC from the agency",
    detail: "The agency holds ISRC {isrc} for this recording and your catalog has none. Take theirs, so the two records match and the recording is never left unmatched.",
    primary: "Copy Agency ISRC & Check Repertoire ↗",
    secondary: "Open Catalog Entry",
    action: "adopt",
  } as Treatment,
  waiting: {
    headline: "Waiting for the release",
    detail: "The agency has nothing to match yet because this release is not out. Nothing is wrong here; check the public repertoire again after release day.",
    primary: "Check Repertoire ↗",
    secondary: "Open Catalog Entry",
    action: "waiting",
  } as Treatment,
  review: {
    headline: "Review the difference",
    detail: "The details differ but neither side is clearly wrong. Open the song, compare the values, and fix the copy you control.",
    primary: "Copy ISRC & Check Repertoire ↗",
    secondary: "Open Catalog Entry",
    action: "review",
  } as Treatment,
  // One treatment per kind of detail, so a recording with five differences lists five fixed things to do, not one summary
  // and four silent ones (founder, 2026-11-14).
  iswc: {
    headline: "Check which ISWC is right",
    detail: "The ISWC belongs to the composition, not the recording, so the two sides should always agree on it. Confirm it in the public repertoire, then correct the side that is wrong.",
    primary: "Copy ISRC & Check Repertoire ↗",
    secondary: "Edit in My Catalog",
    action: "check-distributor",
  } as Treatment,
  writerAtAgency: {
    headline: "Register {name} at the agency",
    detail: "Your catalog names {name}, and the agency's registration does not. Until they are added there, their share of this song cannot be matched or paid.",
    primary: "Copy ISRC & Check Repertoire ↗",
    secondary: "Edit in My Catalog",
    action: "check-distributor",
  } as Treatment,
  writerInAgency: {
    headline: "Decide whether {name} belongs on this song",
    detail: "The agency's registration names {name}, who is not in your catalog. Add them here if they wrote on it; if they did not, ask the agency to remove them so the splits match your split sheet.",
    primary: "Copy ISRC & Check Repertoire ↗",
    secondary: "Edit in My Catalog",
    action: "check-distributor",
  } as Treatment,
  spelling: {
    headline: "Fix the spelling on one side",
    detail: "Same writer, two spellings. Agencies match on the exact name, so make the misspelled side match the legal name on file.",
    primary: "Copy ISRC & Check Repertoire ↗",
    secondary: "Edit in My Catalog",
    action: "check-distributor",
  } as Treatment,
  ipi: {
    headline: "Check which IPI is right",
    detail: "A writer's IPI is their permanent ID, and the two records hold different numbers. Confirm it in the public repertoire, then correct the side that is wrong.",
    primary: "Copy ISRC & Check Repertoire ↗",
    secondary: "Edit in My Catalog",
    action: "check-distributor",
  } as Treatment,
  share: {
    headline: "Settle the split",
    detail: "The two records give this writer different shares. Match the agency's percentage to your split sheet, or fix the split sheet if that is the side that is wrong.",
    primary: "Copy ISRC & Check Repertoire ↗",
    secondary: "Edit in My Catalog",
    action: "check-distributor",
  } as Treatment,
};

/** Fills `{isrc}` and `{name}` in one of a treatment's sentences with the code and the writer the row is about. */
const fill = (sentence: string, isrc: string, name = "") =>
  sentence.replace("{isrc}", isrc || "this recording").replace("{name}", name || "that writer");

/** The treatment's instruction, written for this row. */
export const treatmentText = (t: Treatment, isrc: string, name = "") => fill(t.detail, isrc, name);

/** The treatment's headline, written for this row, so no `{name}` ever reaches the screen. */
export const treatmentHeadline = (t: Treatment, isrc: string, name = "") => fill(t.headline, isrc, name);

/**
 * The writer a writer-specific issue is about, read from the issue sentence the comparison wrote (the name leads it), so a
 * treatment can say who to fix rather than "a writer".
 */
export function nameFromIssue(issue: string): string {
  const patterns = [
    /^(.*?)'s (?:share|IPI) is /i,
    /^(.*?) isn't on the agency's registration$/i,
    /^The agency lists (.*?), who isn't in your catalog$/i,
    /^The agency has (.*?) where your catalog has (.*?) — /i,
  ];
  for (const re of patterns) {
    const m = issue.match(re);
    if (m?.[1]) return m[1];
  }
  return "";
}

/**
 * The rule for one issue on its own, whatever the row's headline difference is: every difference the comparison found gets
 * the fix it actually needs (founder, 2026-11-14).
 */
export function treatmentForIssue(issue: string, ctx: { catalogIsrc: string; agencyIsrc: string }): Treatment {
  const text = issue.toLowerCase();
  if (/^not on the /.test(text)) return TREATMENTS.submit;
  if (/iswc/.test(text)) return TREATMENTS.iswc;
  if (/^the agency has version /.test(text) || /second isrc for /.test(text)) return TREATMENTS.addVersion;
  if (/^the agency calls it/.test(text)) return TREATMENTS.checkDistributor;
  if (/\.? isn't on the agency's registration$/.test(text)) return TREATMENTS.writerAtAgency;
  if (/who isn't in your catalog$/.test(text)) return TREATMENTS.writerInAgency;
  if (/spelling/.test(text)) return TREATMENTS.spelling;
  if (/'s ipi is /.test(text)) return TREATMENTS.ipi;
  if (/'s share is /.test(text)) return TREATMENTS.share;
  if (/retire|used to carry|earlier/.test(text)) return TREATMENTS.keepBoth;
  if (/isrc|code/.test(text)) {
    if (!ctx.catalogIsrc && ctx.agencyIsrc) return TREATMENTS.adoptAgency;
    if (ctx.catalogIsrc && ctx.agencyIsrc && ctx.catalogIsrc.toUpperCase() !== ctx.agencyIsrc.toUpperCase()) return TREATMENTS.checkDistributor;
    return TREATMENTS.submit;
  }
  return TREATMENTS.review;
}

/** One listed difference, with the rule that fixes it and the sentence written out for this row. */
export type RowFix = { issue: string; treatment: Treatment; code: string; headline: string; text: string };

/** Every issue on a row, in the order the comparison found them, each with its own treatment. */
export function fixesFor(issues: string[], ctx: { catalogIsrc: string; agencyIsrc: string }): RowFix[] {
  const code = ctx.agencyIsrc || ctx.catalogIsrc;
  return [...new Set(issues)].map((issue) => {
    const treatment = treatmentForIssue(issue, ctx);
    const name = nameFromIssue(issue);
    return { issue, treatment, code, headline: treatmentHeadline(treatment, code, name), text: treatmentText(treatment, code, name) };
  });
}

/**
 * The public repertoire searches, never a login page (founder, 2026-11-13): a member checking a code should land on the
 * search they can read, not on a portal asking them to sign in.
 */
export const PUBLIC_REPERTOIRE: Record<string, string> = {
  soundexchange: "https://soundexchange.com",
  bmi: "https://bmi.com",
  mlc: "https://themlc.com",
  ascap: "https://www.ascap.com",
  sesac: "https://www.sesac.com",
};

/** The public search for a society's id, falling back to the ISRC search every recording can be looked up in. */
export const repertoireUrl = (society: string) => PUBLIC_REPERTOIRE[society] ?? "https://isrc.soundexchange.com/";

/** One agency's claim about a song: the society, and the code (and title) it has on file. */
export type AgencyClaim = { society: string; name: string; isrc: string; title: string; url: string; /** The artist this agency credits, when its list prints one. */ artist?: string | undefined; /** The version this agency names for the recording, read from its own list. */ version?: string | undefined };

export type ReleaseState = "current" | "earlier" | "retired" | "waiting";

export const RELEASE_STATE_LABEL: Record<ReleaseState, string> = {
  current: "Current",
  earlier: "Earlier release",
  retired: "Retired",
  waiting: "Waiting for release",
};

export type TriageStatus = "needs-triage" | "in-treatment" | "both-registered" | "waiting";

export const STATUS_LABEL: Record<TriageStatus, string> = {
  "needs-triage": "Needs review",
  "in-treatment": "In treatment",
  "both-registered": "Both registered · 1 retired",
  waiting: "Waiting",
};

export type DifferenceRow = {
  key: string;
  songId: string;
  title: string;
  artist: string;
  /** How many times the society's own file lists this song under the same difference. */
  occurrences: number;
  /** The agencies on this row: one for catalog-vs-agency, two or more when agencies disagree with each other. */
  claims: AgencyClaim[];
  catalogIsrc: string;
  retiredIscrs: string[];
  release: { title: string; date: string; version: string; state: ReleaseState };
  /** The recording's version on each side, so the card can show and highlight it (founder, 2026-11-14). */
  versions: { catalog: string; agency: string };
  /** The artist each side credits, so a case-only difference is visible once and never a false alert. */
  artists: { catalog: string; agency: string };
  /** Every code the list holds under this one title, with the version it names: two codes are two recordings. */
  agencyCodes: { isrc: string; version: string }[];
  /** True when the list holds more than one code for one title, which is another version, never an isolated mismatch. */
  secondCode: boolean;
  kind: DisagreementKind;
  issues: string[];
  treatment: Treatment;
  /** Every issue on this recording, each with the treatment that fixes it, so none of them goes unlisted. */
  fixes: RowFix[];
  status: TriageStatus;
  /** Catalog-vs-agency rows compare one society; agency-vs-agency rows compare two or more. */
  side: "catalog" | "agencies";
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** A readable society name for a stored comparison id ("soundexchange" → "SoundExchange"). */
export function societyName(id: string, societies: { id: string; name: string }[] = []): string {
  return societies.find((s) => s.id === id)?.name ?? id.replace(/^\w/, (c) => c.toUpperCase());
}

/** The release state the chart prints, from the song's own catalog entry. */
export function releaseState(m: { releaseDate: string; unreleased?: boolean; retiredIscrs?: string[] }, agencyIsrc = ""): ReleaseState {
  const today = new Date().toISOString().slice(0, 10);
  const retired = (m.retiredIscrs ?? []).map((c) => c.trim().toUpperCase()).filter(Boolean);
  if (agencyIsrc && retired.includes(agencyIsrc.trim().toUpperCase())) return "earlier";
  if (retired.length) return "retired";
  if (!m.releaseDate || m.releaseDate > today) return "waiting";
  return "current";
}

/**
 * The one treatment decision. An earlier code already on record wins, because nothing is left to decide; then a song with
 * no code of its own; then two real codes; then a different recording under the same title.
 */
export function treatmentFor(input: { kind: DisagreementKind; catalogIsrc: string; retiredIscrs: string[]; releaseState: ReleaseState }): Treatment {
  const { kind, retiredIscrs, releaseState: state } = input;
  // A difference that is visible is never excused as waiting: a catalog with no release date filled in still holds the
  // wrong code, and "Waiting for the release" is only for a song whose values are genuinely absent (founder, 2026-11-13).
  if (kind === "missing-from-list") return TREATMENTS.submit;
  if (kind === "earlier-isrc" || retiredIscrs.length > 0) return TREATMENTS.keepBoth;
  if (kind === "version-difference") return state === "waiting" ? TREATMENTS.waiting : TREATMENTS.addVersion;
  if (kind === "same-title-different-isrc") return TREATMENTS.addVersion;
  if (kind === "cross-agency-split") return TREATMENTS.crossAgency;
  if (kind === "missing-catalog-isrc") return TREATMENTS.adoptAgency;
  if (kind === "isrc-mismatch" || kind === "title-mismatch") return TREATMENTS.checkDistributor;
  if (state === "waiting") return TREATMENTS.waiting;
  return TREATMENTS.checkDistributor;
}

/** The plain-English line the card leads with, so nobody has to decode the issue tag. */
export function summaryFor(row: DifferenceRow): string {
  const agency = row.claims.map((c) => c.name).join(" and ") || "The agency";
  // Two codes under one title, in the member's own terms: another version, or the old code beside the new one.
  if (row.secondCode) return `${agency} holds ${row.agencyCodes.length} ISRCs under this one title. Two codes under one title mean another version of the recording, or the retired code beside the current one.`;
  switch (row.kind) {
    case "same-title-different-isrc":
      return `${agency} holds an ISRC for this title that your catalog does not, which is how one song ends up split across two recordings.`;
    case "title-mismatch":
      return `${agency} files this recording under a different title than your catalog. The code matches, the name does not.`;
    case "version-difference":
      return `${agency} and your catalog name different versions of this recording, so the two records describe different audio.`;
    case "isrc-mismatch":
      return `Both sides hold a code for this recording, and the two codes are not the same.`;
    case "missing-catalog-isrc":
      return `${agency} has a code for this song and your catalog has none, so the recording cannot be matched on its own.`;
    case "earlier-isrc":
      return `${agency} still holds the code of an earlier release of this recording.`;
    case "missing-from-list":
      return `This song is in your catalog but does not appear on the ${agency} list.`;
    case "cross-agency-split":
      return `Two agencies hold different codes for this same song, so one of the two records is wrong.`;
    case "missing-release":
      return `The release details differ between your catalog and ${agency}.`;
    default:
      return `The details differ between your catalog and ${agency}.`;
  }
}

/** True for anything that looks like an ISRC, so a title or a share is never compared as one. */
export const looksLikeIsrc = (s: string) => /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(s.replace(/[^A-Za-z0-9]/g, ""));

/**
 * Character-level comparison for the chart's value readouts. The two codes are aligned by position, which is how an ISRC
 * actually differs (one designation character), and the segments come back in display order.
 */
export function diffSegments(a: string, b: string): { value: string; changed: boolean }[] {
  const left = a ?? "", right = b ?? "";
  if (!left || !right) return [{ value: left, changed: false }];
  const out: { value: string; changed: boolean }[] = [];
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i++) {
    const ch = left[i] ?? "";
    const changed = ch !== (right[i] ?? "");
    const last = out[out.length - 1];
    if (last && last.changed === changed) last.value += ch;
    else out.push({ value: ch, changed });
  }
  return out;
}

/**
 * Word-level comparison for titles, so the words that actually differ are marked. A word the other side also holds stays
 * plain, which is what makes a one-word change in a long title visible.
 */
export function diffWords(a: string, b: string): { value: string; changed: boolean }[] {
  const words = (a ?? "").split(/(\s+)/).filter(Boolean);
  const other = new Set((b ?? "").toLowerCase().split(/\s+/).filter(Boolean));
  return words.map((w) => ({ value: w, changed: /[a-z0-9]/i.test(w) && !other.has(w.toLowerCase()) }));
}

/** Reads the issues a society reported into the one kind the chart shows. */
function kindOf(issues: string[], catalogIsrc: string, agencyIsrc: string, retiredIscrs: string[]): DisagreementKind {
  const text = issues.join(" ").toLowerCase();
  if (agencyIsrc && retiredIscrs.map((c) => c.toUpperCase()).includes(agencyIsrc.toUpperCase())) return "earlier-isrc";
  if (!catalogIsrc && agencyIsrc) return "missing-catalog-isrc";
  if (/retire|used to carry|earlier/.test(text)) return "earlier-isrc";
  if (/^the agency has version /.test(text) || /is not released yet, and the agency lists this recording without a version/.test(text)) return "version-difference";
  // "The agency holds a second ISRC for ..." is another recording of one title, never an isolated mismatch.
  if (/second isrc for /.test(text)) return "same-title-different-isrc";
  if (/isrc|code/.test(text)) return catalogIsrc && agencyIsrc && catalogIsrc !== agencyIsrc ? "isrc-mismatch" : "other";
  if (/release|album|date/.test(text)) return "missing-release";
  return "other";
}

type BuildInput = {
  stored: StoredLists | undefined;
  tracks: CatalogTrack[];
  societies?: { id: string; name: string; url?: string }[] | undefined;
};

/**
 * Builds the chart's rows from the saved comparisons. Repeated entries of one song in one society's file collapse into a
 * single row carrying an `occurrences` count, and two agencies holding different codes for one song become one
 * cross-agency row so the disagreement is read once, not twice.
 */
export function buildDifferenceRows({ stored, tracks, societies = [] }: BuildInput): DifferenceRow[] {
  if (!stored) return [];
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const nameOf = (id: string) => societyName(id, societies);
  const urlOf = (id: string) => repertoireUrl(id);
  const rows: DifferenceRow[] = [];
  /** Every code an agency holds for a song, so a disagreement between agencies can be found. */
  const claimsByTrack = new Map<string, AgencyClaim[]>();

  const releaseOf = (track: CatalogTrack, state: ReleaseState) => ({
    title: track.metadata.album.trim(),
    date: track.metadata.releaseDate,
    version: [(track.metadata.version ?? "").trim(), track.metadata.releaseVersion.trim()].filter(Boolean).join(" · "),
    state,
  });

  for (const [societyId, entry] of Object.entries(stored.byId)) {
    // `d.title` is the catalog's title; the agency's own title, version and artist come from the work on its list, so a
    // name difference is read from the file rather than compared with itself (founder, 2026-11-14).
    const grouped = new Map<string, { titles: string[]; isrcs: string[]; issues: string[]; versions: string[]; artists: string[] }>();
    for (const d of entry.result.differences) {
      const g = grouped.get(d.trackId) ?? { titles: [], isrcs: [], issues: [], versions: [], artists: [] };
      // The agency's title without its version tail: the version is shown and compared in its own field.
      const agencyTitle = (d.work?.coreTitle ?? stripVersion(d.work?.title ?? d.title)).trim();
      g.titles.push(agencyTitle);
      if (d.work?.isrc) g.isrcs.push(d.work.isrc.trim());
      const version = (d.work?.version ?? versionTail(agencyTitle)).trim();
      if (version) g.versions.push(version);
      if (d.work?.artist) g.artists.push(d.work.artist);
      g.issues.push(...d.issues);
      grouped.set(d.trackId, g);
    }
    for (const [trackId, g] of grouped) {
      const track = byId.get(trackId);
      if (!track) continue;
      const m = track.metadata;
      const catalogIsrc = m.isrc.trim();
      const agencyIsrc = g.isrcs.find(Boolean) ?? "";
      const retired = (m.retiredIscrs ?? []).filter(Boolean);
      const state = releaseState(m, agencyIsrc);
      const catalogTitleCore = stripVersion(track.title);
      const titleDiffers = g.titles.some((x) => norm(x) !== norm(catalogTitleCore));
      const bothCodes = !!catalogIsrc && !!agencyIsrc;
      const codeDiffers = bothCodes && catalogIsrc.toUpperCase() !== agencyIsrc.toUpperCase();
      const versions = { catalog: (m.version ?? "").trim() || versionTail(track.title), agency: g.versions[0] ?? "" };
      const artists = { catalog: track.artist ?? "", agency: g.artists[0] ?? "" };
      // Two or more codes under one title is one recording with more than one version — or the retired code beside the
      // current one — never an isolated metadata mismatch (founder, 2026-11-14).
      const agencyCodes = [...new Set(g.isrcs.map((c) => c.toUpperCase()).filter(Boolean))];
      const secondCode = agencyCodes.length > 1 && !!catalogIsrc && agencyCodes.includes(catalogIsrc.toUpperCase());
      // The four cases the treatment table names, decided by what actually disagrees: the title, the code, or both.
      const kind: DisagreementKind = secondCode
        ? "same-title-different-isrc"
        : titleDiffers && bothCodes
          ? (codeDiffers ? "isrc-mismatch" : "title-mismatch")
          : !titleDiffers && codeDiffers
            ? "same-title-different-isrc"
            : kindOf([...new Set(g.issues)], catalogIsrc, agencyIsrc, retired);
      const claim: AgencyClaim = { society: societyId, name: nameOf(societyId), isrc: agencyIsrc, title: g.titles[0] ?? track.title, url: urlOf(societyId), artist: g.artists[0] ?? "", version: g.versions[0] ?? "" };
      const treatment = treatmentFor({ kind, catalogIsrc, retiredIscrs: retired, releaseState: state });
      const issues = [...new Set(g.issues)];
      const versionsDiffer = !!versions.agency && !!versions.catalog && norm(versions.agency) !== norm(versions.catalog);
      const artistsDiffer = !!artists.agency && norm(artists.agency) !== norm(artists.catalog);
      // Nothing to decide when both sides read the same recording: a stored comparison made before the name rule was
      // fixed still carries its old issue, and a card showing four identical fields is never a difference
      // (founder, 2026-11-14). A writer, ISWC or share issue is substantive and always keeps its card.
      const nameOnly = issues.length > 0 && issues.every((i) => /^The agency calls it /.test(i));
      const identical = !titleDiffers && !codeDiffers && !versionsDiffer && !artistsDiffer && nameOnly;
      if (agencyIsrc) claimsByTrack.set(trackId, [...(claimsByTrack.get(trackId) ?? []).filter((c) => c.society !== societyId), claim]);
      if (identical) continue;
      rows.push({
        key: `${societyId}:${trackId}`,
        songId: trackId,
        title: track.title || "Untitled",
        artist: track.artist,
        occurrences: g.titles.length,
        claims: [claim],
        catalogIsrc,
        retiredIscrs: retired,
        release: releaseOf(track, state),
        versions,
        artists,
        agencyCodes: g.isrcs.map((isrc, i) => ({ isrc: isrc.trim(), version: g.versions[i] ?? g.versions[0] ?? "" })).filter((c, i, all) => c.isrc && all.findIndex((x) => x.isrc.toUpperCase() === c.isrc.toUpperCase()) === i),
        secondCode,
        kind,
        issues,
        treatment,
        fixes: fixesFor(issues, { catalogIsrc, agencyIsrc }),
        status: treatment.action === "waiting" ? "waiting" : retired.length ? "both-registered" : "needs-triage",
        side: "catalog",
      });
    }
  }

  // Agency vs agency: the same song with two different codes at two agencies.
  for (const [trackId, claims] of claimsByTrack) {
    const codes = [...new Set(claims.map((c) => c.isrc.toUpperCase()).filter(Boolean))];
    if (codes.length < 2) continue;
    const track = byId.get(trackId);
    if (!track) continue;
    const m = track.metadata;
    const retired = (m.retiredIscrs ?? []).filter(Boolean);
    const state = releaseState(m);
    const treatment = treatmentFor({ kind: "cross-agency-split", catalogIsrc: m.isrc.trim(), retiredIscrs: retired, releaseState: state });
    rows.push({
      key: `agencies:${trackId}`,
      songId: trackId,
      title: track.title || "Untitled",
      artist: track.artist,
      occurrences: claims.length,
      claims,
      catalogIsrc: m.isrc.trim(),
      retiredIscrs: retired,
      release: releaseOf(track, state),
      versions: { catalog: (m.version ?? "").trim() || versionTail(track.title), agency: claims.find((c) => c.version)?.version ?? "" },
      // A cross-agency row is its own kind: two agencies are not two codes under one title.
      agencyCodes: claims.filter((c) => c.isrc).map((c) => ({ isrc: c.isrc, version: c.version ?? "" })),
      secondCode: false,
      artists: { catalog: track.artist ?? "", agency: claims.find((c) => c.artist)?.artist ?? "" },
      kind: "cross-agency-split",
      issues: claims.map((c) => `${c.name}: ${c.isrc}`),
      treatment,
      fixes: fixesFor(claims.map((c) => `${c.name}: ${c.isrc}`), { catalogIsrc: m.isrc.trim(), agencyIsrc: claims[0]?.isrc ?? "" }),
      status: treatment.action === "waiting" ? "waiting" : retired.length ? "both-registered" : "needs-triage",
      side: "agencies",
    });
  }

  // Songs the society does not list at all, so a missing registration is not invisible on this chart.
  for (const [societyId, entry] of Object.entries(stored.byId)) {
    for (const miss of entry.result.notListed) {
      const track = byId.get(miss.trackId);
      if (!track) continue;
      const m = track.metadata;
      const retired = (m.retiredIscrs ?? []).filter(Boolean);
      const state = releaseState(m);
      const treatment = TREATMENTS.submit;
      rows.push({
        key: `${societyId}:missing:${miss.trackId}`,
        songId: miss.trackId,
        title: track.title || "Untitled",
        artist: track.artist,
        occurrences: 1,
        claims: [{ society: societyId, name: nameOf(societyId), isrc: "", title: miss.title, url: urlOf(societyId) }],
        catalogIsrc: m.isrc.trim(),
        retiredIscrs: retired,
        release: releaseOf(track, state),
        versions: { catalog: (m.version ?? "").trim() || versionTail(track.title), agency: "" },
        agencyCodes: [],
        secondCode: false,
        artists: { catalog: track.artist ?? "", agency: "" },
        kind: "missing-from-list",
        issues: [`Not on the ${nameOf(societyId)} list`],
        treatment,
        fixes: fixesFor([`Not on the ${nameOf(societyId)} list`], { catalogIsrc: m.isrc.trim(), agencyIsrc: "" }),
        status: treatment.action === "waiting" ? "waiting" : retired.length ? "both-registered" : "needs-triage",
        side: "catalog",
      });
    }
  }

  return rows.sort((a, b) => a.title.localeCompare(b.title) || a.claims[0]!.name.localeCompare(b.claims[0]!.name));
}

/** How many rows are still work, for the intake handoff badge. */
export const openDifferenceCount = (rows: DifferenceRow[]) =>
  rows.filter((r) => r.status === "needs-triage" || r.status === "in-treatment").length;
