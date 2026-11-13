import { readIntake } from "@/lib/intake-session";
import { compareList, stripVersion, versionTail, type ListResult, type ListWork } from "@/lib/agency-lists";
import { agencyKind, registersRecording } from "@/lib/agency-kind";
import { isCatalogId } from "@/lib/ids";
import { titleKey } from "@/lib/agency-lists";
import type { CatalogTrack } from "@/lib/catalog";
import { creditName } from "@/lib/metadata";
import { portalFor } from "@/lib/agency-portals";
import type { CatalogAction, CatalogField } from "@/lib/catalog-links";

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

export type StoredLists = {
  byId: Record<string, { file: string; result: ListResult; /** Which reading of the file produced this result. */ reader?: number | undefined }>;
  shownId?: string | undefined;
};

/**
 * The reading a saved comparison was made with (founder, 2026-11-14). A save from before the versions and artists were read
 * was being shown exactly as it was written then — every version "Not named", one song counted four times — because the
 * panel trusted a verdict from an older reader. Any save without this number is read again from the works it kept.
 */
export const STORED_READER = 3;

/** "Clean Version", "clean", "Clean" — the same version name to a member's eye. */
const bareVersion = (v: string) => norm(v).replace(/\bversion\b/g, "").replace(/\s+/g, " ").trim();
const sameVersion = (a: string, b: string) => bareVersion(a) === bareVersion(b);

/**
 * One title, more than one recording. A list is matched to the catalog by title, so both entries under a title were handed
 * the first work on the list and a pair read "Clean Version" twice (founder, 2026-11-14). Each entry takes the work whose
 * version it names, and an entry that names none takes one no other entry has claimed — the list's own order, never a guess
 * about which recording is which.
 */
function spreadWorks(group: CatalogTrack[], candidates: ListWork[], set: (t: CatalogTrack, w: ListWork) => void) {
  const versionOf = (t: CatalogTrack) => (t.metadata.version ?? "").trim() || versionTail(t.title);
  const claimed = new Set<ListWork>();
  for (const t of group) {
    const named = versionOf(t);
    if (!named) continue;
    const pick = candidates.find((w) => !claimed.has(w) && !!w.version && sameVersion(w.version, named));
    if (!pick) continue;
    claimed.add(pick);
    set(t, pick);
  }
  for (const t of group) {
    if (versionOf(t)) continue;
    const pick = candidates.find((w) => !claimed.has(w));
    if (!pick) break;
    claimed.add(pick);
    set(t, pick);
  }
}

/** Every work a saved comparison still holds, so it can be compared again without asking for the file a second time. */
export function worksFromResult(result: ListResult): ListWork[] {
  const out: ListWork[] = [];
  const seen = new Set<string>();
  // A save from the older reader kept the agency's title and code but not the version it read off that title ("Am Pm (Clean
  // Version)" lost its "Clean Version"), so the version and the bare title are read from the title again — never invented.
  const add = (w: ListWork) => {
    const key = `${w.isrc}|${w.title}|${w.iswc}|${w.workId}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      ...w,
      version: w.version || versionTail(w.title) || undefined,
      coreTitle: w.coreTitle || stripVersion(w.title) || undefined,
    });
  };
  for (const m of [...result.matched, ...result.differences]) if (m.work) add(m.work);
  for (const c of result.clashes) add(c.work);
  for (const w of result.extra) add(w);
  return out;
}

/** The saved comparisons read again by today's rules, or the same object when they were already read by them. */
export function rereadStored(stored: StoredLists | undefined, tracks: CatalogTrack[], societies: { id: string; name: string }[] = []): StoredLists | undefined {
  if (!stored) return stored;
  let changed = false;
  const byId: StoredLists["byId"] = {};
  for (const [societyId, entry] of Object.entries(stored.byId)) {
    const works = worksFromResult(entry.result);
    if (entry.reader === STORED_READER || !works.length) { byId[societyId] = entry; continue; }
    changed = true;
    byId[societyId] = {
      ...entry,
      reader: STORED_READER,
      result: compareList(works, tracks, agencyKind(societyId), societyName(societyId, societies)),
    };
  }
  return changed ? { ...stored, byId } : stored;
}

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
  | "version-pair"
  | "agency-version-conflict"
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
  "version-pair": "Two versions of this title",
  "agency-version-conflict": "Agencies name different versions",
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
  // A code that differs says nothing about the title: the words name the code, or the member reads "different titles" on a
  // card where the titles agree.
  isrcMismatch: {
    headline: "Check your distributor for which copy is right",
    detail: "Your catalog and the agency list different ISRCs for this recording. Check the public repertoire listing and your distributor dashboard, then correct the side that holds the wrong code.",
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
  // One title the agency holds under two codes is two recordings, and the member is told so even when both are catalogued
  // and nothing disagrees (founder, 2026-11-14): the pair is the thing to act on, not a mismatch.
  pairVersions: {
    headline: "Name each version of this title",
    detail: "The agency holds more than one ISRC under this title, so this song has more than one recording. Your catalog holds both: name the version on each entry so the agency pairs each code with the right master.",
    primary: "+ Add Version to Catalog",
    secondary: "Check Repertoire ↗",
    action: "add-version",
  } as Treatment,
  // Two agencies describing one code two ways: one code names one recording, so the audio itself is in question.
  agencyVersion: {
    headline: "Check with your distributor which version this ISRC is",
    detail: "Two agencies describe ISRC {isrc} as different versions. One code names one recording, so confirm the master your distributor delivered, then bring the other agency onto it and add the version it names to your catalog.",
    primary: "Copy ISRC & Check Repertoire ↗",
    secondary: "Edit in My Catalog",
    action: "check-distributor",
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
 * Differences that one rule settles are one treatment, not the same paragraph repeated (founder, 2026-11-14): two writers
 * with two spellings each are two cases of "fix the spelling on one side", so the rule is written once and both writers
 * are named under it.
 */
export type FixGroup = { key: string; headline: string; text: string; issues: string[]; code: string; treatment: Treatment };

export function groupFixes(fixes: RowFix[]): FixGroup[] {
  const groups = new Map<string, FixGroup>();
  for (const f of fixes) {
    // The rule, its own words and the code it checks: the same rule over two different codes is two separate checks.
    const key = `${f.treatment.primary}|${f.headline}|${f.text}|${f.code}`;
    const seen = groups.get(key);
    if (seen) { seen.issues.push(f.issue); continue; }
    groups.set(key, { key, headline: f.headline, text: f.text, issues: [f.issue], code: f.code, treatment: f.treatment });
  }
  return [...groups.values()];
}

/** The case itself, without the advice the rule already gives, so a grouped list stays one line per case. */
export const issueCase = (issue: string) =>
  issue.replace(/\s+[—–]\s+same (writer|recording|title|work)[\s\S]*$/i, "").replace(/\s+[—–]\s+one title[\s\S]*$/i, "").trim();

/**
 * The exact field a card's fix link opens in My Catalog (founder, 2026-11-14). Every "Edit in My Catalog" and every fix
 * used to land on the ISRC, whatever had actually gone wrong; this is the one place that decides otherwise.
 */
export function fieldFor(row: DifferenceRow): CatalogField {
  // A composition (a PRO, The MLC) is fixed on the words it registers: the work title, the ISWC, or the writers — never on
  // a recording's ISRC (founder, 2026-11-14).
  if (!registersRecording(row.claims[0]?.society ?? "")) {
    const said = row.issues.join(" ");
    if (/IPI|share|spelling|isn't on the agency's registration|isn't in your catalog/i.test(said)) return "writers";
    if (/ISWC/.test(said)) return "iswc";
    return "title";
  }
  // Keeping both codes is a retired-ISRC decision wherever the row's label came from.
  if (row.treatment.action === "keep-both") return "retired";
  switch (row.kind) {
    case "version-difference":
    case "version-pair":
    case "agency-version-conflict":
      return "version";
    case "title-mismatch":
      return "title";
    case "earlier-isrc":
      return "retired";
    case "missing-release":
      return "release";
    default:
      return "isrc";
  }
}

/** What the fix bar offers once My Catalog has opened the field: apply the agency's code, keep both, or add a version. */
export function actionFor(row: DifferenceRow): CatalogAction {
  if (row.treatment.action === "keep-both") return "dual_isrc";
  if (row.treatment.action === "add-version") return "add-version";
  if (row.treatment.action === "adopt") return "adopt";
  return "review";
}

/**
 * The public repertoire searches, never a login page (founder, 2026-11-13): a member checking a code should land on the
 * search they can read, not on a portal asking them to sign in.
 */
export const PUBLIC_REPERTOIRE: Record<string, string> = {
  soundexchange: "https://soundexchange.com",
  bmi: "https://repertoire.bmi.com/",
  mlc: "https://themlc.com",
  ascap: "https://www.ascap.com",
  sesac: "https://www.sesac.com",
};

/** The public search for a society's id, falling back to the ISRC search every recording can be looked up in. */
export const repertoireUrl = (society: string) => PUBLIC_REPERTOIRE[society] ?? "https://isrc.soundexchange.com/";

/** The member's own account at the agency a card is about, for the "Sign in to …" link beside the treatment. */
export const signInFor = (society: string, fallbackUrl = "") => portalFor(society, fallbackUrl);

/** One agency's claim about a song: the society, and the code (and title) it has on file. */
export type AgencyClaim = {
  society: string; name: string; isrc: string; title: string; url: string;
  /** The artist this agency credits, when its list prints one. */
  artist?: string | undefined;
  /** The version this agency names for the recording, read from its own list. */
  version?: string | undefined;
  /** The composition's own code, on the lists that register works rather than recordings (founder, 2026-11-14). */
  iswc?: string | undefined;
  /** The writers the list names, so a composition card shows who the registration has. */
  writers?: string[] | undefined;
};

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
  /** Every code the member's own catalog holds under this title: a pair means more than one recording of one song. */
  catalogCodes: { isrc: string; version: string }[];
  kind: DisagreementKind;
  issues: string[];
  treatment: Treatment;
  /** Every issue on this recording, each with the treatment that fixes it, so none of them goes unlisted. */
  fixes: RowFix[];
  status: TriageStatus;
  /** Catalog-vs-agency rows compare one society; agency-vs-agency rows compare two or more. */
  side: "catalog" | "agencies";
  /**
   * What the first button copies and what it is called (founder, 2026-11-14): a recording is found by its ISRC, a work by
   * its title, and The MLC's public search by the writer's name. Set per row, so the label and the value can never
   * disagree — and a composition card never says "Copy ISRC".
   */
  copy?: { primary: CopyTarget; secondary?: CopyTarget | undefined } | undefined;
  /** A composition's own fields, on both sides: what a PRO or The MLC registers instead of a code and an artist. */
  composition?: { catalog: { iswc: string; writers: string }; agency: { iswc: string; writers: string } } | undefined;
};

/** A value to copy, with the words on the button and the words for what was copied. */
export type CopyTarget = { label: string; value: string; what: string };

/** The button that looks a work up at its own agency: the title at a PRO, the writer at The MLC. */
function workCheck(society: string, name: string, row: { title: string; iswc: string; writer: string; hasIswc: boolean }): { treatment: Treatment; copy: DifferenceRow["copy"] } {
  const writerFirst = society === "mlc";
  const primary: CopyTarget = writerFirst
    ? { label: `Copy Writer Name & Check ${name} ↗`, value: row.writer || row.title, what: "writer name" }
    : { label: `Copy Work Title & Check ${name} ↗`, value: row.title, what: "work title" };
  const secondary: CopyTarget | undefined = row.hasIswc && row.iswc
    ? { label: `Copy ISWC & Check ${name} ↗`, value: row.iswc, what: "ISWC" }
    : undefined;
  return {
    copy: { primary, secondary },
    treatment: {
      headline: writerFirst ? `Look the writer up in ${name}` : `Look the work up in ${name}`,
      detail: writerFirst
        ? `${name} registers the composition, and its public search finds a work by the writer's name. Copy the name the list has on file and search it there; the title, ISWC and shares follow from that.`
        : `${name} registers the composition: its work title, ISWC and writers. Copy the title the list has on file and search ${name}'s public catalogue, then correct whichever side is wrong.`,
      primary: primary.label,
      secondary: secondary?.label ?? "Edit in My Catalog",
      action: "review",
    },
  };
}

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
  if (kind === "version-pair") return TREATMENTS.pairVersions;
  if (kind === "agency-version-conflict") return TREATMENTS.agencyVersion;
  if (kind === "earlier-isrc" || retiredIscrs.length > 0) return TREATMENTS.keepBoth;
  if (kind === "version-difference") return state === "waiting" ? TREATMENTS.waiting : TREATMENTS.addVersion;
  if (kind === "same-title-different-isrc") return TREATMENTS.addVersion;
  if (kind === "cross-agency-split") return TREATMENTS.crossAgency;
  if (kind === "missing-catalog-isrc") return TREATMENTS.adoptAgency;
  if (kind === "isrc-mismatch") return TREATMENTS.isrcMismatch;
  if (kind === "title-mismatch") return TREATMENTS.checkDistributor;
  if (state === "waiting") return TREATMENTS.waiting;
  return TREATMENTS.checkDistributor;
}

/** The plain-English line the card leads with, so nobody has to decode the issue tag. */
export function summaryFor(row: DifferenceRow): string {
  const agency = row.claims.map((c) => c.name).join(" and ") || "The agency";
  // A composition list registers the work, not the recording: no ISRC, no artist, no version to disagree about.
  if (row.composition) {
    if (row.kind === "missing-from-list") return `${agency} does not list this work. Its title, ISWC and writers are what a registration is filed under, so check the work there before filing it again.`;
    return row.kind === "title-mismatch"
      ? `${agency} registers this work under a different title than your catalog. The composition is the same; the name is not, and both lists should read the same.`
      : `${agency} registers the composition, not the recording: the work title, its ISWC and its writers are what the two lists have to agree on.`;
  }
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
    case "version-pair":
      return `${agency} holds ${row.agencyCodes.length} ISRCs under this one title, so this song is more than one recording. Naming the version on each entry is what keeps the two apart.`;
    case "agency-version-conflict":
      return `Two agencies name different versions of ${row.catalogIsrc || row.claims[0]?.isrc || "this recording"}, so one of the two records describes the wrong audio.`;
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
export function buildDifferenceRows({ stored, tracks: allTracks, societies = [] }: BuildInput): DifferenceRow[] {
  if (!stored) return [];
  // A Royalty Inspector song is not in My Catalog, so there is no entry to open or fix: its id is not a catalog uuid and
  // its card's fix would have written an "h:…" id to Postgres (founder, 2026-11-14).
  const tracks = allTracks.filter((t) => isCatalogId(t.id));
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const nameOf = (id: string) => societyName(id, societies);
  const urlOf = (id: string) => repertoireUrl(id);
  const rows: DifferenceRow[] = [];
  /** Every code an agency holds for a song, so a disagreement between agencies can be found. */
  const claimsByTrack = new Map<string, AgencyClaim[]>();
  /** Every work a song matched on each list, keyed `${society}:${trackId}` — even when nothing disagreed. */
  const listWorks = new Map<string, ListWork>();
  /** Every code each list holds under a song's title, read once, so a card can show the one that matched too. */
  const allCodes = new Map<string, { isrc: string; title: string; version: string; artist: string }[]>();

  const releaseOf = (track: CatalogTrack, state: ReleaseState) => ({
    title: track.metadata.album.trim(),
    date: track.metadata.releaseDate,
    // The recording's own version, never the release's edition: "Deluxe" is which edition the album is, not which mix the
    // recording is (founder, 2026-11-14), and it read as a version beside the release date.
    version: (track.metadata.version ?? "").trim(),
    state,
  });

  // Catalog entries that share a title, so a list holding more than one version of it can be spread across them.
  const byTitle = new Map<string, CatalogTrack[]>();
  for (const t of tracks) {
    const core = norm(stripVersion(t.title));
    if (core) byTitle.set(core, [...(byTitle.get(core) ?? []), t]);
  }

  for (const [societyId, entry] of Object.entries(stored.byId)) {
    const composition = !registersRecording(societyId);
    // `d.title` is the catalog's title; the agency's own title, version and artist come from the work on its list, so a
    // name difference is read from the file rather than compared with itself (founder, 2026-11-14).
    for (const m of [...entry.result.matched, ...entry.result.differences]) if (m.work) listWorks.set(`${societyId}:${m.trackId}`, m.work);
    for (const c of entry.result.clashes) listWorks.set(`${societyId}:${c.trackId}`, c.work);
    // Every code the list holds under a title, whether or not that row disagreed: the catalog's own version is usually the
    // one that matched cleanly, and a card that left it out listed three of the four versions (founder, 2026-11-14).
    for (const m of composition ? [] : [...entry.result.matched, ...entry.result.differences]) {
      const w = m.work;
      if (!w?.isrc) continue;
      const raw = w.title.trim();
      const key = `${societyId}:${m.trackId}`;
      allCodes.set(key, [...(allCodes.get(key) ?? []), {
        isrc: w.isrc.trim(),
        title: (w.coreTitle ?? stripVersion(raw)).trim(),
        version: (w.version ?? versionTail(raw)).trim(),
        artist: (w.artist ?? "").trim(),
      }]);
    }
    // Two catalog entries under one title take the two works the list holds under it, each by the version it names.
    for (const group of composition ? [] : byTitle.values()) {
      if (group.length < 2) continue;
      const core = norm(stripVersion(group[0]!.title));
      const candidates = worksFromResult(entry.result).filter((w) => norm(w.coreTitle ?? stripVersion(w.title)) === core);
      if (candidates.length < 2) continue;
      spreadWorks(group, candidates, (t, w) => listWorks.set(`${societyId}:${t.id}`, w));
    }
    const grouped = new Map<string, { titles: string[]; codes: { isrc: string; title: string; version: string; artist: string }[]; issues: string[]; iswc: string; writers: string[] }>();
    for (const d of entry.result.differences) {
      const g = grouped.get(d.trackId) ?? { titles: [], codes: [], issues: [], iswc: "", writers: [] };
      // The agency's own title, read as the file wrote it: "Quit Playing With Me (Dirty Version)" names the version "Dirty
      // Version". Reading the version off the stripped title found nothing, so every code showed "Not named" while the
      // file listed all four (founder, 2026-11-14).
      const raw = (d.work?.title ?? d.title).trim();
      const agencyTitle = (d.work?.coreTitle ?? stripVersion(raw)).trim();
      const version = (d.work?.version ?? versionTail(raw)).trim();
      g.titles.push(agencyTitle);
      if (composition) {
        if (!g.iswc && d.work?.iswc) g.iswc = d.work.iswc.trim();
        for (const w of d.work?.writers ?? []) if (w.name && !g.writers.includes(w.name)) g.writers.push(w.name);
      }
      if (!composition && d.work?.isrc) g.codes.push({ isrc: d.work.isrc.trim(), title: agencyTitle, version, artist: (d.work.artist ?? "").trim() });
      g.issues.push(...d.issues);
      grouped.set(d.trackId, g);
    }
    for (const [trackId, g] of grouped) {
      const track = byId.get(trackId);
      if (!track) continue;
      const m = track.metadata;
      const catalogIsrc = m.isrc.trim();
      // One row per code the list holds under this title, each with the version and artist that row names.
      const codes = composition ? [] : (allCodes.get(`${societyId}:${trackId}`) ?? g.codes)
        .filter((c, i, all) => c.isrc && all.findIndex((x) => x.isrc.toUpperCase() === c.isrc.toUpperCase()) === i);
      const agencyCodes = codes.map((c) => c.isrc.toUpperCase()).filter(Boolean);
      const agencyVersions = [...new Set(codes.map((c) => c.version).filter(Boolean))];
      const agencyArtists = [...new Set(codes.map((c) => c.artist).filter(Boolean))];
      const agencyIsrc = codes[0]?.isrc ?? "";
      const retired = (m.retiredIscrs ?? []).filter(Boolean);
      const state = releaseState(m, agencyIsrc);
      const catalogTitleCore = stripVersion(track.title);
      // A composition's title is compared the way both sides mean it: case, "&", and numbers printed as words
      // ("24/7 Love" is "TWENTY FOUR SEVEN LOVE" on a BMI list — founder, 2026-11-14).
      const titleDiffers = g.titles.some((x) => titleKey(x) !== titleKey(catalogTitleCore));
      const bothCodes = !!catalogIsrc && !!agencyIsrc;
      const codeDiffers = bothCodes && catalogIsrc.toUpperCase() !== agencyIsrc.toUpperCase();
      // A composition has no version and no recording artist: those are the recording's, and comparing them to a PRO's
      // work filed every BMI song as "Artist: Not on the list" (founder, 2026-11-14).
      const versions = composition ? { catalog: "", agency: "" } : { catalog: (m.version ?? "").trim() || versionTail(track.title), agency: agencyVersions.join(" · ") };
      const artists = composition ? { catalog: "", agency: "" } : { catalog: track.artist ?? "", agency: agencyArtists[0] ?? "" };
      // Two or more codes under one title is one recording with more than one version — or the retired code beside the
      // current one — never an isolated metadata mismatch (founder, 2026-11-14).
      const secondCode = !composition && agencyCodes.length > 1 && !!catalogIsrc && agencyCodes.includes(catalogIsrc.toUpperCase());
      // The four cases the treatment table names, decided by what actually disagrees: the title, the code, or both.
      const retiredCodeOnList = !!agencyIsrc && retired.map((c) => c.toUpperCase()).includes(agencyIsrc.toUpperCase());
      // The saved comparison says "second ISRC for this title" when the list holds two codes; that is the same rule as
      // two codes on this row, and both are another version rather than one code standing in for another.
      const secondCodeReported = secondCode || g.issues.some((i) => /second ISRC for/i.test(i));
      const kind: DisagreementKind = composition
        ? titleDiffers
          ? "title-mismatch"
          : kindOf([...new Set(g.issues)], catalogIsrc, agencyIsrc, retired)
        : retiredCodeOnList
        ? "earlier-isrc"
        : secondCodeReported
        ? "same-title-different-isrc"
        : titleDiffers && bothCodes
          ? (codeDiffers ? "isrc-mismatch" : "title-mismatch")
          : !titleDiffers && codeDiffers
            // One code on the list and a different one in the catalog: the two records name different recordings, so
            // the member checks which copy the distributor delivered. "Two codes under one title" is the case above.
            ? "isrc-mismatch"
            : kindOf([...new Set(g.issues)], catalogIsrc, agencyIsrc, retired);
      // The agency side lists every code the list holds under the title, so four versions read as four rows with their own
      // codes instead of one blank row and three bare codes (founder, 2026-11-14).
      const claims: AgencyClaim[] = composition
        ? [{ society: societyId, name: nameOf(societyId), isrc: "", title: g.titles[0] || track.title, url: urlOf(societyId), artist: "", version: "", iswc: g.iswc, writers: g.writers }]
        : (codes.length ? codes : [{ isrc: agencyIsrc, title: g.titles[0] ?? track.title, version: "", artist: "" }])
          .map((c) => ({ society: societyId, name: nameOf(societyId), isrc: c.isrc, title: c.title || track.title, url: urlOf(societyId), artist: c.artist, version: c.version }));
      const claim: AgencyClaim = claims[0]!;
      // A composition is looked up at its own agency by the words it registers, never by a code: no card ever offers
      // "Copy ISRC" or sends the member to their distributor about a work (founder, 2026-11-14).
      const check = composition
        ? workCheck(societyId, nameOf(societyId), {
            title: claim.title,
            iswc: g.iswc,
            writer: nameFromIssue([...new Set(g.issues)].join(" ")) || g.writers[0] || "",
            hasIswc: !!g.iswc,
          })
        : undefined;
      const treatment: Treatment = check
        ? { ...treatmentFor({ kind, catalogIsrc, retiredIscrs: retired, releaseState: "current" }), ...check.treatment }
        : treatmentFor({ kind, catalogIsrc, retiredIscrs: retired, releaseState: state });
      const issues = [...new Set(g.issues)];
      const versionsDiffer = !!versions.agency && !!versions.catalog && norm(versions.agency) !== norm(versions.catalog);
      const artistsDiffer = !!artists.agency && norm(artists.agency) !== norm(artists.catalog);
      // Nothing to decide when both sides read the same recording: a stored comparison made before the name rule was
      // fixed still carries its old issue, and a card showing four identical fields is never a difference
      // (founder, 2026-11-14). A writer, ISWC or share issue is substantive and always keeps its card.
      const nameOnly = issues.length > 0 && issues.every((i) => /^The agency calls it /.test(i));
      // A title the list holds under two codes is never suppressed: the second code is the difference worth reading.
      const identical = composition
        ? !issues.length
        : !secondCode && !titleDiffers && !codeDiffers && !versionsDiffer && !artistsDiffer && nameOnly;
      if (agencyIsrc) claimsByTrack.set(trackId, [...(claimsByTrack.get(trackId) ?? []).filter((c) => c.society !== societyId), claim]);
      if (identical) continue;
      rows.push({
        key: `${societyId}:${trackId}`,
        songId: trackId,
        title: track.title || "Untitled",
        artist: track.artist,
        occurrences: g.titles.length,
        claims,
        catalogIsrc,
        retiredIscrs: retired,
        release: releaseOf(track, state),
        versions,
        artists,
        agencyCodes: codes.map((c) => ({ isrc: c.isrc, version: c.version })),
        catalogCodes: [{ isrc: catalogIsrc, version: versions.catalog }].filter((c) => c.isrc),
        secondCode,
        kind,
        issues,
        treatment,
        fixes: fixesFor(issues, { catalogIsrc, agencyIsrc }).map((f) => (check
          ? { ...f, treatment: { ...f.treatment, primary: check.treatment.primary, secondary: check.treatment.secondary, action: "review" as const } }
          : f)),
        status: treatment.action === "waiting" ? "waiting" : retired.length ? "both-registered" : "needs-triage",
        side: "catalog",
        ...(check ? { copy: check.copy } : {}),
        ...(check
          ? {
              composition: {
                catalog: {
                  iswc: (m.iswc ?? "").trim(),
                  writers: [...m.writers, ...m.composers].map((w) => creditName(w)).filter(Boolean).join(" · "),
                },
                agency: { iswc: g.iswc, writers: g.writers.join(" · ") },
              },
            }
          : {}),
      });
    }
  }

  // One title, two codes, both catalogued: nothing disagrees, so no difference was recorded — and the member was never
  // told the two codes mean two recordings of one song. A pair of entries under one title always gets a card
  // (founder, 2026-11-14), with Add Version on it, so the two can be told apart before a royalty is split.
  const byPair = new Map<string, CatalogTrack[]>();
  for (const t of tracks) {
    const core = stripVersion(t.title);
    if (!core.trim()) continue;
    const key = `${norm(core)}|${norm(t.artist)}`;
    byPair.set(key, [...(byPair.get(key) ?? []), t]);
  }
  for (const [pairKey, group] of byPair) {
    const catalogCodes = group.map((t) => ({ isrc: t.metadata.isrc.trim(), version: (t.metadata.version ?? "").trim() || versionTail(t.title) }));
    const distinct = [...new Set(catalogCodes.map((c) => c.isrc.toUpperCase()).filter(Boolean))];
    if (distinct.length < 2) continue;
    for (const societyId of Object.keys(stored.byId)) {
      if (!registersRecording(societyId)) continue;
      const all: AgencyClaim[] = [];
      for (const t of group) {
        const w = listWorks.get(`${societyId}:${t.id}`);
        if (!w?.isrc) continue;
        all.push({ society: societyId, name: nameOf(societyId), isrc: w.isrc.trim(), title: (w.coreTitle ?? stripVersion(w.title)).trim(), url: urlOf(societyId), artist: w.artist ?? "", version: w.version ?? versionTail(w.title) });
      }
      // The list must hold more than one recording: one entry there is a missing code, which its own card already reports.
      // Claims are one per distinct code, so four catalog entries the list knows under a single code are never shown as a
      // pair of recordings (founder, 2026-11-14).
      const claims = all.filter((c, i, every) => every.findIndex((x) => x.isrc.toUpperCase() === c.isrc.toUpperCase()) === i);
      if (claims.length < 2) continue;
      const first = group[0]!;
      const m = first.metadata;
      const state = releaseState(m);
      const issues = [`Two ISRCs under "${stripVersion(first.title) || first.title}": ${distinct.join(", ")}`];
      rows.push({
        key: `pair:${societyId}:${pairKey}`,
        songId: first.id,
        title: stripVersion(first.title) || first.title || "Untitled",
        artist: first.artist,
        occurrences: claims.length,
        claims,
        catalogIsrc: distinct[0] ?? "",
        retiredIscrs: [],
        release: releaseOf(first, state),
        // Both codes, both versions: the first claim's version alone read "Clean Version" for a song the list names Clean
        // and Dirty (founder, 2026-11-14).
        versions: {
          catalog: [...new Set(catalogCodes.map((c) => c.version).filter(Boolean))].join(" · "),
          agency: [...new Set(claims.map((c) => c.version ?? "").filter(Boolean))].join(" · "),
        },
        artists: { catalog: first.artist ?? "", agency: claims.find((c) => c.artist)?.artist ?? "" },
        agencyCodes: claims.map((c) => ({ isrc: c.isrc, version: c.version ?? "" })),
        catalogCodes,
        secondCode: false,
        kind: "version-pair",
        issues,
        treatment: TREATMENTS.pairVersions,
        fixes: fixesFor(issues, { catalogIsrc: distinct[0] ?? "", agencyIsrc: claims[0]?.isrc ?? "" }),
        status: "needs-triage",
        side: "catalog",
      });
    }
  }

  // One code, two agencies, two version names: one code names one recording, so the audio itself is in question
  // (founder, 2026-11-14).
  const allClaims = new Map<string, AgencyClaim[]>();
  for (const [key, w] of listWorks) {
    const at = key.indexOf(":");
    const societyId = key.slice(0, at), trackId = key.slice(at + 1);
    if (!w.isrc) continue;
    const claim: AgencyClaim = { society: societyId, name: nameOf(societyId), isrc: w.isrc.trim(), title: (w.coreTitle ?? stripVersion(w.title)).trim(), url: urlOf(societyId), artist: w.artist ?? "", version: w.version ?? "" };
    allClaims.set(trackId, [...(allClaims.get(trackId) ?? []).filter((c) => c.society !== societyId), claim]);
  }
  for (const [trackId, claims] of allClaims) {
    const track = byId.get(trackId);
    if (!track) continue;
    const codes = [...new Set(claims.map((c) => c.isrc.toUpperCase()).filter(Boolean))];
    if (codes.length !== 1) continue;
    const named = [...new Set(claims.map((c) => norm(c.version ?? "")).filter(Boolean))];
    if (named.length < 2) continue;
    const m = track.metadata;
    const retired = (m.retiredIscrs ?? []).filter(Boolean);
    const state = releaseState(m, claims[0]!.isrc);
    const issues = claims.filter((c) => c.version).map((c) => `${c.name} names "${c.version}" for ISRC ${c.isrc}`);
    const treatment = TREATMENTS.agencyVersion;
    rows.push({
      key: `agencyversions:${trackId}`,
      songId: trackId,
      title: track.title || "Untitled",
      artist: track.artist,
      occurrences: claims.length,
      claims,
      catalogIsrc: m.isrc.trim(),
      retiredIscrs: retired,
      release: releaseOf(track, state),
      versions: { catalog: (m.version ?? "").trim() || versionTail(track.title), agency: claims[0]!.version ?? "" },
      artists: { catalog: track.artist ?? "", agency: claims[0]?.artist ?? "" },
      agencyCodes: claims.map((c) => ({ isrc: c.isrc, version: c.version ?? "" })),
      catalogCodes: [{ isrc: m.isrc.trim(), version: (m.version ?? "").trim() || versionTail(track.title) }].filter((c) => c.isrc),
      secondCode: false,
      kind: "agency-version-conflict",
      issues,
      treatment,
      fixes: fixesFor(issues, { catalogIsrc: m.isrc.trim(), agencyIsrc: claims[0]?.isrc ?? "" }),
      status: "needs-triage",
      side: "agencies",
    });
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
      catalogCodes: [{ isrc: m.isrc.trim(), version: (m.version ?? "").trim() || versionTail(track.title) }].filter((c) => c.isrc),
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
    const composition = !registersRecording(societyId);
    for (const miss of entry.result.notListed) {
      const track = byId.get(miss.trackId);
      if (!track) continue;
      const m = track.metadata;
      const retired = (m.retiredIscrs ?? []).filter(Boolean);
      const state = releaseState(m);
      // A list that registers works registers compositions (founder, 2026-11-14): a song missing from BMI is a work to
      // submit, with no recording's version, artist or ISRC on the card and no ISRC to copy.
      if (composition) {
        const writers = [...m.writers, ...m.composers].map((w) => creditName(w)).filter(Boolean);
        const iswc = (m.iswc ?? "").trim();
        const check = workCheck(societyId, nameOf(societyId), { title: m.title, iswc, writer: writers[0] ?? "", hasIswc: !!iswc });
        const treatment: Treatment = {
          ...check.treatment,
          headline: `Register this work with ${nameOf(societyId)}`,
          detail: `${nameOf(societyId)} registers the composition, not the recording, and this work is not on its list. Copy the work title (and the ISWC, if you have one), search ${nameOf(societyId)}'s public catalogue to be sure, then submit the work with its writers and splits.`,
        };
        rows.push({
          key: `${societyId}:missing:${miss.trackId}`,
          songId: miss.trackId,
          title: track.title || "Untitled",
          artist: track.artist,
          occurrences: 1,
          claims: [{ society: societyId, name: nameOf(societyId), isrc: "", title: m.title, url: urlOf(societyId), artist: "", version: "", iswc, writers }],
          catalogIsrc: "",
          retiredIscrs: retired,
          release: releaseOf(track, state),
          versions: { catalog: "", agency: "" },
          artists: { catalog: "", agency: "" },
          agencyCodes: [],
          catalogCodes: [],
          secondCode: false,
          kind: "missing-from-list",
          issues: [`Not on the ${nameOf(societyId)} list`],
          treatment,
          fixes: fixesFor([`Not on the ${nameOf(societyId)} list`], { catalogIsrc: "", agencyIsrc: "" }).map((f) => ({
            ...f,
            treatment: { ...f.treatment, primary: treatment.primary, secondary: treatment.secondary, action: "review" as const },
          })),
          status: treatment.action === "waiting" ? "waiting" : "needs-triage",
          side: "catalog",
          copy: check.copy,
          composition: { catalog: { iswc, writers: writers.join(" · ") }, agency: { iswc: "", writers: "" } },
        });
        continue;
      }
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
        catalogCodes: [{ isrc: m.isrc.trim(), version: (m.version ?? "").trim() || versionTail(track.title) }].filter((c) => c.isrc),
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
