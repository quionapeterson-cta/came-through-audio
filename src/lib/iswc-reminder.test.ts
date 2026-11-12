import { describe, expect, it } from "vitest";
import { iswcReminder, nextDay } from "@/lib/iswc-reminder";

describe("iswc reminder", () => {
  it("makes no reminder until a real day is picked", () => {
    expect(iswcReminder("", "Therapy")).toBeNull();
    expect(iswcReminder("2027-1-5", "Therapy")).toBeNull();
    expect(iswcReminder("soon", "Therapy")).toBeNull();
  });

  it("covers the picked day and the next, in both calendar forms", () => {
    const r = iswcReminder("2027-01-15", "Therapy", "https://example.test")!;
    expect(nextDay("2027-01-15")).toBe("2027-01-16");
    expect(r.google).toContain("dates=20270115%2F20270116");
    expect(r.google).toContain("calendar.google.com");
    expect(r.ics).toContain("DTSTART;VALUE=DATE:20270115");
    expect(r.ics).toContain("DTEND;VALUE=DATE:20270116");
    // The song is named, so a member with several waiting never gets an anonymous reminder.
    expect(r.ics).toContain("Therapy");
    expect(r.google).toContain("https%3A%2F%2Fexample.test%2Fworkspace");
  });

  it("rolls over a month and a year", () => {
    expect(nextDay("2027-01-31")).toBe("2027-02-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
  });
});
