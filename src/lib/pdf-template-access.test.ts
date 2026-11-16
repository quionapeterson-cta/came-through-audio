import { describe, expect, it } from "vitest";
import {
  canManagePdfTemplates,
  contractCardSummary,
  PDF_TEMPLATE_EDITOR_ROLES,
} from "./pdf-templates";

describe("who keeps the template library", () => {
  it("lets the four lead roles write", () => {
    for (const role of PDF_TEMPLATE_EDITOR_ROLES) {
      expect(canManagePdfTemplates({ role })).toBe(true);
    }
    expect(PDF_TEMPLATE_EDITOR_ROLES).toEqual([
      "super_admin",
      "hr_admin",
      "project_manager",
      "department_lead",
    ]);
  });

  it("keeps an employee reading, never writing", () => {
    expect(canManagePdfTemplates({ role: "employee" })).toBe(false);
  });

  it("refuses a signed-out or unknown role", () => {
    expect(canManagePdfTemplates(null)).toBe(false);
    expect(canManagePdfTemplates(undefined)).toBe(false);
    expect(canManagePdfTemplates({ role: "user" })).toBe(false);
  });

  it("prints the written card line, or says what the template is made of", () => {
    expect(contractCardSummary("Confirms volunteer hours.", 6)).toBe("Confirms volunteer hours.");
    expect(contractCardSummary("   ", 6)).toBe("Custom template · 6 blocks");
    expect(contractCardSummary(null, 1)).toBe("Custom template · 1 block");
    expect(contractCardSummary(undefined, 0)).toBe("Custom template · 0 blocks");
  });
});
