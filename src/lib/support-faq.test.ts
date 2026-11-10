import { describe, expect, it } from "vitest";
import { SUPPORT_FAQS, SUPPORT_FAQ_INTRO, supportFaqsFor } from "./support-faq";
import { TICKET_TOPICS } from "./support-topics";

describe("support FAQs", () => {
  it("asks every question once, with a real answer", () => {
    expect(new Set(SUPPORT_FAQS.map((f) => f.q)).size).toBe(SUPPORT_FAQS.length);
    for (const f of SUPPORT_FAQS) {
      expect(f.q.length).toBeGreaterThan(3);
      expect(f.a.length).toBeGreaterThan(40);
    }
  });

  it("files every answer under a ticket area, so the form can follow it", () => {
    const areas = new Set<string>(TICKET_TOPICS.map((t) => t.area));
    for (const f of SUPPORT_FAQS) expect(areas.has(f.area)).toBe(true);
  });

  it("keeps the reply time a typical wait, never a promise", () => {
    const all = [SUPPORT_FAQ_INTRO, ...SUPPORT_FAQS.map((f) => f.a)].join(" ");
    expect(all).toMatch(/about 48 hours/);
    expect(all).not.toMatch(/within 48 hours|we will reply by|guarantee/i);
  });

  it("groups answers by area", () => {
    expect(supportFaqsFor("My Catalog").every((f) => f.area === "My Catalog")).toBe(true);
    expect(supportFaqsFor("My Catalog").length).toBeGreaterThan(0);
  });
});
