import { describe, expect, it } from "vitest";
import { mayApproveBadgeArt } from "@/lib/badge-protocol";

/** Nobody, before each case says otherwise; the seat is claimed, so a super admin alone cannot decide. */
const nobody = { founder: false, brandingLead: false, superAdmin: false, seatClaimed: true };

describe("who may approve a badge idea", () => {
  it("is the founder's account", () => {
    expect(mayApproveBadgeArt({ ...nobody, founder: true })).toBe(true);
  });

  it("is the Branding department lead, so a decision never waits on one person (founder, 2026-11-08)", () => {
    expect(mayApproveBadgeArt({ ...nobody, brandingLead: true })).toBe(true);
  });

  it("is nobody else: not a plain branding employee, not another department's lead", () => {
    // The caller only sets `brandingLead` for a department_lead holding branding, so an employee, a Marketing lead or an
    // HR lead all arrive here as false and are refused.
    expect(mayApproveBadgeArt(nobody)).toBe(false);
  });

  it("lets a super admin decide only until the founder seat is claimed", () => {
    expect(mayApproveBadgeArt({ ...nobody, superAdmin: true, seatClaimed: false })).toBe(true);
    expect(mayApproveBadgeArt({ ...nobody, superAdmin: true, seatClaimed: true })).toBe(false);
  });
});
