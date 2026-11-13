import { albumKey } from "./release-routing";

/**
 * A release a member typed by hand in the fill dialog, because it isn't in the catalog yet (founder, 2026-11-16).
 *
 * It belongs to the account, not the browser: `fill_releases` keeps one row per account, kind and title (see
 * fill-releases.functions.ts), so a name typed here is offered again on every device. This browser keeps a copy so the dialog
 * still lists the names it knows when the network or the table isn't there yet; the account is always the real list.
 */
export type FillReleaseType = "Single" | "EP" | "Album" | "Instrumental" | "Unreleased";
export type FillRelease = { id?: string | undefined; type: FillReleaseType; name: string };

export const FILL_RELEASE_TYPES = ["Single", "EP", "Album", "Instrumental", "Unreleased"] as const;

/** The few entries the dialog offers; a long list is harder to use than a short one. */
export const MAX_FILL_RELEASES = 24;

/** One identity for a release: its kind plus its title, trimmed and case-folded, so "afterglow " and "Afterglow" are one entry. */
export const releaseKey = (release: { type: string; name: string }) => `${release.type}:${albumKey(release.name)}`;

/** Puts a release at the front of the list, replacing the entry with the same kind and title. */
export function mergeRelease(list: FillRelease[], entry: FillRelease, max = MAX_FILL_RELEASES): FillRelease[] {
  const name = entry.name.trim();
  if (!name) return list;
  const clean = { ...(entry.id ? { id: entry.id } : {}), type: entry.type, name } as FillRelease;
  const rest = list.filter((r) => releaseKey(r) !== releaseKey(clean));
  return [clean, ...rest].slice(0, max);
}

/** The releases the member's own catalog already offers, so a remembered title that has since been released isn't offered twice. */
export function withoutCatalog(releases: FillRelease[], catalog: { album: string; kind: string }[]): FillRelease[] {
  return releases.filter((r) => !catalog.some((c) => c.kind === r.type && albumKey(c.album) === albumKey(r.name)));
}

/** The copy this browser keeps, for the moments the account list can't be read. */
export function readCachedReleases(userId: string, store: Storage | undefined = safeStorage()): FillRelease[] {
  if (!userId || !store) return [];
  try {
    const raw = store.getItem(key(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFillRelease).slice(0, MAX_FILL_RELEASES);
  } catch {
    return [];
  }
}

export function cacheReleases(userId: string, list: FillRelease[], store: Storage | undefined = safeStorage()): void {
  if (!userId || !store) return;
  try {
    store.setItem(key(userId), JSON.stringify(list.slice(0, MAX_FILL_RELEASES)));
  } catch {
    // A full or blocked storage never blocks the dialog; the account still has them.
  }
}

const key = (userId: string) => `cta.fill-releases.v2.${userId}`;

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

function isFillRelease(value: unknown): value is FillRelease {
  if (!value || typeof value !== "object") return false;
  const r = value as { name?: unknown; type?: unknown; id?: unknown };
  return (
    typeof r.name === "string" &&
    !!r.name.trim() &&
    typeof r.type === "string" &&
    (FILL_RELEASE_TYPES as readonly string[]).includes(r.type) &&
    (r.id === undefined || typeof r.id === "string")
  );
}
