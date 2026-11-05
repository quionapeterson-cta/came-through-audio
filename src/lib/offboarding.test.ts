import { describe, expect, it } from "vitest";
import { dueDepartureReminder, departureOn, keepsAccountOnPayment, leftWithinProbation, planRecycles } from "./offboarding";

const now = new Date("2026-11-05T12:00:00Z");

describe("offboarding", () => {
  it("counts a long-serving employee as beyond probation, an early leaver as inside it", () => {
    expect(leftWithinProbation("2026-08-20T00:00:00Z", "2026-11-01T00:00:00Z")).toBe(true);
    expect(leftWithinProbation("2026-01-01T00:00:00Z", "2026-11-01T00:00:00Z")).toBe(false);
  });

  it("ends access immediately and deletes 30 days later for an early leaver", () => {
    const d = departureOn("2026-08-20T00:00:00Z", "2026-11-01T00:00:00Z", now);
    expect(d.immediate).toBe(true);
    expect(d.accessEndsAt).toBe(now.toISOString());
    expect(d.deleteOn).toBe("2026-12-05T12:00:00.000Z");
  });

  it("schedules nothing for someone past 90 days: that policy is undecided", () => {
    const d = departureOn("2026-01-01T00:00:00Z", "2026-11-01T00:00:00Z", now);
    expect(d.immediate).toBe(false);
    expect(d.accessEndsAt).toBe("2026-11-01T00:00:00.000Z");
    expect(d.deleteOn).toBeNull();
  });

  it("sends the ended email first, then the week-before reminder once", () => {
    const row = { access_ended_at: "2026-11-05T12:00:00Z", delete_on: "2026-12-05T12:00:00Z", reminders: [] as string[] };
    expect(dueDepartureReminder(row, now)).toBe("ended");
    expect(dueDepartureReminder({ ...row, reminders: ["ended"] }, now)).toBeNull();
    expect(dueDepartureReminder({ ...row, reminders: ["ended"] }, new Date("2026-12-01T12:00:00Z"))).toBe("7");
    expect(dueDepartureReminder({ ...row, reminders: ["ended", "7"] }, new Date("2026-12-01T12:00:00Z"))).toBeNull();
    expect(dueDepartureReminder({ ...row, reminders: ["ended"] }, new Date("2026-12-06T12:00:00Z"))).toBeNull();
  });

  it("stops the deletion for anyone who pays, and recycles the plan past 90 days", () => {
    expect(keepsAccountOnPayment("plus")).toBe(true);
    expect(keepsAccountOnPayment("management")).toBe(true);
    expect(keepsAccountOnPayment("free")).toBe(false);
    expect(planRecycles(true)).toBe(false); // an early leaver's plan ends, it doesn't recycle
    expect(planRecycles(false)).toBe(true); // a longer-serving leaver is billed normally, never deleted
  });

  it("sends nothing when no deletion is scheduled", () => {
    expect(dueDepartureReminder({ access_ended_at: "2026-11-05T12:00:00Z", delete_on: null, reminders: [] }, now)).toBeNull();
  });
});
