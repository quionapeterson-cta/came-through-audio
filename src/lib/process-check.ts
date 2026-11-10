import type { Metadata } from "@/lib/metadata";

/**
 * The credit check and the master checkup (PLAN-releases-and-roles §11–12): one pure engine with two lenses.
 *
 * The rules that keep it honest: three outcomes (found / empty / unknown) so a lookup that never answered is never
 * called missing; identifiers before names, with a name only breaking a tie; a typed row is a claim and is never shown
 * as verified; shares are compared party by party, never total against total; and a reading the member never gave is
 * "no reading yet", never zero streams.
 */
export type CheckState = "agree" | "difference" | "unknown" | "waiting";
export type LookupResult = "found" | "empty" | "unknown";
export type FactState = "match" | "difference" | "unknown";

export type WriterCopy = { legalName: string; ipi?: string; share?: string };

/** One copy of the same song: the agency's record, or the artist's release credits. */
export type WorkCopy = {
  name: string;
  /** When it was read. Blank means it hasn't been read, which is not the same as empty. */
  at: string;
  /** True only when a public repertoire answered; a pasted or typed row is a claim. */
  verified: boolean;
  result: LookupResult;
  title: string;
  iswc?: string;
  isrc?: string;
  writers: WriterCopy[];
};

export type Fact = {
  key: string;
  label: string;
  catalog: string;
  agency: string;
  release: string;
  state: FactState;
  field?: string;
};

export type CheckFinding = {
  id: string;
  state: Exclude<FactState, "match">;
  title: string;
  detail: string;
  field?: string;
  values?: { catalog: string; agency: string; release: string };
};

export type ProcessCheck = { state: CheckState; findings: CheckFinding[]; facts: Fact[]; next: string; checkedAt: string };

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
const clean = (v?: string) => (v ?? "").trim();

/**
 * How two spellings of the same name are compared: case, punctuation, accents, suffixes and word order are ignored,
 * so "SMITH, John Jr." finds "John Smith". It only ever *finds* a difference; it never rewrites a name.
 */
export function nameKey(name: string): string {
  return clean(name)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => !!w && !SUFFIXES.has(w))
    .sort()
    .join(" ");
}

export const sameName = (a?: string, b?: string): boolean => !!clean(a) && !!clean(b) && nameKey(a!) === nameKey(b!);

/**
 * Identifiers before names: an ISWC or an ISRC settles the work even when the titles differ. A title alone never
 * establishes a match; it only breaks a tie when a writer's name agrees too.
 */
export function sameWork(a: Pick<WorkCopy, "title" | "iswc" | "isrc" | "writers">, b: Pick<WorkCopy, "title" | "iswc" | "isrc" | "writers">): boolean {
  if (clean(a.iswc) && clean(a.iswc) === clean(b.iswc)) return true;
  if (clean(a.isrc) && clean(a.isrc) === clean(b.isrc)) return true;
  if (!clean(a.title) || nameKey(a.title) !== nameKey(b.title)) return false;
  return a.writers.some((w) => b.writers.some((v) => sameName(w.legalName, v.legalName)));
}

function fieldState(catalog: string, agency: string, release: string, equal: (a: string, b: string) => boolean): FactState {
  const pairs = [[catalog, agency], [catalog, release], [agency, release]].filter(([a, b]) => !!clean(a) && !!clean(b)) as [string, string][];
  if (!pairs.length) return "unknown";
  return pairs.every(([a, b]) => equal(a, b)) ? "match" : "difference";
}

const eq = (a: string, b: string) => clean(a) === clean(b);

/**
 * The three copies of one song: your catalog, your agency registration and the artist's released credits.
 * Differences and unknowns come back as findings; everything that matches stays in `facts` with a tick.
 */
export function creditCheck(song: Metadata, agency: WorkCopy | null | undefined, release: WorkCopy | null | undefined): ProcessCheck {
  const facts: Fact[] = [];
  const findings: CheckFinding[] = [];
  const checkedAt = clean(release?.at) || clean(agency?.at);
  const noRelease = !release || !clean(release.at);
  const noAgency = !agency || !clean(agency.at);
  if (noRelease || noAgency) {
    return {
      state: "waiting",
      findings: [],
      facts,
      checkedAt,
      next: noRelease
        ? "The check runs when the artist's release exists. Add its credit line when it does."
        : "Register the work with the PRO and The MLC first, then read the registration back here.",
    };
  }

  const add = (key: string, label: string, catalog: string, agencyValue: string, releaseValue: string, equal: (a: string, b: string) => boolean, field?: string) => {
    // A fact no copy carries isn't a difference and isn't a match: there is simply nothing to compare.
    if (!clean(catalog) && !clean(agencyValue) && !clean(releaseValue)) return;
    const state = fieldState(catalog, agencyValue, releaseValue, equal);
    const fact: Fact = { key, label, catalog: clean(catalog), agency: clean(agencyValue), release: clean(releaseValue), state, ...(field ? { field } : {}) };
    facts.push(fact);
    if (state !== "match") {
      findings.push({
        id: key, state, title: label, ...(field ? { field } : {}),
        detail: state === "unknown" ? `${label} couldn't be compared: one copy doesn't have it. Nothing is called missing.` : `${label} differs between the copies. Fix the copy you control first: your catalog.`,
        values: { catalog: fact.catalog, agency: fact.agency, release: fact.release },
      });
    }
  };

  add("title", "Song title", song.title, agency!.title, release!.title, (a, b) => nameKey(a) === nameKey(b), "title");
  add("iswc", "ISWC", song.iswc, agency!.iswc ?? "", release!.iswc ?? "", eq, "iswc");
  add("isrc", "ISRC", song.isrc, agency!.isrc ?? "", release!.isrc ?? "", eq, "isrc");

  // A lookup that never answered may not produce a finding about the registration itself.
  if (agency!.result === "unknown") {
    findings.push({ id: "agency", state: "unknown", title: `${agency!.name} couldn't be read`, detail: "The lookup didn't answer, so nothing here is called missing. Try it again before changing anything." });
  }

  const catalogWriters = song.writers.filter((w) => clean(w.legalName) || clean(w.ipi));
  for (const w of catalogWriters) {
    const name = clean(w.legalName) || `IPI ${clean(w.ipi)}`;
    const key = `writer:${nameKey(name) || clean(w.ipi)}`;
    const a = agency!.writers.find((x) => (clean(w.ipi) && clean(x.ipi) && clean(w.ipi) === clean(x.ipi)) || sameName(x.legalName, w.legalName));
    const r = release!.writers.find((x) => sameName(x.legalName, w.legalName));
    add(`${key}:name`, `Writer · ${name}`, w.legalName ?? "", a?.legalName ?? "", r?.legalName ?? "", eq, "writers");
    if (clean(w.ipi) || clean(a?.ipi)) add(`${key}:ipi`, `IPI · ${name}`, w.ipi ?? "", a?.ipi ?? "", "", eq, "writers");
    if (clean(w.percentage) || clean(a?.share)) add(`${key}:share`, `Split · ${name}`, w.percentage ?? "", a?.share ?? "", "", eq, "writers");
    // Found and absent is a real difference; a failed lookup can never say a writer is missing.
    if (!a && agency!.result === "found") {
      findings.push({ id: `${key}:missing`, state: "difference", title: `${name} isn't on the registration`, detail: "The registration was read and doesn't list this writer. Compare the legal name and IPI, then correct the copy you control.", field: "writers", values: { catalog: name, agency: "not listed", release: r?.legalName ?? "" } });
    }
    if (!r) {
      findings.push({ id: `${key}:release`, state: "difference", title: `${name} isn't credited on the release`, detail: "A registration is what the PRO and The MLC pay on; a release credit is what listeners see. Both should name the same writer.", field: "writers", values: { catalog: name, agency: a?.legalName ?? "", release: "not credited" } });
    }
  }
  for (const extra of agency!.writers.filter((x) => clean(x.legalName) && !catalogWriters.some((w) => sameName(w.legalName, x.legalName)))) {
    findings.push({ id: `agency:${nameKey(extra.legalName)}:extra`, state: "difference", title: `The registration lists ${extra.legalName}`, detail: "That writer isn't in your catalog copy. Add them, or correct the registration if it's wrong.", field: "writers", values: { catalog: "not listed", agency: extra.legalName, release: "" } });
  }

  const state: CheckState = findings.some((f) => f.state === "difference") ? "difference" : findings.length ? "unknown" : "agree";
  return {
    state, findings, facts, checkedAt,
    next: state === "difference"
      ? "Fix the copy you control first: your catalog. The registration and the release are the other parties' records."
      : state === "unknown"
        ? "A lookup didn't answer. Try it again before changing anything."
        : "The three copies agree. Check again when a registration changes or the artist releases something new.",
  };
}

export type DealTerms = Pick<Metadata, "dealType" | "dealDate" | "dealStreams" | "dealContract">;
export type StreamReading = { at: string; streams: number };
export type Renegotiation = "waiting" | "not yet" | "due" | "over";

/**
 * Where the recording stands against the cap the member entered. No reading and no cap are both "waiting": the app
 * never estimates a stream count and never invents a threshold between "inside the licence" and "at the cap".
 */
export function renegotiationDue(deal: DealTerms, reading?: StreamReading | null): Renegotiation {
  const cap = Number(clean(deal.dealStreams));
  if (!reading || !clean(reading.at) || !Number.isFinite(cap) || cap <= 0 || !Number.isFinite(reading.streams)) return "waiting";
  if (reading.streams > cap) return "over";
  if (reading.streams === cap) return "due";
  return "not yet";
}

/** The one line the master's card shows, in the member's own numbers. */
export function masterLine(deal: DealTerms, reading?: StreamReading | null): string {
  const cap = Number(clean(deal.dealStreams));
  if (!reading || !clean(reading.at)) return "No reading yet: check the master's streams in your distributor report.";
  if (!Number.isFinite(cap) || cap <= 0) return `${reading.streams.toLocaleString()} streams. Record the count where the deal changes to compare it.`;
  const left = cap - reading.streams;
  if (left < 0) return `${reading.streams.toLocaleString()} of ${cap.toLocaleString()} — the license point has passed.`;
  if (left === 0) return `${reading.streams.toLocaleString()} of ${cap.toLocaleString()} — the license point is reached.`;
  return `${reading.streams.toLocaleString()} of ${cap.toLocaleString()} — ${left.toLocaleString()} to go.`;
}

/** The producer's checkup: the deal recorded, the licence linked, and the reading against the cap. */
export function masterCheck(deal: DealTerms, reading?: StreamReading | null): ProcessCheck {
  const findings: CheckFinding[] = [];
  const checkedAt = clean(reading?.at);
  if (!clean(deal.dealType) || !clean(deal.dealDate)) {
    findings.push({ id: "deal", state: "difference", title: "The deal isn't fully recorded", detail: "The deal type and date are what an amendment and a reminder count from.", field: "dealType" });
  }
  if (!clean(deal.dealContract)) {
    findings.push({ id: "contract", state: "difference", title: "No contract linked", detail: "The licence holds the fee, points and territory. Link it so the terms measured here are the ones on file.", field: "dealContract" });
  }
  const due = renegotiationDue(deal, reading);
  if (due === "waiting") {
    findings.push({ id: "cap", state: "unknown", title: clean(deal.dealStreams) ? "No reading yet" : "No stream count recorded", detail: clean(deal.dealStreams) ? "Enter the streams from your distributor report. Nothing is compared until you do." : "Record the count where the deal changes, or the check has nothing to compare a reading against.", field: "dealStreams" });
  } else if (due !== "not yet") {
    findings.push({ id: "cap", state: "difference", title: due === "over" ? "The license point has passed" : "The license point is reached", detail: masterLine(deal, reading), field: "dealStreams" });
  }
  const state: CheckState = findings.some((f) => f.state === "difference") ? "difference" : findings.length ? "unknown" : "agree";
  return {
    state, findings, facts: [], checkedAt, next: due === "waiting"
      ? "Enter the master's streams from your distributor report, then check again."
      : due === "not yet"
        ? "The recording is inside its licence. Check again on the date you set."
        : "The cap is reached. Decide the ask, then amend the licence and file it back.",
  };
}
