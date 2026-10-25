import type { Pillar } from "@/lib/audit";
import { isUnreleased, releaseItems, releasePct } from "@/lib/release-checklist";
import { pillarLabel, trackReport, type RepertoireCheck, type TrackReport } from "@/lib/health";
import type { CatalogTrack } from "@/lib/catalog";
import { isInspectorSong, type SongStatus } from "@/lib/health-songs";
import { creditName, type Metadata } from "@/lib/metadata";
import { registrationCheck, registrationReadiness, type RegistrationAgency } from "@/lib/readiness";
import type { Country, Society } from "@/lib/repertoires";

/**
 * Every song's Health Checklist: get it ready to register, register it, then confirm it shows up.
 * Readiness steps tick themselves from the catalog (the shared registrationCheck, one per agency) and make up the %;
 * register and confirm steps are ticked by the user.
 */
export type Stage = "release" | "details" | "register" | "confirm";
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
  items?: { text: string; field?: string | undefined }[] | undefined;
  /** Registered (or found) before the song's details changed: the registration needs updating to match. */
  update?: boolean;
  /** Release checklist: a tick the person sets, saved under this checklist key. */
  tick?: string | undefined;
  /** Not counted in the % (optional, or waiting for the release date). */
  optional?: boolean | undefined;
  /** Plain-language reason, shown under release items. */
  why?: string | undefined;
};
/**
 * `pct` is registration readiness: the share of agencies the catalog has everything for. Registering and confirming
 * are still steps the user ticks (`registered`, `done`), but they don't move the %; "healthy" means every step is done.
 */
export type SongChecklist = { steps: ChecklistStep[]; done: number; total: number; pct: number; registered: { done: number; total: number }; group: "attention" | "later" | "healthy";
  /** Not released yet: `pct` is how ready it is to distribute (Release checklist + PRO/MLC registration), not registration readiness. */
  prerelease: boolean };

/** Account-wide checklist state lives in its own health_song_status row, under this song_ref (it's not a song). */
export const ACCOUNT_REF = "account";
/** Set once per account: international airplay collection through SoundExchange or PPL. */
export const INTL_KEY = "intl:setup";

export const STAGE_LABEL: Record<Stage, string> = { release: "Getting ready to release", details: "Ready to register", register: "Register it", confirm: "Confirm it shows up" };

/** What each society's search finds a song by most exactly, and the value to copy. Missing values point at their field. */
/** `also` is a second detail to search with (BMI: the performer next to the title). */
export type SearchKey = { by: string; value: string; field?: string; hint: string; also?: { by: string; value: string; field: string } };
export function searchKey(society: Society, m: Metadata): SearchKey {
  if (society.searchBy === "isrc") return { by: "ISRC", value: m.isrc.trim(), field: "isrc", hint: society.id === "soundexchange"
    ? "Search SoundExchange's public ISRC database by your ISRC (or by artist and title). It's the most exact match."
    : `Search ${society.name} by ISRC. It's the most exact match.` };
  if (society.searchBy === "title-performer") return { by: "title", value: m.title.trim(), field: "title", also: { by: "performer", value: m.artist.trim(), field: "artist" },
    hint: `Search ${society.name} by the song title, then pick the result with your artist name as the performer.` };
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

/** The agencies our registration check knows; other societies fall back to the core readiness rules. */
const AGENCIES: RegistrationAgency[] = ["bmi", "ascap", "mlc", "soundexchange"];

/**
 * Is the song ready to register with this society? Uses the shared registrationCheck (never re-implemented here),
 * so the items listed are exactly what our team would ask for before registering.
 */
function readyFor(m: Metadata, society: Society, pillar: Pillar): { text: string; field?: string }[] {
  const agency = AGENCIES.find((a) => a === society.id);
  if (agency) return registrationCheck(m, agency).missing.map((x) => ({ text: x.message, field: x.field }));
  if (pillar === "digital") return m.isrc.trim() ? [] : [{ text: "Add the recording's ISRC.", field: "isrc" }];
  const core = registrationReadiness(m, pillar === "mechanical" ? "mlc" : "pro");
  return [...core.missing, ...core.warnings].map((x) => ({ text: x.message, field: x.field }));
}

export function songChecklist(r: TrackReport, country: Country, status?: SongStatus, account?: SongStatus): SongChecklist {
  const m = r.track.metadata;
  const ticked = status?.steps ?? {};
  const needsPro = r.issues.some((i) => i.field?.endsWith("-pro"));
  const steps: ChecklistStep[] = [];
  // Not out yet: what to have ready before distributing comes first, and recordings wait for the release date.
  const prerelease = isUnreleased(m);
  if (prerelease) {
    for (const i of releaseItems(m, ticked)) steps.push({ id: `release:${i.id}`, stage: "release", auto: i.auto, done: i.done, title: i.title, field: i.field, items: i.items, tick: i.tick, optional: i.optional, why: i.why });
  }

  // Ready to register: one step per agency, ticked by the catalog itself. These alone make up the song's %.
  for (const p of r.pillars) {
    const society = societyOf(p);
    if (!society) continue;
    const items = readyFor(m, society, p.pillar);
    const name = p.pillar === "performance" && needsPro ? "your PRO" : society.name;
    steps.push({ id: `ready:${p.pillar}`, stage: "details", auto: true, pillar: p.pillar, society, done: !items.length,
      title: `Ready to register with ${name}`, items, field: items[0]?.field });
  }

  for (const p of r.pillars) {
    const society = societyOf(p);
    if (!society || (p.pillar === "performance" && needsPro)) continue;
    // SoundExchange registers recordings once they're out: shown as waiting, never counted against an unreleased song.
    if (prerelease && p.pillar === "digital") {
      steps.push({ id: `register:${p.pillar}`, stage: "register", auto: true, pillar: p.pillar, society, optional: true, done: false,
        title: `Register with ${society.name} after release${m.releaseDate ? ` (${m.releaseDate})` : ""}` });
      continue;
    }
    const found = p.state === "confirmed";
    const registered = found || !!ticked[`registered:${society.id}`];
    const saved = ticked[printKey(society.id)];
    const update = registered && !!saved && saved !== registrationPrint(m, p.pillar);
    steps.push({ id: `register:${p.pillar}`, stage: "register", auto: false, pillar: p.pillar, society, update,
      done: registered && !update, title: update ? `Update your registration at ${society.name}` : `Register with ${society.name} for ${pillarLabel(p.pillar, country).toLowerCase()}` });
    steps.push({ id: `confirm:${p.pillar}`, stage: "confirm", auto: false, pillar: p.pillar, society,
      done: found, title: `Confirm it shows up in ${society.name}` });
  }
  // US radio doesn't pay recordings, so US artists collect airplay abroad through SoundExchange or PPL. One setting per account.
  if (country.code === "US")
    steps.push({ id: "intl", stage: "register", auto: false, done: !!account?.steps[INTL_KEY], title: "Collect international airplay (neighbouring rights)" });
  // Live records that disagree with the catalog (e.g. a different ISRC on streaming) are checked after registering.
  const findings = r.findings.filter((f) => f.level === "warn").map((f) => ({ text: f.text, field: f.field === "writers" ? "writers-0-legalName" : f.field }));
  if (findings.length) steps.push({ id: "details", stage: "confirm", auto: true, done: false, title: "Match what the live records show", items: findings, field: findings[0]?.field });
  if (r.pillars.some((p) => p.pillar === "performance" || p.pillar === "mechanical"))
    steps.push({ id: "iswc", stage: "confirm", auto: true, done: !!m.iswc.trim(), title: "Add the ISWC once it's assigned", field: "iswc" });

  const counted = steps.filter((s) => !s.optional);
  const ready = steps.filter((s) => s.stage === "details");
  const reg = counted.filter((s) => s.stage === "register");
  const done = counted.filter((s) => s.done).length;
  // Unreleased: ready to distribute = the release items plus registering with the PRO and mechanical society.
  const pct = prerelease ? releasePct([...steps.filter((s) => s.stage === "release"), ...reg.filter((s) => s.id !== "intl")])
    : ready.length ? Math.round((ready.filter((s) => s.done).length / ready.length) * 100) : 0;
  const group = done === counted.length ? "healthy" : status?.list === "later" ? "later" : "attention";
  return { steps, done, total: counted.length, pct, registered: { done: reg.filter((s) => s.done).length, total: reg.length }, group, prerelease };
}

/**
 * The My Catalog health meter: how ready each song is to register (the same readiness steps the Royalty Health Hub
 * ticks) and their average, how many registrations are ticked off, and the first missing field so "Fix next" can jump to it.
 */
export function catalogHealth(tracks: CatalogTrack[], country: Country, checks: RepertoireCheck[], statuses: SongStatus[]) {
  const statusOf = (id: string) => statuses.find((s) => s.songRef === id);
  const account = statusOf(ACCOUNT_REF);
  const songs = tracks.map((track) => {
    const c = songChecklist(trackReport(track, country, checks), country, statusOf(track.id), account);
    return { track, pct: c.pct, prerelease: c.prerelease, registered: c.registered, field: c.steps.find((s) => (s.stage === "details" || s.stage === "release") && !s.done && s.field)?.field };
  });
  // Unreleased songs get their own "getting ready" line and stay out of the score until release (founder, 2026-10-25).
  const out = songs.filter((s) => !s.prerelease);
  const upcoming = songs.filter((s) => s.prerelease);
  const avg = (list: typeof songs) => (list.length ? Math.round(list.reduce((sum, s) => sum + s.pct, 0) / list.length) : 0);
  const pct = avg(out);
  const next = out.filter((s) => s.pct < 100).sort((a, b) => a.pct - b.pct)[0] ?? upcoming.filter((s) => s.pct < 100).sort((a, b) => a.pct - b.pct)[0];
  const registered = out.reduce((n, s) => ({ done: n.done + s.registered.done, total: n.total + s.registered.total }), { done: 0, total: 0 });
  return { songs, pct, ready: out.filter((s) => s.pct === 100).length, released: out.length, registered, next, prerelease: { count: upcoming.length, pct: avg(upcoming) } };
}

/** A warm, honest line for where the song is. */
export function encouragement(c: SongChecklist): string {
  if (c.prerelease) {
    if (c.pct === 100) return "Ready to distribute. Everything that can happen before release is done; SoundExchange comes after release day.";
    return `${c.pct}% ready to distribute. Get these done before release so the money can find you from day one.`;
  }
  if (c.group === "healthy") return "Ready, registered and confirmed. This song is set up to get paid. Nice work.";
  if (c.pct === 100) {
    const left = c.registered.total - c.registered.done;
    return left ? `Ready to register everywhere. ${left} registration${left === 1 ? "" : "s"} left to do.` : "Ready and registered. Confirm it shows up to finish.";
  }
  if (c.pct === 0) return "A few details to add before it's ready to register. Take them one at a time; nothing here is urgent.";
  if (c.pct >= 50) return `${c.pct}% ready to register. More than halfway, keep going.`;
  return `${c.pct}% ready to register. Every detail you add makes it easier to get paid.`;
}

/** A song's release type, shared by My Catalog and the Health Hub: EP, Album (incl. Compilation), else Single. */
export function releaseKind(m: Pick<Metadata, "releaseType">): "Single" | "EP" | "Album" {
  const r = m.releaseType;
  return r === "EP" ? "EP" : r === "Album" || r === "Compilation" ? "Album" : "Single";
}

/** The song list's release groups: each album and EP, then every single in one Singles group, then Royalty Inspector songs. */
export type SongSort = "least" | "az" | "recent";
export type ReleaseGroup<T> = { key: string; name: string; type: string; songs: T[]; pct: number; updatedAt: string };
type Listed = { r: TrackReport; c: SongChecklist };

export const SINGLES_KEY = "~singles";

export function releaseGroups<T extends Listed>(songs: T[], sort: SongSort, query = ""): ReleaseGroup<T>[] {
  const q = query.trim().toLowerCase();
  const hit = ({ r }: T) => !q || [r.track.title, r.track.artist, r.track.metadata.album].some((v) => v?.toLowerCase().includes(q));
  const groups = new Map<string, ReleaseGroup<T>>();
  for (const x of songs.filter(hit)) {
    const m = x.r.track.metadata;
    const inspector = isInspectorSong(x.r.track.id);
    const album = m.album.trim();
    const kind = releaseKind(m);
    const project = !inspector && kind !== "Single";
    const key = inspector ? "~inspector" : project ? `${kind}:${(album || "Untitled " + kind).toLowerCase()}` : SINGLES_KEY;
    const g = groups.get(key) ?? { key, name: inspector ? "Royalty Inspector songs" : project ? album || `Untitled ${kind}` : "Singles", type: project ? kind : "", songs: [], pct: 0, updatedAt: "" };
    g.songs.push(x);
    if (x.r.track.updatedAt > g.updatedAt) g.updatedAt = x.r.track.updatedAt;
    groups.set(key, g);
  }
  const trackNo = (x: Listed) => Number(x.r.track.metadata.trackNumber) || 999;
  const title = (a: Listed, b: Listed) => a.r.track.title.localeCompare(b.r.track.title);
  // Albums and EPs keep track order; Singles have none, so they follow the chosen sort.
  const inGroup = (key: string) => key.startsWith("~")
    ? sort === "least" ? (a: Listed, b: Listed) => a.c.pct - b.c.pct || title(a, b)
      : sort === "recent" ? (a: Listed, b: Listed) => b.r.track.updatedAt.localeCompare(a.r.track.updatedAt) || title(a, b)
      : title
    : (a: Listed, b: Listed) => trackNo(a) - trackNo(b) || title(a, b);
  const list = [...groups.values()].map((g) => ({
    ...g,
    songs: g.songs.sort(inGroup(g.key)),
    pct: Math.round(g.songs.reduce((n, x) => n + x.c.pct, 0) / g.songs.length),
  }));
  // Albums and EPs are sorted; Singles and Royalty Inspector songs always come after them.
  const rank = (g: ReleaseGroup<T>) => (g.key === "~inspector" ? 2 : g.key === SINGLES_KEY ? 1 : 0);
  const by = sort === "az" ? (a: ReleaseGroup<T>, b: ReleaseGroup<T>) => a.name.localeCompare(b.name)
    : sort === "recent" ? (a: ReleaseGroup<T>, b: ReleaseGroup<T>) => b.updatedAt.localeCompare(a.updatedAt)
    : (a: ReleaseGroup<T>, b: ReleaseGroup<T>) => a.pct - b.pct;
  return list.sort((a, b) => rank(a) - rank(b) || by(a, b));
}
