import { describe, expect, it } from "vitest";
import {
  ALBUM_SONGS, memberEmailProblem, registrationBatchAllowed, staffPlanActive, staffPlanLabel, staffPlanWindow,
  STAFF_AI_CREDITS, STAFF_PLAN_TIER, STAFF_REGISTRATION_CREDITS,
} from "./staff-plan";

describe("staff plan", () => {
  it("is the management tier, with an album of AI credits and two albums of registrations", () => {
    expect(STAFF_PLAN_TIER).toBe("management");
    expect(ALBUM_SONGS).toBe(12); // the Album package's own size, not a new number
    expect(STAFF_AI_CREDITS).toBe(12);
    expect(STAFF_REGISTRATION_CREDITS).toBe(24);
  });

  it("lets a paying member finish their paid year and counts the staff year from that cycle", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    const w = staffPlanWindow({ cycleStart: "2026-05-01T00:00:00Z", cycleEnd: "2027-05-01T00:00:00Z" }, now);
    expect(w.fromPaidPlan).toBe(true);
    expect(w.startsAt).toBe("2027-05-01T00:00:00.000Z");
    expect(w.endsAt).toBe("2027-05-01T00:00:00.000Z"); // never shorter than the paid time
  });

  it("runs twelve months from today when there is no paid plan", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    const w = staffPlanWindow({}, now);
    expect(w.fromPaidPlan).toBe(false);
    expect(w.startsAt).toBe(now.toISOString());
    expect(w.endsAt).toBe("2027-11-05T12:00:00.000Z");
  });

  it("gives a year from the cycle start when the paid period is shorter than that", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    const w = staffPlanWindow({ cycleStart: "2026-09-01T00:00:00Z", cycleEnd: "2026-12-01T00:00:00Z" }, now);
    expect(w.startsAt).toBe("2026-12-01T00:00:00.000Z");
    expect(w.endsAt).toBe("2027-09-01T00:00:00.000Z");
  });

  it("is active only inside its window, and only while not ended", () => {
    const grant = { starts_at: "2026-01-01T00:00:00Z", ends_at: "2027-01-01T00:00:00Z" };
    expect(staffPlanActive(grant, new Date("2026-06-01T00:00:00Z"))).toBe(true);
    expect(staffPlanActive(grant, new Date("2025-06-01T00:00:00Z"))).toBe(false);
    expect(staffPlanActive(grant, new Date("2027-06-01T00:00:00Z"))).toBe(false);
    expect(staffPlanActive({ ...grant, ended_at: "2026-07-01T00:00:00Z" }, new Date("2026-06-01T00:00:00Z"))).toBe(false);
    expect(staffPlanActive(null)).toBe(false);
  });

  it("never lets a registration batch go over one album", () => {
    expect(registrationBatchAllowed(24)).toBe(12);
    expect(registrationBatchAllowed(5)).toBe(5);
    expect(registrationBatchAllowed(0)).toBe(0);
  });

  it("describes the grant without promising a plan beyond it", () => {
    expect(staffPlanLabel(null)).toBe("No staff plan yet.");
    expect(staffPlanLabel({ starts_at: "2027-05-01T00:00:00Z", ends_at: "2027-05-01T00:00:00Z" }, new Date("2026-11-05T00:00:00Z")))
      .toMatch(/when the paid plan ends/);
  });

  it("refuses an unrecognised or already-linked address", () => {
    expect(memberEmailProblem("nope", false)).toMatch(/account you already use/);
    expect(memberEmailProblem("me@example.com", true)).toMatch(/already marked/);
    expect(memberEmailProblem("me@example.com", false)).toBeNull();
  });
});
