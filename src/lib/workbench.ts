/**
 * Working On (founder, 2026-11-06): the member's own folder of blueprints and contracts in progress, plus the ticks on
 * each blueprint checklist. Pure helpers only; reading and writing live in src/hooks/useWorkbench.ts.
 */
import { GUIDES, type Guide } from "./guides";

export type WorkbenchKind = "blueprint" | "contract";
/** A note and an optional due date on one checklist item, keyed by the item's wording (founder, 2026-11-06). */
export type ItemNote = { note?: string; due?: string };
export type ItemNotes = Record<string, ItemNote>;
export type WorkbenchEntry = { kind: WorkbenchKind; itemId: string; checked: string[]; pinned: boolean; notes?: ItemNotes | undefined; updatedAt?: string | undefined };
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
 * Tick or untick one item. Ticking never saves a blueprint to Working On (founder, 2026-11-06): only the Save button
 * does, so a curious tick doesn't fill the folder.
 */
export function toggleChecked(entry: WorkbenchEntry, item: string): WorkbenchEntry {
  const has = entry.checked.includes(item);
  return { ...entry, checked: has ? entry.checked.filter((c) => c !== item) : [...entry.checked, item] };
}

/** True only on the tick that takes a checklist to 100%, so a page load or a re-tick of a finished one stays quiet. */
export const justCompleted = (checklist: readonly string[] | undefined, before: readonly string[], after: readonly string[]) =>
  !checklistProgress(checklist, before).finished && checklistProgress(checklist, after).finished;

/** A row worth keeping: anything ticked, saved or noted. An empty one is deleted instead. */
export const isEmptyEntry = (e: Pick<WorkbenchEntry, "checked" | "pinned" | "notes">) =>
  !e.pinned && e.checked.length === 0 && Object.keys(e.notes ?? {}).length === 0;

/** Longest note on one checklist item. */
export const NOTE_MAX = 500;

/** Plain text, no control characters (line breaks kept), trimmed and cut to NOTE_MAX. */
export function sanitizeNote(text: unknown): string {
  if (typeof text !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return text.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").trim().slice(0, NOTE_MAX).trim();
}

/** A real calendar date as YYYY-MM-DD, or "" for anything else. */
export function sanitizeDue(due: unknown): string {
  if (typeof due !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return "";
  const [y, m, d] = due.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? due : "";
}

/** Cleans notes read from storage or the table: drops blanks, bad dates and anything that isn't a note. */
export function sanitizeNotes(raw: unknown): ItemNotes {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ItemNotes = {};
  for (const [item, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!item || !v || typeof v !== "object") continue;
    const note = sanitizeNote((v as ItemNote).note), due = sanitizeDue((v as ItemNote).due);
    if (note || due) out[item] = { ...(note && { note }), ...(due && { due }) };
  }
  return out;
}

/** Sets (or clears, when both are blank) the note and due date on one checklist item. */
export function setItemNote(entry: WorkbenchEntry, item: string, value: ItemNote): WorkbenchEntry {
  const notes = { ...entry.notes };
  delete notes[item];
  const clean = sanitizeNotes({ [item]: value })[item];
  if (clean) notes[item] = clean;
  return { ...entry, notes };
}

/** Today in the member's own time zone, as YYYY-MM-DD. */
export const todayIso = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

/** Due before today and not ticked yet. */
export const isOverdue = (due: string | undefined, ticked: boolean, today: string) => !!due && !ticked && due < today;

/** "Due Nov 20", with the year only when it isn't this year's. */
export function dueLabel(due: string, today: string) {
  const [y, m, d] = due.split("-").map(Number) as [number, number, number];
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC", ...(due.slice(0, 4) !== today.slice(0, 4) && { year: "numeric" }) };
  return `Due ${new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", opts)}`;
}

/** In progress first, then finished; alphabetical within each group (BRANDING §3). */
export function sortByProgress<T extends { title: string; progress: ChecklistProgress }>(list: readonly T[]): { inProgress: T[]; finished: T[] } {
  const abc = (a: T, b: T) => a.title.localeCompare(b.title);
  return {
    inProgress: list.filter((x) => !x.progress.finished).sort(abc),
    finished: list.filter((x) => x.progress.finished).sort(abc),
  };
}

/** Blueprints saved to Working On with the Save button, with their progress. */
export function savedGuides(entries: readonly WorkbenchEntry[], guides: readonly Guide[] = GUIDES) {
  const byId = new Map(entries.filter((e) => e.kind === "blueprint" && e.pinned).map((e) => [e.itemId, e]));
  return guides.filter((g) => byId.has(g.id)).map((g) => {
    const entry = byId.get(g.id)!;
    return { guide: g, entry, title: g.title, progress: checklistProgress(g.checklist, entry.checked) };
  });
}

/** The soonest due date still open on a blueprint's checklist (ticked items and stale wording don't count). */
export function nextDue(guide: Pick<Guide, "checklist">, entry: WorkbenchEntry): { item: string; due: string } | undefined {
  return (guide.checklist ?? [])
    .filter((item) => !entry.checked.includes(item) && entry.notes?.[item]?.due)
    .map((item) => ({ item, due: entry.notes![item]!.due! }))
    .sort((a, b) => a.due.localeCompare(b.due))[0];
}

export type NextStep =
  | { kind: "overdue" | "due" | "progress"; guide: Guide; item: string; due?: string | undefined }
  | { kind: "contract"; contractId: string; title: string };

type ContractLike = { id?: string | undefined; title: string; status: string; sentAt?: string | null; updatedAt: string };

/**
 * The single most useful thing to do next, from what the member saved (founder, 2026-11-06): an overdue checklist
 * item (earliest first), else the item due soonest, else the first open item of the saved blueprint furthest along
 * (below 100%), else the oldest contract still waiting on a signature. Undefined when there's nothing to do.
 */
export function pickNextStep(entries: readonly WorkbenchEntry[], contracts: readonly ContractLike[], today: string, guides: readonly Guide[] = GUIDES): NextStep | undefined {
  const saved = savedGuides(entries, guides).sort((a, b) => a.title.localeCompare(b.title));
  const dated = saved
    .map((s) => ({ guide: s.guide, next: nextDue(s.guide, s.entry) }))
    .filter((x): x is { guide: Guide; next: { item: string; due: string } } => !!x.next)
    .sort((a, b) => a.next.due.localeCompare(b.next.due));
  const first = dated[0];
  if (first) return { kind: isOverdue(first.next.due, false, today) ? "overdue" : "due", guide: first.guide, item: first.next.item, due: first.next.due };
  const furthest = saved.filter((s) => s.progress.total > 0 && !s.progress.finished).sort((a, b) => b.progress.pct - a.progress.pct)[0];
  const item = furthest?.guide.checklist?.find((i) => !furthest.entry.checked.includes(i));
  if (furthest && item) return { kind: "progress", guide: furthest.guide, item };
  const when = (c: ContractLike) => c.sentAt ?? c.updatedAt;
  const oldest = contracts.filter((c) => c.status !== "signed" && c.id).sort((a, b) => when(a).localeCompare(when(b)) || a.title.localeCompare(b.title))[0];
  return oldest ? { kind: "contract", contractId: oldest.id!, title: oldest.title } : undefined;
}

/** What the Working On tab counts: blueprints still in progress plus contracts still waiting on someone. */
export function workingOnCount(entries: readonly WorkbenchEntry[], contracts: readonly { status: string }[]) {
  return savedGuides(entries).filter((x) => !x.progress.finished).length + contracts.filter((c) => c.status !== "signed").length;
}
