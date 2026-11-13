import { useCallback, useEffect, useState, type ReactNode } from "react";

/**
 * The "Music Royalty Doctors" spotlight (founder, 2026-11-13).
 *
 * A difference on the chart links into My Catalog with `?songId=…&focusField=isrc&agencyIsrc=…&action=adopt`. This hook
 * turns that link into something a person can see: the song is opened by the page, and the exact field it names scrolls
 * into view and carries a glowing diagnostic ring for a few seconds, in light and dark mode alike.
 *
 * The ring is one class (`.cta-diagnostic-target` in styles.css), so the colours live with the rest of the theme. The link
 * parameters are stripped once the field is acknowledged, so a refresh never re-fires the spotlight.
 */

export type FocusFieldKey = "isrc" | "version" | "release" | "status" | "retired";

/** Which input a field name lands on. The form's own ids are the contract, and `jumpTo` already uses them. */
export const FIELD_DOM_ID: Record<string, string> = {
  isrc: "isrc",
  version: "version",
  release: "album",
  releaseDate: "releaseDate",
  status: "retiredIscrs-0",
  retired: "retiredIscrs-0",
};

export const domIdForField = (field: string) => FIELD_DOM_ID[field] ?? field;

export const HIGHLIGHT_CLASS = "cta-diagnostic-target";

const URL_KEYS = ["songId", "focusField", "agencyIsrc", "agencyVersion", "agencyVersions", "action"] as const;
export type FocusLink = { songId?: string | undefined; field?: string | undefined; agencyIsrc?: string | undefined; agencyVersion?: string | undefined; agencyVersions?: string | undefined; action?: string | undefined };

/** The deep-link parameters, read from the URL when the caller has none of its own. */
export function readFocusLink(): FocusLink {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  return {
    songId: p.get("songId") ?? undefined,
    field: p.get("focusField") ?? undefined,
    agencyIsrc: p.get("agencyIsrc") ?? undefined,
    agencyVersion: p.get("agencyVersion") ?? undefined,
    agencyVersions: p.get("agencyVersions") ?? undefined,
    action: p.get("action") ?? undefined,
  };
}

/** Takes the spotlight parameters out of the address bar, so a refresh or a share never re-triggers them. */
export function clearFocusParams() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let touched = false;
  for (const k of URL_KEYS) if (url.searchParams.has(k)) { url.searchParams.delete(k); touched = true; }
  if (!touched) return;
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

/**
 * Finds the named field, scrolls it into view and lights it for `durationMs`. Returns whether the spotlight is on, so a
 * page can show its quick-fix bar while the member is looking at the field.
 */
export function useFocusHighlight({ field, active = true, durationMs = 4500 }: { field?: string | undefined; active?: boolean; durationMs?: number }) {
  const [lit, setLit] = useState(false);

  useEffect(() => {
    if (!field || !active) { setLit(false); return; }
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const light = (node: HTMLElement) => {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      node.classList.add(HIGHLIGHT_CLASS);
      const input = node.matches("input, textarea, select") ? node : node.querySelector<HTMLElement>("input, textarea, select");
      input?.focus({ preventScroll: true });
      setLit(true);
      timers.push(setTimeout(() => { node.classList.remove(HIGHLIGHT_CLASS); setLit(false); }, durationMs));
    };
    const find = (attempt: number) => {
      if (cancelled) return;
      const node = document.getElementById(domIdForField(field));
      if (node) return light(node);
      // The song's form may still be opening, so the field is looked for a few times before giving up quietly.
      if (attempt < 12) timers.push(setTimeout(() => find(attempt + 1), 150));
    };
    timers.push(setTimeout(() => find(0), 120));
    return () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
      document.getElementById(domIdForField(field))?.classList.remove(HIGHLIGHT_CLASS);
    };
  }, [field, active, durationMs]);

  return { highlighted: lit };
}

/**
 * Wraps any field so it can carry the diagnostic badge while it is the target. Two lines at the call site, used where the
 * field is not one of the named form ids (a release card, a status toggle).
 */
export function DiagnosticHighlight({ active, label, children }: { active: boolean; label: string; children: ReactNode }) {
  return (
    <div className="relative">
      {active && (
        <span className="mb-1 inline-flex items-center gap-1 rounded-full border border-[#4D8CFF]/40 bg-[#004AAD]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#004AAD] dark:border-[#4D8CFF]/45 dark:bg-[#4D8CFF]/20 dark:text-[#4D8CFF]">
          🩺 Diagnostic target: fix {label}
        </span>
      )}
      {children}
    </div>
  );
}

/** A stable callback for the "Back to Differences Panel" link, so every surface returns to the same place. */
export function useDifferencesHref() {
  return useCallback((society?: string) => {
    const p = new URLSearchParams({ tab: "health", panel: "differences" });
    if (society) p.set("society", society);
    return `/workspace?${p.toString()}#differences-panel`;
  }, []);
}
