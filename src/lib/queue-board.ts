/**
 * The shape of Admin → My Queue (founder, 2026-11-05). Pure functions only: the three columns, the daily progress bar and
 * who may change a step. The rules live here with their test so the screen can never disagree with them.
 */

export const STEP_LOCKS = ["open", "locked", "approval"] as const;
export type StepLock = (typeof STEP_LOCKS)[number];

export type QueueState = "working" | "paused" | "done";

export const LOCK_LABEL: Record<StepLock, string> = {
  open: "Editable",
  locked: "Locked",
  approval: "Needs approval",
};

export const LOCK_COPY: Record<StepLock, string> = {
  open: "Anyone assigned this task can change the step.",
  locked: "Only a super admin or department lead can change this step. Ask them, or request approval.",
  approval: "Staff can propose a change; a super admin or department lead approves it before it applies.",
};

/**
 * The lock toggle belongs to super admins and department leads (founder, 2026-11-05). Project Managers read every team's
 * board, which is not the same as editing someone's steps.
 */
export function canLockSteps(role: string): boolean {
  return role === "super_admin" || role === "department_lead";
}

/** The lock button on a step cycles open → locked → needs approval → open. */
export const nextLock = (lock: StepLock): StepLock => (lock === "open" ? "locked" : lock === "locked" ? "approval" : "open");

/** A step's wording is the owner's to change while it is open; a locked or approval step sends a request instead. */
export function canEditStep(o: { ownerId: string; me: string; lock: StepLock }): boolean {
  return o.ownerId === o.me && o.lock === "open";
}

/** Ticking a step is always the owner's: a lock protects the plan, it never stops someone doing the work. */
export function canCheckStep(o: { ownerId: string; me: string }): boolean {
  return o.ownerId === o.me;
}

export type BoardItem = { ref: string };
export type BoardRow = { item_ref: string; state: QueueState; updated_at?: string | null };

/** Working On Now, Waiting (paused or not started), Completed. */
export function queueColumns<T extends BoardItem>(items: T[], rows: BoardRow[]) {
  const stateOf = (ref: string) => rows.find((r) => r.item_ref === ref)?.state;
  return {
    working: items.filter((i) => stateOf(i.ref) === "working"),
    waiting: items.filter((i) => stateOf(i.ref) !== "working" && stateOf(i.ref) !== "done"),
    completed: items.filter((i) => stateOf(i.ref) === "done"),
  };
}

/**
 * The bar at the top fills as steps are ticked. Steps are the honest measure because a task can hold ten of them; when
 * nobody has written any steps yet the bar counts items instead, so it still moves on day one.
 */
export function queueProgress(items: BoardItem[], rows: BoardRow[], steps: { item_ref: string; done_at: string | null }[]) {
  const refs = new Set(items.map((i) => i.ref));
  const mine = steps.filter((s) => refs.has(s.item_ref));
  const doneSteps = mine.filter((s) => s.done_at).length;
  const doneItems = rows.filter((r) => r.state === "done" && refs.has(r.item_ref)).length;
  const total = mine.length ? mine.length : items.length;
  const done = mine.length ? doneSteps : Math.min(doneItems, total);
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0, unit: mine.length ? ("steps" as const) : ("items" as const) };
}

/** Only today's work counts toward "completed": yesterday's wins should not keep the column busy. */
export function completedToday<T extends BoardItem>(completed: T[], rows: BoardRow[], now = new Date()): T[] {
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  return completed.filter((i) => {
    const at = rows.find((r) => r.item_ref === i.ref)?.updated_at;
    return !at || Date.parse(at) >= midnight;
  });
}
