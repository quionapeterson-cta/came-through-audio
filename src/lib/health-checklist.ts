import type { Pillar } from "@/lib/audit";
import { pillarLabel, type TrackReport } from "@/lib/health";
import { isInspectorSong, type SongStatus } from "@/lib/health-songs";
import { creditName, type Metadata } from "@/lib/metadata";
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
  /** Registered (or found) before the song's details changed: the registration needs updating to match. */
  update?: boolean;
};
export type SongChecklist = { steps: ChecklistStep[]; done: number; total: number; pct: number; group: "attention" | "later" | "healthy" };

export const STAGE_LABEL: Record<Stage, string> = { details: "Fix the song details", register: "Register it", confirm: "Confirm it shows up" };

/** What each society's search finds a song by most exactly, and the value to copy. Missing values point at their field. */
export type SearchKey = { by: string; value: string; field?: string; hint: string };
export function searchKey(society: Society, m: Metadata): SearchKey {
  if (society.searchBy === "isrc") return { by: "ISRC", value: m.isrc.trim(), field: "isrc", hint: `Search ${society.name} by ISRC. It's the most exact match.` };
  if (society.searchBy === "writer") {
    const writer = [...m.writers, ...m.composers].map(creditName).find(Boolean) ?? "";
    return { by: "writer name", value: writer, field: "writers-0-legalName", hint: `Search ${society.name} by writer name, then find the song in that writer's list.` };
  }
  return { by: "title", value: m.title.trim(), field: "title", hint: `Search ${society.name} by the exact title.` };
}

/** A short fingerprint of the details a society registration holds, so a later edit to them can be noticed. */
export function registrationPrint(m: Metadata, pillar: Pillar): string {
  const people = (rows: Metadata["writers"]) => rows.map((r) => [creditName(r), r.role ?? "", r.percentage, r.pro, r.ipi].join("~")).filter((x) => x.replace(/~/g, ""));
  const parts = pillar === "digital"
    ? [m.title, m.artist, m.isrc, ...m.featured]
    : [m.title, ...people(m.writers), ...people(m.composers), ...people(m.publishers)];
  let h = 5381;
  for (const ch of parts.map((x) => x.trim().toLowerCase()).join("|")) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
}
export const printKey = (societyId: string) => `print:${societyId}`;

/** The society a pillar's steps point at: the one already marked, otherwise the first (writers join one PRO). */
const societyOf = (p: TrackReport["pillars"][number]) => (p.societies.find((s) => s.check) ?? p.societies[0])?.society;

export function songChecklist(r: TrackReport, country: Country, status?: SongStatus): SongChecklist {
  const m = r.track.metadata;
  const ticked = status?.steps ?? {};
  const readiness = registrationReadiness(m);
  const needsPro = r.issues.some((i) => i.field?.endsWith("-pro"));
  const steps: ChecklistStep[] = [];

  steps.push({ id: "writers", stage: "details", auto: true, done: readiness.ready, title: "Add every writer's legal name, role and split",
    field: readiness.missing[0]?.field ?? "writers-0-legalName", items: readiness.missing.map((x) => ({ text: x.message, field: x.field })) });
  // Other flagged details (PRO, IPI, publisher…), minus what the writer and ISRC/ISWC steps already cover (writer and publisher splits included).
  const other = [
    ...r.issues.filter((i) => i.field !== "isrc" && i.field !== "iswc" && i.field !== "writers-0-share" && i.field !== "publishers-0-share" && i.text !== "No songwriters listed").map((i) => ({ text: i.text, field: i.field })),
    ...r.findings.filter((f) => f.level === "warn").map((f) => ({ text: f.text, field: f.field === "writers" ? "writers-0-legalName" : f.field })),
  ];
  if (other.length) steps.push({ id: "details", stage: "details", auto: true, done: false, title: "Fix the flagged song details", items: other, field: other[0]?.field });
  steps.push({ id: "isrc", stage: "details", auto: true, done: !!m.isrc.trim(), title: "Add the recording's ISRC", field: "isrc" });

  for (const p of r.pillars) {
    const society = societyOf(p);
    if (!society || (p.pillar === "performance" && needsPro)) continue;
    const found = p.state === "confirmed";
    const registered = found || !!ticked[`registered:${society.id}`];
    const saved = ticked[printKey(society.id)];
    const update = registered && !!saved && saved !== registrationPrint(m, p.pillar);
    steps.push({ id: `register:${p.pillar}`, stage: "register", auto: false, pillar: p.pillar, society, update,
      done: registered && !update, title: update ? `Update your registration at ${society.name}` : `Register with ${society.name} for ${pillarLabel(p.pillar, country).toLowerCase()}` });
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

/** The song list's release groups: catalog albums, then Singles (no album), then Royalty Inspector songs. */
export type SongSort = "least" | "az" | "recent";
export type ReleaseGroup<T> = { key: string; name: string; type: string; songs: T[]; pct: number; updatedAt: string };
type Listed = { r: TrackReport; c: SongChecklist };

export function releaseGroups<T extends Listed>(songs: T[], sort: SongSort, query = ""): ReleaseGroup<T>[] {
  const q = query.trim().toLowerCase();
  const hit = ({ r }: T) => !q || [r.track.title, r.track.artist, r.track.metadata.album].some((v) => v?.toLowerCase().includes(q));
  const groups = new Map<string, ReleaseGroup<T>>();
  for (const x of songs.filter(hit)) {
    const m = x.r.track.metadata;
    const inspector = isInspectorSong(x.r.track.id);
    const album = m.album.trim();
    const key = inspector ? "~inspector" : album ? `album:${album.toLowerCase()}` : "~singles";
    const g = groups.get(key) ?? { key, name: inspector ? "Royalty Inspector songs" : album || "Singles", type: inspector || !album ? "" : m.releaseType, songs: [], pct: 0, updatedAt: "" };
    g.songs.push(x);
    if (x.r.track.updatedAt > g.updatedAt) g.updatedAt = x.r.track.updatedAt;
    groups.set(key, g);
  }
  const trackNo = (x: Listed) => Number(x.r.track.metadata.trackNumber) || 999;
  const list = [...groups.values()].map((g) => ({
    ...g,
    songs: g.songs.sort((a, b) => trackNo(a) - trackNo(b) || a.r.track.title.localeCompare(b.r.track.title)),
    pct: Math.round(g.songs.reduce((n, x) => n + x.c.pct, 0) / g.songs.length),
  }));
  // Albums are sorted; Singles and Royalty Inspector songs always come after them.
  const rank = (g: ReleaseGroup<T>) => (g.key === "~inspector" ? 2 : g.key === "~singles" ? 1 : 0);
  const by = sort === "az" ? (a: ReleaseGroup<T>, b: ReleaseGroup<T>) => a.name.localeCompare(b.name)
    : sort === "recent" ? (a: ReleaseGroup<T>, b: ReleaseGroup<T>) => b.updatedAt.localeCompare(a.updatedAt)
    : (a: ReleaseGroup<T>, b: ReleaseGroup<T>) => a.pct - b.pct;
  return list.sort((a, b) => rank(a) - rank(b) || by(a, b));
}
