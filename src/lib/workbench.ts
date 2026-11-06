/**
 * Working On (founder, 2026-11-06): the member's own folder of blueprints and contracts in progress, plus the ticks on
 * each blueprint checklist. Pure helpers only; reading and writing live in src/hooks/useWorkbench.ts.
 */
import { GUIDES } from "./guides";

export type WorkbenchKind = "blueprint" | "contract";
export type WorkbenchEntry = { kind: WorkbenchKind; itemId: string; checked: string[]; pinned: boolean; updatedAt?: string | undefined };
export type ChecklistProgress = { done: number; total: number; pct: number; started: boolean; finished: boolean };

export const workbenchKey = (kind: WorkbenchKind, itemId: string) => `${kind}:${itemId}`;

/** Ticked out of the checklist as it reads today: a tick on wording that has since changed does not count. */
export function checklistProgress(checklist: readonly string[] | undefined, checked: readonly string[] | undefined): ChecklistProgress {
  const items = [...new Set(checklist ?? [])];
  const ticked = new Set(checked ?? []);
  const done = items.filter((i) => ticked.has(i)).length;
  const total = items.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0, started: done > 0, finished: total > 0 && done === total };
}

/** "3 of 8 · 38%" */
export const progressLabel = (p: ChecklistProgress) => `${p.done} of ${p.total} · ${p.pct}%`;

/**
 * Tick or untick one item. The first tick on a blueprint also saves it to Working On, so a started blueprint is
 * always close by; removing it later keeps the ticks.
 */
export function toggleChecked(entry: WorkbenchEntry, item: string): WorkbenchEntry {
  const has = entry.checked.includes(item);
  const checked = has ? entry.checked.filter((c) => c !== item) : [...entry.checked, item];
  return { ...entry, checked, pinned: entry.pinned || (!has && entry.checked.length === 0) };
}

/** A row worth keeping: anything ticked or saved. An empty one is deleted instead. */
export const isEmptyEntry = (e: Pick<WorkbenchEntry, "checked" | "pinned">) => !e.pinned && e.checked.length === 0;

/** In progress first, then finished; alphabetical within each group (BRANDING §3). */
export function sortByProgress<T extends { title: string; progress: ChecklistProgress }>(list: readonly T[]): { inProgress: T[]; finished: T[] } {
  const abc = (a: T, b: T) => a.title.localeCompare(b.title);
  return {
    inProgress: list.filter((x) => !x.progress.finished).sort(abc),
    finished: list.filter((x) => x.progress.finished).sort(abc),
  };
}

/** Blueprints saved to Working On (the first tick saves one), with their progress. */
export function savedGuides(entries: readonly WorkbenchEntry[]) {
  const byId = new Map(entries.filter((e) => e.kind === "blueprint" && e.pinned).map((e) => [e.itemId, e]));
  return GUIDES.filter((g) => byId.has(g.id)).map((g) => ({ guide: g, title: g.title, progress: checklistProgress(g.checklist, byId.get(g.id)!.checked) }));
}

/** What the Working On tab counts: blueprints still in progress plus contracts still waiting on someone. */
export function workingOnCount(entries: readonly WorkbenchEntry[], contracts: readonly { status: string }[]) {
  return savedGuides(entries).filter((x) => !x.progress.finished).length + contracts.filter((c) => c.status !== "signed").length;
}
