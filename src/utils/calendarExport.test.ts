import { describe, expect, it } from "vitest";
import { buildReminderIcs, googleCalendarUrl } from "@/utils/calendarExport";
import { makeReminder } from "@/lib/workspace-reminders";

const reminder = makeReminder({
  title: "Send stems, please; today",
  note: "Mixing engineer: Jordan",
  dueAt: "2026-11-25T15:00:00Z",
  href: "/workspace?tab=catalog&songId=s1&focusField=iswc",
});
const NOW = new Date("2026-11-19T12:00:00Z");

describe("calendar export", () => {
  it("writes a valid calendar file with both alerts and the return link", () => {
    const ics = buildReminderIcs(reminder, "https://example.test", NOW).replace(/\r\n /g, "");
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2);
    expect(ics).toContain("TRIGGER:-PT15M");
    expect(ics).toContain("TRIGGER:PT0M");
    expect(ics).toContain("SUMMARY:💎 Came Through Audio: Send stems\\, please\\; today");
    expect(ics).toContain("https://example.test/workspace?tab=catalog&songId=s1&focusField=iswc");
    expect(ics).toContain("DTSTART:20261125T150000Z");
    expect(ics).toContain("DTEND:20261125T153000Z");
  });

  it("opens a pre-filled Google Calendar event", () => {
    const url = googleCalendarUrl(reminder, "https://example.test");
    expect(url).toContain("calendar.google.com/calendar/render");
    const params = new URL(url).searchParams;
    expect(params.get("action")).toBe("TEMPLATE");
    expect(params.get("text")).toBe("💎 Came Through Audio: Send stems, please; today");
    expect(params.get("details")).toContain("https://example.test/workspace?tab=catalog&songId=s1&focusField=iswc");
  });
});
