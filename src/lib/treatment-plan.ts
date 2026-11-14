import { loadOnboarding } from "@/lib/artist-profile";
import { listTracks } from "@/lib/catalog";
import { healthReport } from "@/lib/health";
import { ACCOUNT_REF, songChecklist } from "@/lib/health-checklist";
import { inspectorChecks, listInspectorSongs, listStatuses } from "@/lib/health-songs";
import { listReports, loadSnapshot, scopeName } from "@/lib/health-reports";
import { listChecks } from "@/lib/repertoire-checks";
import { countryByCode, guessCountry } from "@/lib/repertoires";
import { listSplitSheets, splitStatus as sheetStatus } from "@/lib/splits";
import {
  ORGAN_IMPACT,
  ORGAN_ORDER,
  diagnosisLine,
  royaltyCheckup,
  type Checkup,
  type Finding,
  type Organ,
  type OrganId,
  type OrganState,
  type TreatmentStep,
} from "@/lib/royalty-checkup";

/**
 * The Interactive Treatment Plan reads the treatment recommendations the Royalty Health Report already produced
 * (`Checkup.organs[].findings[].steps`). Nothing here re-diagnoses or writes anything: the same report, regrouped.
 *
 * It reads, in order: the report just left by the report page (sessionStorage hand-off), then the newest saved report
 * that kept its whole report (Past Royalty Health Reports), then — when no report has been filed yet — the exact same
 * engine over the catalog the report would read. All three are the report's own treatment text.
 */
export type PlanPriority = "priority" | "support" | "optimal";

export const PRIORITY_ORDER: PlanPriority[] = ["priority", "support", "optimal"];
export const PRIORITY_LABEL: Record<PlanPriority, string> = {
  priority: "Priority Focus",
  support: "Needs Support",
  optimal: "Optimal / Maintenance",
};
/** "Timing" as phases of the plan, never a promised date. */
export const PRIORITY_PHASE: Record<PlanPriority, string> = {
  priority: "Start now",
  support: "Next 30 days",
  optimal: "Keep it steady",
};

/** The report's organ states, read as plan priorities. */
export function priorityOf(state: OrganState): PlanPriority {
  if (state === "treat" || state === "noflow") return "priority";
  if (state === "watch") return "support";
  return "optimal";
}

/** What a healthy version of each system gives back, in plain words (the report's own Royalty Impact, forward-looking). */
export const ORGAN_GAIN: Record<OrganId, string> = {
  heart: "Both halves of every performance royalty keep flowing, writer and publisher side.",
  lungs: "Every stream's mechanical royalty is matched to its recording instead of sitting unmatched.",
  kidneys: "The recording side collects too: internet and satellite radio plays reach you.",
  brain: "Agencies match each play to the right song, writer and share.",
  spine: "Splits are settled, so no agency can hold a payment waiting on paperwork.",
  pulse: "Every registration is confirmed and still current, so nothing quietly stops arriving.",
};

export type PlanCard = {
  key: string;
  organ: OrganId;
  organName: string;
  system: string;
  priority: PlanPriority;
  /** The report's locked diagnosis headline. */
  dx: string;
  impact: string;
  what: string;
  cause: string;
  gain: string;
  timing: string;
  steps: TreatmentStep[];
  checks: string[];
  songs: { id: string; title: string; why: string }[];
  note?: string | undefined;
  /** No finding: the organ passed, and this card is its maintenance list. */
  maintenance: boolean;
};

export type PlanSystem = {
  id: OrganId;
  name: string;
  system: string;
  state: OrganState;
  priority: PlanPriority;
  broken: boolean;
  cards: PlanCard[];
};

export type PriorityGroup = { priority: PlanPriority; systems: PlanSystem[] };

export type TreatmentPlan = {
  groups: PriorityGroup[];
  systems: PlanSystem[];
  priorityCount: number;
  supportCount: number;
  optimalCount: number;
  findings: number;
};

function cardOf(organ: Organ, finding: Finding, priority: PlanPriority): PlanCard {
  return {
    key: `${organ.id}-${finding.id}`,
    organ: organ.id,
    organName: organ.name,
    system: organ.system,
    priority,
    dx: diagnosisLine(finding),
    impact: ORGAN_IMPACT[organ.id],
    what: finding.what,
    cause: finding.cause,
    gain: ORGAN_GAIN[organ.id],
    timing: PRIORITY_PHASE[priority],
    steps: finding.steps,
    checks: [],
    songs: finding.songs.map((s) => ({ id: s.id, title: s.title, why: s.why })),
    note: finding.note,
    maintenance: false,
  };
}

/** A healthy organ has no findings; its maintenance card is the checklist the report says it examined. */
function maintenanceCard(organ: Organ, priority: PlanPriority): PlanCard {
  return {
    key: `${organ.id}-maintenance`,
    organ: organ.id,
    organName: organ.name,
    system: organ.system,
    priority,
    dx: "Healthy and steady.",
    impact: ORGAN_IMPACT[organ.id],
    what: "Everything this system is checked for passed in your latest report.",
    cause: "",
    gain: ORGAN_GAIN[organ.id],
    timing: PRIORITY_PHASE[priority],
    steps: [],
    checks: organ.checks,
    songs: [],
    maintenance: true,
  };
}

/** Regroups the report's organs and treatment text — the report itself is untouched. */
export function buildTreatmentPlan(checkup: Checkup): TreatmentPlan {
  const systems: PlanSystem[] = checkup.organs.map((organ) => {
    const priority = priorityOf(organ.state);
    const cards = organ.findings.length
      ? organ.findings.map((f) => cardOf(organ, f, priority))
      : [maintenanceCard(organ, priority)];
    return { id: organ.id, name: organ.name, system: organ.system, state: organ.state, priority, broken: organ.broken, cards };
  });
  const rank = (s: PlanSystem) => PRIORITY_ORDER.indexOf(s.priority) * 10 + ORGAN_ORDER.indexOf(s.id);
  const ordered = [...systems].sort((a, b) => rank(a) - rank(b));
  const groups: PriorityGroup[] = PRIORITY_ORDER.map((priority) => ({ priority, systems: ordered.filter((s) => s.priority === priority) })).filter((g) => g.systems.length > 0);
  return {
    groups,
    systems,
    priorityCount: systems.filter((s) => s.priority === "priority").length,
    supportCount: systems.filter((s) => s.priority === "support").length,
    optimalCount: systems.filter((s) => s.priority === "optimal").length,
    findings: checkup.organs.reduce((n, organ) => n + organ.findings.length, 0),
  };
}

/** Current vs 30 days vs 90 days: the glowing rings move toward Cobalt and Gold. A projection, not a promise. */
export type PlanPhase = "current" | "30" | "90";
export const PLAN_PHASES: { id: PlanPhase; label: string }[] = [
  { id: "current", label: "Current" },
  { id: "30", label: "30 Days" },
  { id: "90", label: "90 Days" },
];

export function projectState(state: OrganState, phase: PlanPhase): OrganState {
  if (phase === "current") return state;
  if (phase === "30") return state === "treat" || state === "noflow" ? "watch" : "healthy";
  return "healthy";
}

export function phaseLabel(phase: PlanPhase): string {
  return phase === "current" ? "right now" : phase === "30" ? "in 30 days" : "in 90 days";
}

// ── Reading the report's own data ───────────────────────────────────────────

export type PlanSource = "handoff" | "saved" | "live";
export type TreatmentPlanData = { checkup: Checkup; date: string; scope: string; country: string; source: PlanSource };

const HANDOFF_KEY = "cta-treatment-plan-v1";
const HANDOFF_MAX_MS = 30 * 60 * 1000;

/** Left by the report page so the plan opens on exactly the report the member just read. */
export function savePlanHandoff(checkup: Checkup, reportDate: string, reportCountry: string, reportScope: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ at: Date.now(), checkup, date: reportDate, country: reportCountry, scope: reportScope }));
  } catch { /* private mode: the saved report or a live read still works */ }
}

export function readPlanHandoff(): TreatmentPlanData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { at?: number; checkup?: Checkup; date?: string; country?: string; scope?: string };
    if (!saved.at || Date.now() - saved.at > HANDOFF_MAX_MS || !saved.checkup?.organs?.length) return null;
    return { checkup: saved.checkup, date: saved.date ?? "", scope: saved.scope ?? "Royalty Health Report", country: saved.country ?? "", source: "handoff" };
  } catch {
    return null;
  }
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/**
 * The newest saved report that kept its whole report, because its snapshot holds the exact treatment steps. Falls back
 * to the report engine over the catalog only when no report has been filed yet.
 */
export async function loadTreatmentPlan(userId: string): Promise<TreatmentPlanData> {
  const handoff = readPlanHandoff();
  if (handoff) return handoff;

  const reports = await listReports().catch(() => []);
  for (const report of reports.slice(0, 6)) {
    const snapshot = await loadSnapshot(report.id).catch(() => null);
    if (!snapshot?.checkup?.organs?.length) continue;
    return {
      checkup: snapshot.checkup,
      date: shortDate(report.createdAt),
      scope: scopeName(report.scope),
      country: snapshot.country,
      source: "saved",
    };
  }

  return liveTreatmentPlan(userId);
}

/** The same read the Royalty Health Check makes, without saving or changing anything. */
async function liveTreatmentPlan(userId: string): Promise<TreatmentPlanData> {
  const [tracks, inspectorSongs, statuses, checks] = await Promise.all([
    listTracks().catch(() => []),
    listInspectorSongs().catch(() => []),
    listStatuses().catch(() => []),
    listChecks().catch(() => []),
  ]);
  const allTracks = [...tracks, ...inspectorSongs];
  const onboarding = loadOnboarding(userId);
  const country = countryByCode(onboarding?.healthCountry ?? "")
    ?? countryByCode(guessCountry(allTracks.flatMap((t) => [...t.metadata.writers, ...t.metadata.composers].map((w) => w.pro))))
    ?? countryByCode("US")!;
  const report = healthReport(allTracks, country, [...checks, ...inspectorChecks(statuses)]);

  const signedSheets = new Map<string, boolean>();
  try {
    for (const [id, list] of await listSplitSheets()) signedSheets.set(id, sheetStatus(list) === "signed");
  } catch { /* no sheets read: the report simply doesn't count them, as it does on the Hub */ }

  const account = statuses.find((x) => x.songRef === ACCOUNT_REF);
  const rows = report.rows.map((r) => {
    const status = statuses.find((x) => x.songRef === r.track.id);
    return { r, c: songChecklist(r, country, status, account), status };
  });

  return {
    checkup: royaltyCheckup({ rows, signedSheets }),
    date: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    scope: "Catalog Examination",
    country: country.name,
    source: "live",
  };
}
