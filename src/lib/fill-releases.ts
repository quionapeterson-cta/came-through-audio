import { albumKey } from "./release-routing";

/**
 * A release a member typed by hand in the fill dialog, because it isn't in the catalog yet (founder, 2026-11-16). It is
 * remembered per account in this browser, so the next song — or the same list next month — can pick it in one click instead of
 * typing the title again.
 */
export type FillRelease = { type: "Single" | "EP" | "Album" | "Instrumental"; name: string };

export const FILL_RELEASE_TYPES = ["Single", "EP", "Album", "Instrumental"] as const;

/** The releases this account has typed before, newest first. A browser that blocks storage just has none. */
export function readFillReleases(userId: string, store: Storage | undefined = safeStorage()): FillRelease[] {
  if (!userId || !store) return [];
  try {
    const raw = store.getItem(key(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFillRelease).slice(0, MAX);
  } catch {
    return [];
  }
}

/**
 * Remembers one typed release and hands back the whole list: an existing entry with the same type and name (however it was
 * capitalised or spaced) is replaced in place, so the same title can't pile up twice, and the list is trimmed to the last few.
 */
export function rememberFillRelease(userId: string, entry: FillRelease, store: Storage | undefined = safeStorage()): FillRelease[] {
  const clean = { type: entry.type, name: entry.name.trim() } as FillRelease;
  if (!userId || !clean.name) return readFillReleases(userId, store);
  const rest = readFillReleases(userId, store).filter((r) => !(r.type === clean.type && albumKey(r.name) === albumKey(clean.name)));
  const next = [clean, ...rest].slice(0, MAX);
  if (store) {
    try {
      store.setItem(key(userId), JSON.stringify(next));
    } catch {
      // A full or blocked storage never blocks the dialog; the entry just isn't offered next time.
    }
  }
  return next;
}

/** The releases the member's own catalog already offers, so a remembered title that has since been released isn't offered twice. */
export function withoutCatalog(releases: FillRelease[], catalog: { album: string; kind: string }[]): FillRelease[] {
  return releases.filter((r) => !catalog.some((c) => c.kind === r.type && albumKey(c.album) === albumKey(r.name)));
}

const MAX = 24;
const key = (userId: string) => `cta.fill-releases.v1.${userId}`;

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

function isFillRelease(value: unknown): value is FillRelease {
  if (!value || typeof value !== "object") return false;
  const r = value as { name?: unknown; type?: unknown };
  return typeof r.name === "string" && !!r.name.trim() && typeof r.type === "string" && (FILL_RELEASE_TYPES as readonly string[]).includes(r.type);
}
