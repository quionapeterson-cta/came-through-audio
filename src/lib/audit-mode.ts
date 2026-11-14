/**
 * Audit Mode (founder, 2026-11-14).
 *
 * One finding is audited across three screens: the Royalty Health Report, that song's Song Health Checklist and My
 * Catalog. Each hop already knows where it is going; what was missing was the way back. This module keeps the trail —
 * the stops visited and the exact address of each — so the audit bar can return the member to the list they were
 * working, and "Next song" can carry them through the finding without starting again.
 *
 * It lives in sessionStorage rather than on the server: it is a scratchpad for the sitting, never a record of the
 * account. The addresses are the whole state (My Catalog opens from `catalogHref`, a checklist from `?tab=health&song=`),
 * so a stop restores itself even after a reload.
 */

export type AuditScreen = "report" | "checklist" | "catalog";

/** A song the audit still has to visit, with the field its treatment names when one is known. */
export type AuditSong = { id: string; field?: string | undefined };

export type AuditTrail = {
  /** The stops visited, always in screen order (report → checklist → catalog). */
  order: AuditScreen[];
  hrefs: Partial<Record<AuditScreen, string>>;
  /** The finding's songs in order, so "Next song" can work the finding without a trip back. */
  queue: AuditSong[];
  /** The song the audit is on now, which is where "Next song" starts counting from. */
  songId?: string | undefined;
  /** Where the audit started, shown so the member knows which finding they are working. */
  title?: string | undefined;
};

export const AUDIT_EVENT = "cta:audit";
const KEY = "cta.audit.v1";

/** The three stops, in the order they are read. */
export const AUDIT_SCREENS: AuditScreen[] = ["report", "checklist", "catalog"];

export const AUDIT_LABEL: Record<AuditScreen, string> = {
  report: "Report",
  checklist: "Song checklist",
  catalog: "My Catalog",
};

export function blankAudit(): AuditTrail {
  return { order: [], hrefs: {}, queue: [] };
}

/** One more stop on the trail. The address is kept per screen, so a second fix in the same audit updates the hop. */
export function recordStop(trail: AuditTrail, screen: AuditScreen, href: string, songId?: string): AuditTrail {
  const hrefs = { ...trail.hrefs, [screen]: href };
  const order = AUDIT_SCREENS.filter((s) => !!hrefs[s]);
  return { ...trail, hrefs, order, ...(songId ? { songId } : {}) };
}

/** The song after `afterId`, or the first one when the audit has not landed on a song yet. */
export function nextAuditSong(trail: AuditTrail, afterId?: string): AuditSong | undefined {
  if (!trail.queue.length) return undefined;
  if (!afterId) return trail.queue[0];
  const at = trail.queue.findIndex((s) => s.id === afterId);
  if (at < 0) return trail.queue.find((s) => s.id !== afterId);
  return trail.queue[at + 1];
}

/** Where "Next song" goes: the field's form when the treatment names one, otherwise that song's checklist. */
export function nextAuditHref(song: AuditSong): string {
  return song.field
    ? `/workspace?tab=catalog&songId=${song.id}&focusField=${song.field}&trail=yes#song-${song.id}`
    : `/workspace?tab=health&song=${song.id}&trail=yes`;
}

export function isAuditScreen(value: unknown): value is AuditScreen {
  return value === "report" || value === "checklist" || value === "catalog";
}

/** The trail as stored, or null when there is none (or the copy is from an older shape). */
export function readAudit(): AuditTrail | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const t = parsed as Partial<AuditTrail>;
    const hrefs: Partial<Record<AuditScreen, string>> = {};
    for (const screen of AUDIT_SCREENS) {
      const href = t.hrefs?.[screen];
      if (typeof href === "string" && href.startsWith("/")) hrefs[screen] = href;
    }
    const order = AUDIT_SCREENS.filter((s) => !!hrefs[s]);
    if (!order.length) return null;
    const queue = Array.isArray(t.queue)
      ? t.queue.filter((s): s is AuditSong => !!s && typeof s === "object" && typeof (s as AuditSong).id === "string")
        .map((s) => ({ id: s.id, ...(typeof s.field === "string" ? { field: s.field } : {}) }))
      : [];
    return {
      order, hrefs, queue,
      ...(typeof t.songId === "string" ? { songId: t.songId } : {}),
      ...(typeof t.title === "string" ? { title: t.title } : {}),
    };
  } catch { return null; }
}

/** Saves the trail and tells the workspace, so the bar appears the moment the first hop lands. */
export function saveAudit(trail: AuditTrail) {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(KEY, JSON.stringify(trail)); } catch { /* a full or blocked storage simply has no trail */ }
  window.dispatchEvent(new Event(AUDIT_EVENT));
}

/** Ends the audit: the trail is dropped and the bar goes away. Songs and reports are untouched. */
export function endAudit() {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(KEY); } catch { /* nothing to clear */ }
  window.dispatchEvent(new Event(AUDIT_EVENT));
}
