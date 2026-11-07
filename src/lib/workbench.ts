/**
 * Working On (founder, 2026-11-06): the member's own folder of blueprints and contracts in progress, plus the ticks on
 * each blueprint checklist. Pure helpers only; reading and writing live in src/hooks/useWorkbench.ts.
 */
import { BLUEPRINT_GUIDES, GUIDES, type Guide } from "./guides";

export type WorkbenchKind = "blueprint" | "contract";
/** A note and a due date on one checklist item, so a blueprint reads like a small project plan (founder, 2026-11-06). */
export type ItemMeta = {
  note?: string;
  due?: string;
  /** The member's own item rather than one from the guide (founder, 2026-11-06). */
  custom?: true;
};
export type WorkbenchEntry = { kind: WorkbenchKind; itemId: string; checked: string[]; pinned: boolean; meta?: Record<string, ItemMeta>; updatedAt?: string | undefined };
export type ChecklistProgress = { done: number; total: number; pct: number; started: boolean; finished: boolean };

export const workbenchKey = (kind: WorkbenchKind, itemId: string) => `${kind}:${itemId}`;

/**
 * Worked more than once (founder, 2026-11-06): a blueprint can be started again so the process can be repeated without
 * losing the record of the last run. The first run keeps the guide's own id and every later run adds `~2`, `~3`…
 */
/** The two profile blueprints that walk the same fields setup asks for: finishing both is the defaults moment. */
export const DEFAULT_BLUEPRINTS = ["embed-defaults", "catalog-defaults"] as const;

/** True once both profile defaults have a finished run (the newest run of either counts), whatever order they were done in. */
export function defaultsFinished(entries: WorkbenchEntry[], guides: Guide[] = BLUEPRINT_GUIDES): boolean {
  return DEFAULT_BLUEPRINTS.every((id) => {
    const g = guides.find((x) => x.id === id);
    if (!g?.checklist?.length) return false;
    return entries.some((e) => e.kind === "blueprint" && guideIdOf(e.itemId) === id && checklistProgress(g.checklist, e.checked).finished);
  });
}

export const RUN_SEP = "~";
export const guideIdOf = (itemId: string) => itemId.split(RUN_SEP)[0]!;
export function runOf(itemId: string) {
  const n = Number(itemId.slice(guideIdOf(itemId).length + 1));
  return Number.isInteger(n) && n > 1 ? n : 1;
}
export const runId = (guideId: string, run: number) => (run > 1 ? `${guideId}${RUN_SEP}${run}` : guideId);
/** "Set Your Embed Defaults · Run 2" */
export const runTitle = (title: string, run: number) => (run > 1 ? `${title} · Run ${run}` : title);
/** Every run saved for one blueprint, oldest first. */
export function runsOf(entries: readonly WorkbenchEntry[], guideId: string) {
  return entries.filter((e) => e.kind === "blueprint" && guideIdOf(e.itemId) === guideId)
    .map((e) => ({ entry: e, run: runOf(e.itemId) })).sort((a, b) => a.run - b.run);
}
/** The id a new run of this blueprint takes: the next number after the last one. */
export function nextRunId(entries: readonly WorkbenchEntry[], guideId: string) {
  const runs = runsOf(entries, guideId);
  return runId(guideId, (runs[runs.length - 1]?.run ?? 0) + 1);
}

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
 * Tick or untick one item. Ticking never adds the blueprint to Working On: saving one there is the member's own click
 * (founder, 2026-11-06), so a checklist they are just reading through stays out of their folder until they ask.
 */
export function toggleChecked(entry: WorkbenchEntry, item: string): WorkbenchEntry {
  const has = entry.checked.includes(item);
  const checked = has ? entry.checked.filter((c) => c !== item) : [...entry.checked, item];
  return { ...entry, checked };
}

const isDue = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** The note and due date on one checklist item, if any. */
export const metaFor = (entry: Pick<WorkbenchEntry, "meta">, item: string): ItemMeta => entry.meta?.[item] ?? {};

/**
 * Sets or clears one item's note and due date. An empty patch value deletes that part, and an item with neither keeps
 * no entry, so a cleared item leaves nothing behind.
 */
export function withMeta(entry: WorkbenchEntry, item: string, patch: ItemMeta): WorkbenchEntry {
  const merged = { ...metaFor(entry, item), ...patch };
  const clean: ItemMeta = {};
  const note = (merged.note ?? "").trim();
  if (note) clean.note = note.slice(0, 500);
  if (merged.due && isDue(merged.due)) clean.due = merged.due;
  if (merged.custom) clean.custom = true;
  const meta = { ...(entry.meta ?? {}) };
  if (clean.note || clean.due || clean.custom) meta[item] = clean;
  else delete meta[item];
  return { ...entry, meta };
}

/**
 * The member's own checklist item, if they added one (founder, 2026-11-06): one per blueprint, ticked and annotated like
 * the guide's own items. It is kept out of `checklistProgress`, so the blueprint's own 100% still means the blueprint.
 */
export function customItems(entry: Pick<WorkbenchEntry, "meta">): string[] {
  return Object.entries(entry.meta ?? {}).filter(([, m]) => m.custom).map(([item]) => item);
}

/** Adds, renames or clears the member's own item. Empty wording removes it and its tick, leaving their notes alone. */
export function withCustomItem(entry: WorkbenchEntry, item: string): WorkbenchEntry {
  const meta = { ...(entry.meta ?? {}) };
  const old = customItems(entry)[0];
  for (const key of customItems(entry)) delete meta[key];
  const clean = item.trim().slice(0, 120);
  const checked = old && old !== clean ? entry.checked.filter((c) => c !== old) : entry.checked;
  if (!clean) return { ...entry, meta, checked };
  meta[clean] = { ...(meta[clean] ?? {}), custom: true };
  return { ...entry, meta, checked };
}

/** A row worth keeping: anything ticked, saved or annotated. An empty one is deleted instead. */
export const isEmptyEntry = (e: Pick<WorkbenchEntry, "checked" | "pinned" | "meta">) =>
  !e.pinned && e.checked.length === 0 && Object.keys(e.meta ?? {}).length === 0;

/** "2026-11-12" → "Nov 12"; anything else is shown as typed. */
export function dueLabel(due: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due);
  if (!m) return due;
  return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** True once a due date has gone by: today is still on time. */
export function isOverdue(due: string, today = new Date()) {
  if (!isDue(due)) return false;
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return due < todayISO;
}

/** The soonest due date still open on a checklist (untick'd items only), if there is one. */
export function nextDue(entry: Pick<WorkbenchEntry, "meta" | "checked">, checklist?: readonly string[]): string | undefined {
  const items = new Set(checklist ?? []);
  return Object.entries(entry.meta ?? {})
    .filter(([item, m]) => (!items.size || items.has(item)) && !!m.due && !entry.checked.includes(item))
    .map(([, m]) => m.due!)
    .sort()[0];
}

/** In progress first, then finished; alphabetical within each group (BRANDING §3). */
export function sortByProgress<T extends { title: string; progress: ChecklistProgress }>(list: readonly T[]): { inProgress: T[]; finished: T[] } {
  const abc = (a: T, b: T) => a.title.localeCompare(b.title);
  return {
    inProgress: list.filter((x) => !x.progress.finished).sort(abc),
    finished: list.filter((x) => x.progress.finished).sort(abc),
  };
}

/** Blueprints the member saved to Working On, with their progress. Each run is its own row, so finished ones are kept. */
export function savedGuides(entries: readonly WorkbenchEntry[]) {
  return entries.filter((e) => e.kind === "blueprint" && e.pinned).flatMap((e) => {
    const guide = GUIDES.find((g) => g.id === guideIdOf(e.itemId));
    if (!guide) return [];
    const run = runOf(e.itemId);
    return [{ guide, itemId: e.itemId, run, title: runTitle(guide.title, run), progress: checklistProgress(guide.checklist, e.checked) }];
  });
}

/** What the Working On tab counts: blueprints still in progress plus contracts still waiting on someone. */
export function workingOnCount(entries: readonly WorkbenchEntry[], contracts: readonly { status: string }[]) {
  return savedGuides(entries).filter((x) => !x.progress.finished).length + contracts.filter((c) => c.status !== "signed").length;
}

/** The one most useful thing to do next, shown at the top of Working On (founder, 2026-11-06). */
export type NextStep = { kind: "item" | "contract" | "browse"; title: string; detail: string; guideId?: string | undefined; contractId?: string | undefined };

/**
 * Reads the folder and picks one thing: the saved blueprint item that is due soonest (dated items first, then the
 * blueprint furthest along), otherwise the next unticked item, then a draft or a contract out for signature. With
 * nothing in progress it points at the library rather than inventing work.
 */
export function nextStep(entries: readonly WorkbenchEntry[], contracts: readonly { id?: string | undefined; title: string; status: string }[]): NextStep {
  const byId = new Map(entries.filter((e) => e.kind === "blueprint").map((e) => [e.itemId, e]));
  const open = savedGuides(entries).filter((s) => !s.progress.finished);
  const candidates = open.flatMap((s) => {
    const entry = byId.get(s.itemId);
    const unticked = (s.guide.checklist ?? []).filter((k) => !(entry?.checked ?? []).includes(k));
    // A dated item jumps the queue: a plan is only useful if the date pulls the work forward. With no dates, the
    // blueprint that is furthest along comes first.
    const dated = unticked.filter((k) => !!entry && !!metaFor(entry, k).due);
    const items = dated.length ? dated : unticked.slice(0, 1);
    return items.map((item) => ({ guide: s.guide, item, due: entry ? metaFor(entry, item).due : undefined, pct: s.progress.pct }));
  });
  candidates.sort((a, b) => {
    if (a.due && b.due) return a.due.localeCompare(b.due);
    if (a.due) return -1;
    if (b.due) return 1;
    return b.pct - a.pct || a.guide.title.localeCompare(b.guide.title);
  });
  const first = candidates[0];
  if (first) {
    return {
      kind: "item", guideId: first.guide.id, title: first.guide.title,
      detail: `${first.item}${first.due ? ` · due ${dueLabel(first.due)}` : ""}`,
    };
  }
  const draft = contracts.find((c) => c.status === "draft");
  if (draft) return { kind: "contract", contractId: draft.id, title: draft.title, detail: "Your draft is still open. Finish it and send it for signature." };
  const waiting = contracts.find((c) => c.status !== "signed");
  if (waiting) return { kind: "contract", contractId: waiting.id, title: waiting.title, detail: "Out for signature. Open it to see who is left and send a reminder." };
  return { kind: "browse", title: "Pick your next blueprint", detail: "Nothing is in progress. Browse the blueprints and save the one you want to work on next." };
}

/** The saved guide a next step points at, for opening it. */
export const guideForStep = (entries: readonly WorkbenchEntry[], step: NextStep): Guide | undefined =>
  step.guideId ? savedGuides(entries).find((s) => s.guide.id === step.guideId)?.guide : undefined;
