import type { Pillar } from "@/lib/audit";
import { pillarLabel, type TrackReport } from "@/lib/health";
import type { SongStatus } from "@/lib/health-songs";
import { registrationReadiness } from "@/lib/readiness";
import type { Country, Society } from "@/lib/repertoires";

/**
 * Every song's Health Checklist: fix the song details, register it, then confirm it shows up.
 * Detail steps tick themselves from the song's data (writer readiness comes from the shared readiness module);
 * register and confirm steps are ticked by the user. 100% means every step is done.
 */
export type Stage = "details" | "register" | "confirm";
export type ChecklistStep = {
  id: string;
  stage: Stage;
  title: string;
  done: boolean;
  /** Ticks itself from the song's data, so there's no checkbox. */
  auto: boolean;
  pillar?: Pillar;
  society?: Society;
  /** Field to jump to when the fix lives in the song's details. */
  field?: string | undefined;
  /** Flagged details to fix, listed under the step. */
  items?: { text: string; field?: string | undefined }[];
};
export type SongChecklist = { steps: ChecklistStep[]; done: number; total: number; pct: number; group: "attention" | "later" | "healthy" };

export const STAGE_LABEL: Record<Stage, string> = { details: "Fix the song details", register: "Register it", confirm: "Confirm it shows up" };

/** The society a pillar's steps point at: the one already marked, otherwise the first (writers join one PRO). */
const societyOf = (p: TrackReport["pillars"][number]) => (p.societies.find((s) => s.check) ?? p.societies[0])?.society;

export function songChecklist(r: TrackReport, country: Country, status?: SongStatus): SongChecklist {
  const m = r.track.metadata;
  const ticked = status?.steps ?? {};
  const readiness = registrationReadiness(m);
  const needsPro = r.issues.some((i) => i.field?.endsWith("-pro"));
  const steps: ChecklistStep[] = [];

  steps.push({ id: "writers", stage: "details", auto: true, done: readiness.ready, title: "Add every writer's legal name and role",
    field: readiness.missing[0]?.field ?? "writers-0-legalName", items: readiness.missing.map((x) => ({ text: x.message, field: x.field })) });
  // Other flagged details (PRO, IPI, splits, publisher…), minus what the writer and ISRC/ISWC steps already cover.
  const other = [
    ...r.issues.filter((i) => i.field !== "isrc" && i.field !== "iswc" && i.text !== "No songwriters listed").map((i) => ({ text: i.text, field: i.field })),
    ...r.findings.filter((f) => f.level === "warn").map((f) => ({ text: f.text, field: f.field === "writers" ? "writers-0-legalName" : f.field })),
  ];
  if (other.length) steps.push({ id: "details", stage: "details", auto: true, done: false, title: "Fix the flagged song details", items: other, field: other[0]?.field });
  steps.push({ id: "isrc", stage: "details", auto: true, done: !!m.isrc.trim(), title: "Add the recording's ISRC", field: "isrc" });

  for (const p of r.pillars) {
    const society = societyOf(p);
    if (!society || (p.pillar === "performance" && needsPro)) continue;
    const found = p.state === "confirmed";
    steps.push({ id: `register:${p.pillar}`, stage: "register", auto: false, pillar: p.pillar, society,
      done: found || !!ticked[`registered:${society.id}`], title: `Register with ${society.name} for ${pillarLabel(p.pillar, country).toLowerCase()}` });
    steps.push({ id: `confirm:${p.pillar}`, stage: "confirm", auto: false, pillar: p.pillar, society,
      done: found, title: `Confirm it shows up in ${society.name}` });
  }
  if (r.pillars.some((p) => p.pillar === "performance" || p.pillar === "mechanical"))
    steps.push({ id: "iswc", stage: "confirm", auto: true, done: !!m.iswc.trim(), title: "Add the ISWC once it's assigned", field: "iswc" });

  const done = steps.filter((s) => s.done).length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  const group = pct === 100 ? "healthy" : status?.list === "later" ? "later" : "attention";
  return { steps, done, total: steps.length, pct, group };
}

/** A warm, honest line for where the song is. */
export function encouragement(c: SongChecklist): string {
  if (c.pct === 100) return "100% healthy. This song is set up to get paid. Nice work.";
  const left = c.total - c.done;
  if (c.done === 0) return `${c.total} simple steps to go. Take them one at a time; nothing here is urgent.`;
  if (left === 1) return "One step left. You're almost there.";
  if (c.pct >= 50) return `You're ${c.done} of ${c.total} steps in. More than halfway, keep going.`;
  return `You're ${c.done} of ${c.total} steps in. Every step you finish makes it easier to get paid.`;
}
