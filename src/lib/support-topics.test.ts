import { describe, it, expect } from "vitest";
import {
  BILLING_AREA,
  categoryFor,
  GENERAL_AREA,
  GENERAL_INQUIRIES,
  generalInquiryCategory,
  generalInquirySubject,
  TICKET_CATEGORIES,
  TICKET_TOPICS,
} from "./support-topics";

const WORKSPACE_TABS = ["Embed Metadata", "My Catalog", "Royalties and Registrations", "AI Protection Hub", "Split Sheets", "Contracts & Blueprints", "PDF Fill & Sign"];

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

describe("general inquiries (Contact Us)", () => {
  it("offers topics the ticket schema already accepts", () => {
    expect(GENERAL_INQUIRIES.length).toBeGreaterThan(0);
    for (const topic of GENERAL_INQUIRIES) expect(TICKET_CATEGORIES).toContain(generalInquiryCategory(topic));
  });

  it("stores a contact under the catch-all area, so it lands in the support queue", () => {
    expect(generalInquiryCategory("Press, partnership or licensing")).toBe(`${GENERAL_AREA} · Press, partnership or licensing`);
    expect(TICKET_TOPICS.some((t) => t.area === GENERAL_AREA)).toBe(true);
  });

  it("gives the queue a subject that says it is a contact, within the schema's limit", () => {
    expect(generalInquirySubject("Feedback or a feature request")).toBe("General inquiry · Feedback or a feature request");
    expect(generalInquirySubject("x".repeat(300)).length).toBeLessThanOrEqual(150);
  });
});
