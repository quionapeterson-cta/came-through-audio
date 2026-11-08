import { describe, expect, it } from "vitest";
import {
  INACTIVITY_FIRST_NOTICE_DAYS,
  INACTIVITY_MONTHS,
  INACTIVITY_SIGNED_DAYS,
  SIGNED_REMINDER_DAYS,
  daysUntil,
  dueInactivityReminder,
  dueSignedReminder,
  fullySignedSheetIds,
  hasBeenActiveSince,
  inactivityDeleteOn,
  inactivityOutcome,
  noticeLine,
  signedDeleteOn,
} from "./inactivity";

const now = new Date("2026-11-08T00:00:00Z");

describe("two years of inactivity", () => {
  it("deletes two years after the last activity", () => {
    expect(inactivityDeleteOn("2025-06-01T00:00:00Z", now).toISOString()).toBe("2027-06-01T00:00:00.000Z");
    expect(INACTIVITY_MONTHS).toBe(24);
  });

  it("never gives less than the first notice, even to an account already dormant", () => {
    const already = inactivityDeleteOn("2020-01-01T00:00:00Z", now);
    expect(daysUntil(already, now)).toBe(INACTIVITY_FIRST_NOTICE_DAYS);
  });

  it("notices a sign-in after the schedule was written, which saves the account but not the files", () => {
    const row = { last_active_at: "2024-01-01T00:00:00Z" };
    expect(hasBeenActiveSince(row, "2024-01-01T00:00:00Z")).toBe(false);
    expect(hasBeenActiveSince(row, "2026-11-01T00:00:00Z")).toBe(true);
    expect(hasBeenActiveSince(row, null)).toBe(false);
  });

  it("removes everything only when nobody signed in during the notice", () => {
    expect(inactivityOutcome(true)).toBe("catalog");
    expect(inactivityOutcome(false)).toBe("account");
  });
});

describe("reminders before deletion", () => {
  const row = (deleteOn: string, reminders: string[] = []) => ({ delete_on: deleteOn, reminders });

  it("sends 60, 30, 7 and 1 days out, once each", () => {
    const d = "2027-01-07T00:00:00Z";
    expect(dueInactivityReminder(row(d), new Date("2026-11-08T00:00:00Z"))).toBe("60");
    expect(dueInactivityReminder(row(d, ["60"]), new Date("2026-12-08T00:00:00Z"))).toBe("30");
    expect(dueInactivityReminder(row(d, ["60", "30"]), new Date("2026-12-31T00:00:00Z"))).toBe("7");
    expect(dueInactivityReminder(row(d, ["60", "30", "7"]), new Date("2027-01-06T00:00:00Z"))).toBe("1");
  });

  it("does not repeat a reminder, and stays quiet once the date has passed", () => {
    const d = "2027-01-07T00:00:00Z";
    expect(dueInactivityReminder(row(d, ["60"]), new Date("2026-11-08T00:00:00Z"))).toBeNull();
    expect(dueInactivityReminder(row("2026-11-01T00:00:00Z", []), now)).toBeNull();
  });

  it("names the time left in words", () => {
    expect(noticeLine("2027-01-07T00:00:00Z", new Date("2026-11-08T00:00:00Z"))).toBe("60 days");
    expect(noticeLine("2026-11-09T00:00:00Z", now)).toBe("last day");
  });
});

describe("the signed paperwork window", () => {
  it("opens 30 days after the files came off", () => {
    expect(signedDeleteOn("2027-01-07T00:00:00Z").toISOString()).toBe("2027-02-06T00:00:00.000Z");
    expect(INACTIVITY_SIGNED_DAYS).toBe(30);
    expect(SIGNED_REMINDER_DAYS).toEqual([30, 14, 7, 1]);
  });

  it("sends 30, 14, 7 and 1 days out, once each", () => {
    const row = (signed: string | null, sent: string[] = []) => ({ signed_delete_on: signed, signed_reminders: sent });
    const d = "2027-02-06T00:00:00Z";
    expect(dueSignedReminder(row(d), new Date("2027-01-07T00:00:00Z"))).toBe("30");
    expect(dueSignedReminder(row(d, ["30"]), new Date("2027-01-23T00:00:00Z"))).toBe("14");
    expect(dueSignedReminder(row(d, ["30", "14"]), new Date("2027-01-30T00:00:00Z"))).toBe("7");
    expect(dueSignedReminder(row(d, ["30", "14", "7"]), new Date("2027-02-05T00:00:00Z"))).toBe("1");
  });

  it("stays quiet with no window, after a reminder, and once the date has passed", () => {
    expect(dueSignedReminder({ signed_delete_on: null, signed_reminders: [] }, now)).toBeNull();
    expect(dueSignedReminder({ signed_delete_on: "2027-01-07T00:00:00Z", signed_reminders: ["30"] }, now)).toBeNull();
    expect(dueSignedReminder({ signed_delete_on: "2026-11-01T00:00:00Z", signed_reminders: [] }, now)).toBeNull();
  });

  it("counts only a sheet everyone signed, even after its song is gone", () => {
    const rows = [
      { id: "a1", catalog_id: null, track_title: "Song", isrc: "US1", signed_at: "2026-01-01T00:00:00Z" },
      { id: "a2", catalog_id: null, track_title: "Song", isrc: "US1", signed_at: "2026-01-02T00:00:00Z" },
      { id: "b1", catalog_id: "song-2", track_title: "Other", isrc: null, signed_at: "2026-01-01T00:00:00Z" },
      { id: "b2", catalog_id: "song-2", track_title: "Other", isrc: null, signed_at: null },
    ];
    expect(fullySignedSheetIds(rows)).toEqual(["a1", "a2"]);
    expect(fullySignedSheetIds([])).toEqual([]);
  });
});
