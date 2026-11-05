import { describe, expect, it } from "vitest";
import { accountScope, CARD_UPDATE_STEPS, profileEditError, profilePatch } from "./member-account";
import type { StaffAccess } from "./departments";

const access = (role: StaffAccess["role"], departments: StaffAccess["departments"]): StaffAccess =>
  ({ role, departments, canManageStaff: role === "super_admin" });

describe("who may edit a member account", () => {
  it("lets support and super admins fix the person, and billing fix the card", () => {
    expect(accountScope(access("super_admin", ["support"]))).toEqual({ editProfile: true, editPayment: true, label: "Super admin" });
    expect(accountScope(access("employee", ["support"]))).toEqual({ editProfile: true, editPayment: false, label: "Support" });
    expect(accountScope(access("employee", ["billing"]))).toEqual({ editProfile: false, editPayment: true, label: "Billing" });
  });

  it("gives nobody else the tab: not HR, not a lead outside the two teams, not a member", () => {
    expect(accountScope(access("department_lead", ["marketing"]))).toBeNull();
    expect(accountScope(access("hr_admin", ["hr"]))).toBeNull();
    expect(accountScope(null)).toBeNull();
  });

  it("never offers a way to type a card number", () => {
    // The steps send the member to Stripe; staff send the link, and the card digits never reach our servers.
    expect(CARD_UPDATE_STEPS.join(" ")).toMatch(/Manage billing/);
    expect(CARD_UPDATE_STEPS.join(" ")).not.toMatch(/card number|enter the 16|CVV/i);
  });
});

describe("correcting a member's names", () => {
  it("trims what was typed and clears an emptied field", () => {
    expect(profilePatch({ stageName: "  Nina Simone ", legalName: "" })).toEqual({ stage_name: "Nina Simone", legal_name: null });
  });

  it("saves only the field that was sent", () => {
    expect(profilePatch({ legalName: "Nina Simone" })).toEqual({ legal_name: "Nina Simone" });
    expect(profilePatch({})).toEqual({});
  });

  it("refuses a stray save and an over-long name", () => {
    expect(profileEditError({})).toBe("Nothing to change.");
    expect(profileEditError({ stageName: "x".repeat(121) })).toBe("Each name is 120 characters at most.");
    expect(profileEditError({ stageName: "Nina" })).toBeNull();
  });
});
