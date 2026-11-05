import { describe, expect, it } from "vitest";
import { MAX_PREPAID_YEARS, canRenewEarly, withinPrepayCap, type PlanSub } from "./retention";

const now = new Date("2026-11-05T00:00:00Z");
const sub = (end: string): PlanSub => ({
  stripe_subscription_id: "sub_1",
  status: "active",
  current_period_start: "2025-11-05T00:00:00Z",
  current_period_end: end,
  cancel_at_period_end: false,
});

describe("prepay cap", () => {
  it("is five years", () => {
    expect(MAX_PREPAID_YEARS).toBe(5);
  });

  it("counts exactly five years from today as inside the cap, a day more as outside", () => {
    expect(withinPrepayCap(new Date("2031-11-05T00:00:00Z"), now)).toBe(true);
    expect(withinPrepayCap(new Date("2031-11-06T00:00:00Z"), now)).toBe(false);
  });

  it("still allows one year of early renewal at a time", () => {
    expect(canRenewEarly(sub("2027-06-01T00:00:00Z"), [], now)).toBe(true);
  });

  it("refuses early renewal when the plan is already paid more than a year ahead", () => {
    expect(canRenewEarly(sub("2028-06-01T00:00:00Z"), [], now)).toBe(false);
  });

  it("refuses early renewal on a cancelling, paused or failing plan", () => {
    expect(canRenewEarly({ ...sub("2027-06-01T00:00:00Z"), cancel_at_period_end: true }, [], now)).toBe(false);
    expect(canRenewEarly({ ...sub("2027-06-01T00:00:00Z"), status: "past_due" }, [], now)).toBe(false);
  });
});
