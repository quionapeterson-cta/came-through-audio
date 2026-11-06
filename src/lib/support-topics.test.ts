import { describe, it, expect } from "vitest";
import { BILLING_AREA, categoryFor, TICKET_CATEGORIES, TICKET_TOPICS } from "./support-topics";

const WORKSPACE_TABS = ["Embed Metadata", "My Catalog", "Royalty Health Hub", "AI Protection Hub", "Split Sheets", "Contracts & Blueprints", "PDF Fill & Sign"];

describe("support topics", () => {
  it("offers every workspace tab as a first choice, plus the account side and a catch-all", () => {
    const areas = TICKET_TOPICS.map((t) => t.area);
    for (const tab of WORKSPACE_TABS) expect(areas).toContain(tab);
    expect(areas).toContain(BILLING_AREA);
    expect(areas).toContain("Something else");
  });

  it("gives every area real issues to choose from", () => {
    for (const t of TICKET_TOPICS) {
      expect(t.issues.length, t.area).toBeGreaterThanOrEqual(3);
      for (const i of t.issues) expect(i.trim().length, `${t.area} / ${i}`).toBeGreaterThan(3);
    }
  });

  it("stores one unique category per pair, so staff can tell them apart", () => {
    expect(new Set(TICKET_CATEGORIES).size).toBe(TICKET_CATEGORIES.length);
    expect(TICKET_CATEGORIES.length).toBe(TICKET_TOPICS.reduce((n, t) => n + t.issues.length, 0));
    expect(TICKET_CATEGORIES[0]).toBe(categoryFor(TICKET_TOPICS[0].area, TICKET_TOPICS[0].issues[0]));
  });

  it("no longer offers the old Royalty Help category", () => {
    expect(TICKET_CATEGORIES.some((c) => /royalty help/i.test(c))).toBe(false);
    expect(TICKET_CATEGORIES.some((c) => c.startsWith("General Inquiry"))).toBe(false);
  });
});
