import { describe, expect, it } from "vitest";
import {
  buildCalendarFeedIcs,
  canSeeCalendarEvent,
  canSeeTaskDeadline,
  calendarViewer,
  feedWindow,
  visibleCalendarEvents,
  visibleTaskDeadlines,
  type AdminCalendarDeadline,
  type AdminCalendarEvent,
} from "./admin-calendar";
import type { StaffAccess } from "./departments";

const access = (over: Partial<StaffAccess> = {}): StaffAccess => ({
  role: "employee",
  departments: ["support"],
  canManageStaff: false,
  ...over,
});

const viewer = (over: Partial<StaffAccess> = {}, userId = "me") => calendarViewer(userId, access(over));

const event = (over: Partial<AdminCalendarEvent> = {}): AdminCalendarEvent => ({
  id: "e1",
  owner_id: "someone-else",
  department: "support",
  title: "Standup",
  notes: "",
  starts_at: "2026-11-19T14:00:00.000Z",
  ends_at: "2026-11-19T15:00:00.000Z",
  all_day: false,
  updated_at: "2026-11-18T09:00:00.000Z",
  ...over,
});

const task = (over: Partial<AdminCalendarDeadline> = {}): AdminCalendarDeadline => ({
  id: "t1",
  department: "support",
  title: "File the split sheet",
  due_at: "2026-11-20T00:00:00.000Z",
  status: "planned",
  ...over,
});

describe("Admin calendar visibility", () => {
  it("shows a department's entries to its own staff and nothing of another department's", () => {
    const support = viewer();
    const financeEvent = event({ id: "e2", department: "finance" });
    expect(canSeeCalendarEvent(event(), support)).toBe(true);
    expect(canSeeCalendarEvent(financeEvent, support)).toBe(false);
    expect(visibleCalendarEvents([event(), financeEvent], support).map((e) => e.id)).toEqual(["e1"]);
  });

  it("keeps a private entry with its owner only", () => {
    const priv = event({ id: "e3", department: null, owner_id: "someone-else" });
    const mine = event({ id: "e4", department: null, owner_id: "me" });
    expect(canSeeCalendarEvent(priv, viewer())).toBe(false);
    expect(canSeeCalendarEvent(mine, viewer())).toBe(true);
    // An entry you added stays yours even when it sits on a calendar you have since left.
    expect(canSeeCalendarEvent(event({ department: "finance", owner_id: "me" }), viewer())).toBe(true);
  });

  it("lets a department lead and a Project Manager read every team's calendar", () => {
    const financeEvent = event({ department: "finance" });
    expect(canSeeCalendarEvent(financeEvent, viewer({ role: "department_lead" }))).toBe(true);
    expect(canSeeCalendarEvent(financeEvent, viewer({ role: "project_manager", departments: [], allTeams: true }))).toBe(true);
  });

  it("keeps the launch calendar to the super admin", () => {
    const launch = event({ department: "launch" });
    expect(canSeeCalendarEvent(launch, viewer({ role: "department_lead" }))).toBe(false);
    expect(canSeeCalendarEvent(launch, viewer({ role: "project_manager", departments: [], allTeams: true }))).toBe(false);
    expect(canSeeCalendarEvent(launch, viewer({ role: "super_admin", departments: ["launch"], canManageStaff: true, allTeams: true }))).toBe(true);
  });

  it("gives deadlines to the department that owns them, and every team but launch to a Project Manager", () => {
    expect(canSeeTaskDeadline(task(), viewer())).toBe(true);
    expect(canSeeTaskDeadline(task({ department: "finance" }), viewer())).toBe(false);
    // A lead works their own bank; another department's tasks are not theirs.
    expect(canSeeTaskDeadline(task({ department: "finance" }), viewer({ role: "department_lead" }))).toBe(false);
    expect(canSeeTaskDeadline(task({ department: "finance" }), viewer({ role: "project_manager", departments: [], allTeams: true }))).toBe(true);
    expect(canSeeTaskDeadline(task({ department: "launch" }), viewer({ role: "project_manager", departments: [], allTeams: true }))).toBe(false);
    expect(visibleTaskDeadlines([task(), task({ id: "t2", department: "finance" })], viewer()).map((t) => t.id)).toEqual(["t1"]);
  });
});

describe("Personal calendar feed", () => {
  it("covers 30 days behind and a year ahead", () => {
    const { from, to } = feedWindow(new Date("2026-11-19T12:00:00.000Z"));
    expect(from).toBe("2026-10-20T12:00:00.000Z");
    expect(to).toBe("2027-11-19T12:00:00.000Z");
  });

  it("writes a timed entry, an all-day entry and an open deadline into one calendar", () => {
    const ics = buildCalendarFeedIcs({
      events: [
        event(),
        event({ id: "e2", title: "Release day", starts_at: "2026-11-20T00:00:00.000Z", ends_at: null, all_day: true }),
      ],
      deadlines: [task()],
      now: new Date("2026-11-19T12:00:00.000Z"),
      origin: "https://example.com",
    });

    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261119T140000Z");
    expect(ics).toContain("DTEND:20261119T150000Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261120");
    expect(ics).toContain("DTEND;VALUE=DATE:20261121");
    expect(ics).toContain("UID:calendar-e1@camethroughaudio.com");
    expect(ics).toContain("UID:task-t1@camethroughaudio.com");
    expect(ics).toContain("SUMMARY:Due: File the split sheet");
    expect(ics).toContain("Calendar: Support");
    expect(ics).toContain("https://example.com/admin");
  });

  it("escapes the separators and leaves finished deadlines out", () => {
    const ics = buildCalendarFeedIcs({
      events: [event({ title: "Review, splits; masters" })],
      deadlines: [task({ id: "done", status: "done" })],
      now: new Date("2026-11-19T12:00:00.000Z"),
    });
    expect(ics).toContain("SUMMARY:Review\\, splits\\; masters");
    expect(ics).not.toContain("UID:task-done@camethroughaudio.com");
  });

  it("keeps an all-day entry on the day that was picked east of Greenwich", () => {
    // Berlin is UTC+1 in November, so local midnight on the 20th is 23:00Z on the 19th: the member picked the 20th.
    const entry = event({ title: "Release day", starts_at: "2026-11-19T23:00:00.000Z", ends_at: null, all_day: true });
    const berlin = buildCalendarFeedIcs({ events: [entry], deadlines: [], now: new Date("2026-11-19T12:00:00.000Z"), timeZone: "Europe/Berlin" });
    expect(berlin).toContain("DTSTART;VALUE=DATE:20261120");
    expect(berlin).toContain("DTEND;VALUE=DATE:20261121");
    expect(berlin).toContain("X-WR-TIMEZONE:Europe/Berlin");

    // Without a zone the same row keeps the UTC reading, so the fallback is predictable rather than shifted silently.
    const utc = buildCalendarFeedIcs({ events: [entry], deadlines: [], now: new Date("2026-11-19T12:00:00.000Z"), timeZone: "UTC" });
    expect(utc).toContain("DTSTART;VALUE=DATE:20261119");
  });

  it("falls back to UTC for an unknown time zone instead of dropping the calendar", () => {
    const ics = buildCalendarFeedIcs({
      events: [event({ all_day: true, starts_at: "2026-11-20T00:00:00.000Z" })],
      deadlines: [],
      now: new Date("2026-11-19T12:00:00.000Z"),
      timeZone: "Not/AZone",
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261120");
    expect(ics).not.toContain("X-WR-TIMEZONE");
  });

  it("puts a late-evening deadline on the day the subscriber sees", () => {
    const ics = buildCalendarFeedIcs({
      events: [],
      deadlines: [task({ due_at: "2026-11-20T00:30:00.000Z" })],
      now: new Date("2026-11-19T12:00:00.000Z"),
      timeZone: "America/New_York",
    });
    expect(ics).toContain("DTSTART;VALUE=DATE:20261119");
    expect(ics).toContain("DTEND;VALUE=DATE:20261120");
  });

  it("gives an entry with no end time an hour on the calendar", () => {
    const ics = buildCalendarFeedIcs({
      events: [event({ ends_at: null })],
      deadlines: [],
      now: new Date("2026-11-19T12:00:00.000Z"),
    });
    expect(ics).toContain("DTSTART:20261119T140000Z");
    expect(ics).toContain("DTEND:20261119T150000Z");
  });
});
