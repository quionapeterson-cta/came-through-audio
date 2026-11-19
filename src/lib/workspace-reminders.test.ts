import { describe, expect, it } from "vitest";
import {
  buildHref,
  dueReminders,
  isReminderDue,
  isReminderOverdue,
  makeReminder,
  normalizeReminders,
  presetsFor,
  reminderState,
} from "@/lib/workspace-reminders";

const NOW = Date.parse("2026-11-19T12:00:00Z");

describe("workspace reminders", () => {
  it("builds the real workspace deep links the presets name", () => {
    expect(buildHref("catalog", { songId: "s1", focusField: "iswc" })).toBe("/workspace?tab=catalog&songId=s1&focusField=iswc");
    expect(buildHref("health", { songId: "s1" })).toBe("/workspace?tab=health&song=s1");
    expect(buildHref("splits", { sheetId: "s1" })).toBe("/workspace?tab=splits&sheetId=s1");
    expect(buildHref("contracts", { contractId: "c1" })).toBe("/workspace?tab=learn&contractId=c1");
    expect(buildHref("general")).toBe("/workspace");
  });

  it("tailors the smart presets to the module", () => {
    const catalog = presetsFor("catalog");
    expect(catalog.map((p) => p.days)).toEqual([14, 30]);
    expect(catalog[0]?.focusField).toBe("iswc");
    expect(catalog[1]?.focusField).toBe("metadata");
    expect(presetsFor("split_sheet")[0]?.title).toContain("split sheet signature");
    expect(presetsFor("contract")[1]?.title).toContain("renewal");
    expect(presetsFor("blueprint", { stepTitle: "Register the song" })[0]?.title).toContain("Register the song");
  });

  it("stays due until acknowledged, and a snooze hides it for a day", () => {
    const base = makeReminder({ title: "Send stems", dueAt: "2026-11-19T10:00:00Z" });
    expect(isReminderDue(base, NOW)).toBe(true);
    expect(reminderState({ ...base, completedAt: "2026-11-19T11:00:00Z" }, NOW)).toBe("completed");
    expect(isReminderDue({ ...base, snoozedUntil: "2026-11-20T10:00:00Z" }, NOW)).toBe(false);
    expect(isReminderDue({ ...base, snoozedUntil: "2026-11-19T11:00:00Z" }, NOW)).toBe(true);
  });

  it("treats a returned snooze as due now, not as a day-overdue original date", () => {
    const returned = { ...makeReminder({ title: "Send stems", dueAt: "2026-11-18T10:00:00Z" }), snoozedUntil: "2026-11-19T13:00:00Z" };
    const afterSnooze = Date.parse("2026-11-19T14:00:00Z");
    expect(isReminderOverdue(returned, afterSnooze)).toBe(false);
    expect(isReminderDue(returned, afterSnooze)).toBe(true);
    expect(isReminderOverdue(makeReminder({ title: "Old", dueAt: "2026-11-17T10:00:00Z" }), NOW)).toBe(true);
  });

  it("orders urgent first, then the reminder that has waited longest", () => {
    const standard = makeReminder({ title: "A", dueAt: "2026-11-19T10:00:00Z" });
    const urgent = makeReminder({ title: "B", dueAt: "2026-11-19T11:00:00Z", priority: "urgent" });
    const older = makeReminder({ title: "C", dueAt: "2026-11-18T10:00:00Z" });
    expect(dueReminders([standard, urgent, older], NOW).map((r) => r.title)).toEqual(["B", "C", "A"]);
  });

  it("drops a malformed stored row without losing the good ones", () => {
    const good = makeReminder({ title: "Good", dueAt: "2026-11-19T10:00:00Z" });
    const rows = normalizeReminders([good, { title: "" }, null, { ...good, id: "x", title: "Also good" }]);
    expect(rows.map((r) => r.title)).toEqual(["Good", "Also good"]);
  });
});
