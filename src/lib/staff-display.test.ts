import { describe, expect, it } from "vitest";
import {
  FOUNDER_DISPLAY_NAME,
  FOUNDER_ROLE_LABEL,
  formatStaffDisplayName,
  formatStaffRoleLabel,
  founderHandoffLabel,
  staffActionLabel,
  viewerLabel,
} from "./staff-display";

describe("founder display", () => {
  it("never shows the raw super_admin token in staff-facing copy", () => {
    expect(formatStaffRoleLabel("super_admin")).toBe(FOUNDER_ROLE_LABEL);
    expect(formatStaffRoleLabel("super_admin")).not.toContain("super");
    expect(formatStaffDisplayName("super_admin", { name: "Qui-Ona Peterson" })).toBe(
      FOUNDER_DISPLAY_NAME,
    );
  });

  it("names the founder in hand-offs, actions and the viewer badge", () => {
    expect(founderHandoffLabel()).toBe("Escalated to The Founder (Mrs. Peterson)");
    expect(staffActionLabel("Approved", "super_admin")).toBe("Approved by Mrs. Peterson");
    expect(viewerLabel("super_admin")).toBe("Viewing: Mrs. Peterson");
  });

  it("keeps every other role reading as itself", () => {
    expect(formatStaffRoleLabel("department_lead")).toBe("Department Lead");
    expect(formatStaffDisplayName("employee", { name: "Dana" })).toBe("Dana");
    expect(formatStaffDisplayName("employee", { email: "dana@camethroughaudio.com" })).toBe("dana");
    expect(formatStaffDisplayName("employee", null)).toBe("Staff");
    expect(formatStaffRoleLabel(null)).toBe("Staff");
  });
});
