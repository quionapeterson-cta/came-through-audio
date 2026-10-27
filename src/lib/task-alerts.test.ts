import { describe, expect, it } from "vitest";
import { dueLabel, signInMoment, snoozeUntil, sortTasks } from "@/lib/task-alerts";
import type { DepartmentTask } from "@/lib/tasks.functions";

const NOW = Date.parse("2026-10-25T12:00:00Z");
const t = (o: Partial<DepartmentTask>): DepartmentTask => ({ id: o.title ?? "t", department: "finance", title: "t", body: "", status: "planned", created_at: "2026-10-01", updated_at: "2026-10-01",
  importance: "normal", due_at: null, owner_id: null, completed_at: null, completed_by: null, ...o });

describe("admin sign-in moment", () => {
  const tasks = [
    t({ title: "Close books", status: "done", completed_by: "me", completed_at: "2026-10-24T10:00:00Z" }),
    t({ title: "Payroll", importance: "top", due_at: "2026-10-25T15:00:00Z" }),
    t({ title: "Newsletter", importance: "high", owner_id: "me" }),
    t({ title: "Someone else's", importance: "top", owner_id: "other" }),
  ];
  it("puts an open Top priority task (mine or my department's) first, before the celebration", () => {
    const m = signInMoment(tasks, "me", {}, NOW);
    expect(m.urgent.map((x) => x.title)).toEqual(["Payroll"]);
    expect(m.last?.title).toBe("Close books");
  });
  it("snoozed alerts give way to the celebration; snooze never passes the deadline", () => {
    const pay = tasks[1]!;
    expect(snoozeUntil(pay, NOW)).toBe(NOW + 3600_000);
    expect(snoozeUntil(t({ due_at: "2026-10-25T12:20:00Z" }), NOW)).toBe(Date.parse("2026-10-25T12:20:00Z"));
    const m = signInMoment(tasks, "me", { Payroll: NOW + 3600_000 }, NOW);
    expect(m.urgent).toEqual([]);
    expect(m.next?.title).toBe("Payroll");
  });
  it("sorts open tasks by importance, then deadline", () => {
    expect(sortTasks(tasks).map((x) => x.title)).toEqual(["Payroll", "Someone else's", "Newsletter", "Close books"]);
  });
  it("says how long until or since the deadline", () => {
    expect(dueLabel("2026-10-25T15:00:00Z", NOW)).toMatchObject({ text: "Due in 3 hours", overdue: false });
    expect(dueLabel("2026-10-23T12:00:00Z", NOW)).toMatchObject({ text: "2 days overdue", overdue: true });
  });
});

describe("weekOf", async () => {
  const { weekOf } = await import("./task-reminders.server");
  it("gives the same Monday for every day of a week", () => {
    expect(weekOf(new Date("2027-01-01T12:00:00Z"))).toBe("2026-12-28");
    expect(weekOf(new Date("2027-01-03T23:00:00Z"))).toBe("2026-12-28");
    expect(weekOf(new Date("2027-01-04T00:00:00Z"))).toBe("2027-01-04");
  });
});
