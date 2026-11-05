import { describe, expect, it } from "vitest";
import { canCheckStep, canEditStep, canLockSteps, completedToday, queueColumns, queueProgress, LOCK_LABEL } from "./queue-board";

const items = [{ ref: "task:1" }, { ref: "task:2" }, { ref: "ticket:3" }];

describe("queueColumns", () => {
  it("splits the board into working, waiting and completed", () => {
    const rows = [
      { item_ref: "task:1", state: "working" as const },
      { item_ref: "task:2", state: "paused" as const },
      { item_ref: "ticket:3", state: "done" as const },
    ];
    const { working, waiting, completed } = queueColumns(items, rows);
    expect(working.map((i) => i.ref)).toEqual(["task:1"]);
    expect(waiting.map((i) => i.ref)).toEqual(["task:2"]);
    expect(completed.map((i) => i.ref)).toEqual(["ticket:3"]);
  });

  it("treats an item nobody started as waiting", () => {
    expect(queueColumns(items, []).waiting).toHaveLength(3);
  });
});

describe("queueProgress", () => {
  it("counts steps when there are any, and items when there are none", () => {
    const steps = [
      { item_ref: "task:1", done_at: "2026-11-05T10:00:00Z" },
      { item_ref: "task:1", done_at: null },
      { item_ref: "task:2", done_at: "2026-11-05T11:00:00Z" },
      { item_ref: "task:9", done_at: "2026-11-05T11:00:00Z" }, // not on today's board
    ];
    expect(queueProgress(items, [], steps)).toEqual({ done: 2, total: 3, pct: 67, unit: "steps" });
    expect(queueProgress(items, [{ item_ref: "task:1", state: "done" }], [])).toEqual({ done: 1, total: 3, pct: 33, unit: "items" });
  });

  it("is 0, not NaN, on an empty board", () => {
    expect(queueProgress([], [], []).pct).toBe(0);
  });
});

describe("lock rules", () => {
  it("gives the lock toggle to super admins and department leads only", () => {
    expect(canLockSteps("super_admin")).toBe(true);
    expect(canLockSteps("department_lead")).toBe(true);
    expect(canLockSteps("project_manager")).toBe(false);
    expect(canLockSteps("employee")).toBe(false);
  });

  it("lets the owner edit an open step and requires approval otherwise", () => {
    expect(canEditStep({ ownerId: "me", me: "me", lock: "open" })).toBe(true);
    expect(canEditStep({ ownerId: "me", me: "me", lock: "locked" })).toBe(false);
    expect(canEditStep({ ownerId: "me", me: "me", lock: "approval" })).toBe(false);
    expect(canEditStep({ ownerId: "other", me: "me", lock: "open" })).toBe(false);
  });

  it("still lets the owner tick a locked step: a lock protects the plan, not the work", () => {
    expect(canCheckStep({ ownerId: "me", me: "me" })).toBe(true);
    expect(canCheckStep({ ownerId: "other", me: "me" })).toBe(false);
  });

  it("labels every lock mode", () => {
    expect(Object.keys(LOCK_LABEL)).toEqual(["open", "locked", "approval"]);
  });
});

describe("completedToday", () => {
  it("keeps today's completions and drops older ones", () => {
    const now = new Date("2026-11-05T15:00:00Z");
    const rows = [
      { item_ref: "task:1", state: "done" as const, updated_at: "2026-11-05T09:00:00Z" },
      { item_ref: "task:2", state: "done" as const, updated_at: "2026-11-04T09:00:00Z" },
    ];
    expect(completedToday([{ ref: "task:1" }, { ref: "task:2" }], rows, now).map((i) => i.ref)).toEqual(["task:1"]);
  });
});
