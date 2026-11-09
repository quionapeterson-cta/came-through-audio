import { BADGES, INSTRUMENTS, timesEarned, type BadgeDef } from "@/lib/badges";
import type { CatalogTrack } from "@/lib/catalog";
import { songHealthy, trackReport, type RepertoireCheck } from "@/lib/health";
import { creditName, isPerformer } from "@/lib/metadata";
import { releaseKind } from "@/lib/health-checklist";
import { registrationReadiness } from "@/lib/readiness";
import { countryByCode, guessCountry } from "@/lib/repertoires";
import { parentGenre } from "@/lib/metadata";
import { GUIDES } from "@/lib/guides";
import { blueprintById } from "@/lib/contract-blueprints";
import { checklistProgress, guideIdOf } from "@/lib/workbench";

/** Everything the award check needs about one user, loaded by the server (badges.functions.ts). */
export type BadgeData = {
  tracks: (CatalogTrack & { createdAt: string })[];
  /** split_sheets rows for the user's own catalog songs. */
  splits: { catalogId: string; isOwner: boolean; role: string; signedAt: string | null }[];
  contracts: { status: string; blueprint?: string; parties: { isOwner: boolean; signedAt: string | null }[] }[];
  checks: RepertoireCheck[];
  certificates: { catalogId: string | null; trackTitle: string; timestamped: boolean }[];
  events: { agency_export: number; master_download: number; blueprint_read: number };
  /** The member's own blueprint rows: one per run, with its ticks (public.workbench_items). */
  blueprints?: { itemId: string; checked: string[] }[];
  /** Songs already submitted for Expert Registration Assistance (public.registration_songs.submitted_at). */
  registrationSubmissions?: number;
  /** Paid brand kits, refunds excluded (public.purchases, kind "branding"). */
  brandKits?: number;
  /** Seats this member invited, and seats the invited artists accepted (public.artist_seats). */
  seatsInvited?: number;
  seatsAccepted?: number;
  welcomed: boolean;
  /** The user's own names (stage, legal), to find songs where they're in Produced by. */
  names: string[];
  healthCountry?: string | undefined;
  accountCreatedAt: string;
  timeZone: string;
  now: Date;
};

const RELEASE_MIN_TRACKS = 3;
/** Contract categories whose fully signed deals carry the executive badge (founder, 2026-11-06). */
export const EXECUTIVE_CATEGORIES = ["Management", "Rights & Distribution"] as const;
const isExecutive = (blueprint: string) =>
  (EXECUTIVE_CATEGORIES as readonly string[]).includes(blueprintById(blueprint)?.category ?? "");
const norm = (s: string) => s.trim().toLowerCase();
/** A subgenre counts as its main genre ("Trap" counts toward Hip-Hop badges). */
const hasGenre = (t: CatalogTrack, g: string) => parentGenre(t.metadata.primaryGenre) === g || parentGenre(t.metadata.secondaryGenre) === g;

/** Which badge instrument a performer credit counts toward, if any. Backup vocalists count as vocals. */
export function instrumentOf(c: { role: string; instrument?: string }) {
  if (c.role === "Backup vocalist") return "vocals";
  const text = c.instrument ?? "";
  return text.trim() ? INSTRUMENTS.find((i) => i.match.test(text))?.id : undefined;
}

/** Local date and hour of a moment in the user's own time zone. */
export function localTime(iso: string, timeZone: string) {
  let parts: Intl.DateTimeFormatPart[];
  try { parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso)); }
  catch { return localTime(iso, "UTC"); }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

/** Tracks grouped by album title. */
function albums(tracks: CatalogTrack[]) {
  const by = new Map<string, CatalogTrack[]>();
  for (const t of tracks) { const a = norm(t.metadata.album ?? ""); if (a) by.set(a, [...(by.get(a) ?? []), t]); }
  return [...by.values()];
}

/** Albums/EPs (by album title) with at least three tracks. */
const releases = (tracks: CatalogTrack[]) => albums(tracks).filter((list) => list.length >= RELEASE_MIN_TRACKS);

/** Projects with every track in the catalog: as many tracks as the "1 of 12" totals say (when entered). */
function fullProjects(tracks: CatalogTrack[]) {
  return albums(tracks).filter((list) => list.length >= Math.max(0, ...list.map((t) => Number(t.metadata.trackTotal) || 0)));
}
const EP_TRACKS = [4, 6], ALBUM_TRACKS = 7;

/** Every count the badges unlock on. Uses the shared readiness and health modules, never its own versions of them. */
export function badgeMetrics(d: BadgeData): Record<string, number> {
  const ready = new Set(d.tracks.filter((t) => registrationReadiness(t.metadata).ready).map((t) => t.id));
  const own = new Set(d.tracks.map((t) => t.id));

  const sheets = new Map<string, BadgeData["splits"]>();
  for (const r of d.splits) if (own.has(r.catalogId)) sheets.set(r.catalogId, [...(sheets.get(r.catalogId) ?? []), r]);
  const signedSheets = [...sheets.entries()].filter(([, rows]) => rows.length > 0 && rows.every((r) => r.signedAt));
  const signedSheetIds = new Set(signedSheets.map(([id]) => id));
  const collaborators = (rows: BadgeData["splits"]) => rows.filter((r) => r.role !== "Publisher").length;

  const signedContracts = d.contracts.filter((c) => c.status === "signed").length;
  const signedExecutive = d.contracts.filter((c) => c.status === "signed" && isExecutive(c.blueprint ?? "")).length;
  const collaboratorSigned = [...sheets.values()].some((rows) => rows.some((r) => !r.isOwner && r.signedAt))
    || d.contracts.some((c) => c.parties.some((p) => !p.isOwner && p.signedAt));

  const certified = new Set(d.certificates.map((c) => c.catalogId).filter((id): id is string => !!id));
  const protectedSongs = new Set(d.certificates.map((c) => c.catalogId ?? `title:${norm(c.trackTitle)}`)).size;

  const pros = d.tracks.flatMap((t) => [...t.metadata.writers, ...t.metadata.composers].map((w) => w.pro));
  const country = countryByCode(d.healthCountry ?? guessCountry(pros)) ?? countryByCode("US")!;
  const healthy = d.tracks.filter((t) => songHealthy(trackReport(t, country, d.checks))).length;

  const names = new Set(d.names.map(norm).filter(Boolean));
  const produced = d.tracks.filter((t) => t.metadata.producers.some((p) => names.has(norm(creditName(p) || p.name || "")))).length;

  const credits = d.tracks.flatMap((t) => t.metadata.credits.filter((c) => c.name.trim() && isPerformer(c.role)));
  const instruments: Record<string, number> = {};
  for (const c of credits) { const id = instrumentOf(c); if (id) instruments[`instrument:${id}`] = (instruments[`instrument:${id}`] ?? 0) + 1; }

  const evenings = new Map<string, number>();
  const midnights = new Set<string>(), mornings = new Set<string>();
  for (const t of d.tracks) {
    const { date, hour } = localTime(t.createdAt, d.timeZone);
    if (hour >= 21) evenings.set(date, (evenings.get(date) ?? 0) + 1);
    if (hour < 4) midnights.add(date);
    else if (hour < 6) mornings.add(date);
  }
  const checkMonths = new Set(d.checks.map((c) => localTime(c.checkedAt, d.timeZone).date.slice(0, 7)));

  // Signatures from anyone else on the user's own split sheets and contracts.
  const signatures = [...sheets.values()].flat().filter((r) => !r.isOwner && r.signedAt).length
    + d.contracts.flatMap((c) => c.parties).filter((p) => !p.isOwner && p.signedAt).length;

  // Cover art by release kind, and the milestones above them (founder, 2026-11-09). The art's pixel size is saved with the
  // song when it is chosen, so the 3000×3000 rule reads a real number instead of guessing from the file.
  const withArt = d.tracks.filter((t) => t.metadata.artPath);
  const kindOf = (t: CatalogTrack) => releaseKind(t.metadata);
  const singleArt = withArt.filter((t) => kindOf(t) === "Single").length;
  const epArt = withArt.filter((t) => kindOf(t) === "EP").length;
  const albumArt = withArt.filter((t) => kindOf(t) === "Album").length;
  const coverStarSteps = Math.floor(singleArt / 12) + Math.floor(epArt / 3);
  const at3000 = (t: CatalogTrack) => t.metadata.artWidth >= 3000 && t.metadata.artHeight >= 3000;
  const bigAlbums = albums(d.tracks).filter((list) => list.length >= 20 && list.some((t) => t.metadata.artPath)).length;
  const hiResCovers = albums(d.tracks).filter((list) => list.some((t) => t.metadata.artPath && at3000(t))
    && (kindOf(list[0]!) === "EP" || kindOf(list[0]!) === "Album")).length;
  // Platinum Press: a release that was saved while unreleased, now off unreleased, with a 3000×3000 cover and a date ahead.
  const today = d.now.toISOString().slice(0, 10);
  const platinumPress = albums(d.tracks).filter((list) => kindOf(list[0]!) === "Album"
    && list.some((t) => t.metadata.wasUnreleased) && list.some((t) => !t.metadata.unreleased && !!t.metadata.releaseDate && t.metadata.releaseDate >= today)
    && list.some((t) => t.metadata.artPath && at3000(t))).length;

  const full = fullProjects(d.tracks);
  const isWav = (t: CatalogTrack) => /\.wav$/i.test(t.metadata.audioPath);
  const wavAlbums = full.filter((list) => list.length >= ALBUM_TRACKS && list.every(isWav)).length;
  const selfProduced = d.tracks.filter((t) => ready.has(t.id) && t.metadata.artist.trim()
    && t.metadata.producers.some((p) => norm(creditName(p) || p.name || "") === norm(t.metadata.artist))).length;

  const hiphop = d.tracks.filter((t) => hasGenre(t, "Hip-Hop/Rap"));
  const years = Math.floor((d.now.getTime() - new Date(d.accountCreatedAt).getTime()) / (365.25 * 24 * 3600 * 1000));
  const allReady = (list: CatalogTrack[]) => list.every((t) => ready.has(t.id));

  // The two profile defaults, finished: the same rule the rocket sky uses, read from the saved runs (founder, 2026-11-08).
  const finishedGuides = new Set((d.blueprints ?? []).filter((r) => {
    const guide = GUIDES.find((g) => g.id === guideIdOf(r.itemId));
    return !!guide?.checklist?.length && checklistProgress(guide.checklist, r.checked).finished;
  }).map((r) => guideIdOf(r.itemId)));
  const defaultsBoth = finishedGuides.has("embed-defaults") && finishedGuides.has("catalog-defaults");
  // A finished song entry: its master and its cover art are in, and it's Registration Ready (founder, 2026-11-08).
  const fullEntries = d.tracks.filter((t) => ready.has(t.id) && !!t.metadata.audioPath && !!t.metadata.artPath).length;

  return {
    welcomed: d.welcomed ? 1 : 0,
    songs: d.tracks.length,
    ready: ready.size,
    masters: d.tracks.filter((t) => t.metadata.audioPath).length,
    artUploads: d.tracks.filter((t) => t.metadata.artPath).length,
    singleArt, epArt, albumArt, coverStarSteps, bigAlbums, hiResCovers, platinumPress,
    lyrics: d.tracks.filter((t) => t.metadata.lyrics.trim()).length,
    vocalSongs: d.tracks.filter((t) => t.metadata.credits.some((c) => c.name.trim() && isPerformer(c.role) && instrumentOf(c) === "vocals")).length,
    fullBandSongs: d.tracks.filter((t) => t.metadata.credits.filter((c) => c.name.trim() && isPerformer(c.role)).length >= 3).length,
    collaboratorSigned: collaboratorSigned ? 1 : 0,
    timestamped: d.certificates.filter((c) => c.timestamped).length,
    protected: protectedSongs,
    agencyExports: d.events.agency_export,
    masterDownloads: d.events.master_download,
    masterCrowns: (d.events.master_download > 0 ? 1 : 0) + wavAlbums,
    fullEps: full.filter((list) => list.length >= EP_TRACKS[0]! && list.length <= EP_TRACKS[1]!).length,
    fullAlbums: full.filter((list) => list.length >= ALBUM_TRACKS).length,
    blueprintReads: d.events.blueprint_read,
    // One earning per finished run: a blueprint started again is a new row, so it counts again (founder, 2026-11-06).
    blueprintsChecked: (d.blueprints ?? []).filter((r) => {
      const guide = GUIDES.find((g) => g.id === guideIdOf(r.itemId));
      return !!guide?.checklist?.length && checklistProgress(guide.checklist, r.checked).finished;
    }).length,
    contractsSignedExecutive: signedExecutive,
    healthChecks: d.checks.length,
    healthCheckMonths: checkMonths.size,
    chainOfTitle: d.tracks.filter((t) => {
      const r = registrationReadiness(t.metadata);
      return r.ready && !r.warnings.length && signedSheetIds.has(t.id) && certified.has(t.id);
    }).length,
    readyReleases: releases(d.tracks).filter(allReady).length,
    catalogComplete: d.tracks.length >= 10 && allReady(d.tracks) ? 1 : 0,
    memberYears: Math.max(0, years),
    healthy,
    marathonNights: [...evenings.values()].filter((n) => n >= 5).length,
    midnightNights: midnights.size,
    quietMornings: mornings.size,
    splitsCreated: sheets.size,
    splitsSigned: signedSheets.length,
    signedSplits3: signedSheets.filter(([, rows]) => collaborators(rows) >= 3).length,
    signedSplits4: signedSheets.filter(([, rows]) => collaborators(rows) >= 4).length,
    registrationSubmissions: d.registrationSubmissions ?? 0,
    protectionTrophies: (defaultsBoth ? 1 : 0) + fullEntries,
    brandKits: d.brandKits ?? 0,
    seatKeys: (d.seatsInvited ?? 0) + (d.seatsAccepted ?? 0),
    healthyReports: d.tracks.length > 0 && healthy === d.tracks.length ? checkMonths.size : 0,
    contractsDrafted: d.contracts.length,
    contractsSent: d.contracts.filter((c) => c.status === "sent" || c.status === "signed").length,
    contractsSigned: signedContracts,
    deals: signedSheets.length + signedContracts,
    signaturesReceived: signatures,
    produced,
    selfProduced,
    performerCredits: credits.length,
    ...instruments,
    hiphop: hiphop.length,
    hiphopSigned: hiphop.filter((t) => signedSheetIds.has(t.id)).length,
    hiphopReleases: releases(hiphop).filter(allReady).length,
    spiritual: d.tracks.filter((t) => hasGenre(t, "Spiritual Hip-Hop")).length,
  };
}

export type BadgeStatus = { badge: BadgeDef; count: number; earned: boolean; times: number };

/** Each live badge's progress. Repeating badges count every step passed (see timesEarned). */
export function evaluateBadges(metrics: Record<string, number>, disabled: ReadonlySet<string> = new Set()): BadgeStatus[] {
  return BADGES.filter((b) => !disabled.has(b.id)).map((badge) => {
    const count = metrics[badge.metric] ?? 0;
    const times = timesEarned(badge, count);
    return { badge, count, earned: times > 0, times };
  });
}
