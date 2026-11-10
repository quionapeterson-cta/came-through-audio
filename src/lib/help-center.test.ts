import { describe, expect, it } from "vitest";
import { deflectionFor, FORM_TIPS, HELP_AREAS, HELP_CATEGORIES, helpArticles, TICKET_AREA_NAMES } from "./help-center";
import { GENERAL_AREA } from "./support-topics";
import { SUPPORT_FAQS } from "./support-faq";

describe("Help Center topics", () => {
  it("points every card at areas the ticket form really offers", () => {
    for (const area of HELP_AREAS) expect(TICKET_AREA_NAMES).toContain(area);
  });

  it("gives every card answers, with no question repeated inside it", () => {
    for (const c of HELP_CATEGORIES) {
      const articles = helpArticles(c);
      expect(articles.length, c.title).toBeGreaterThan(3);
      expect(new Set(articles.map((a) => a.q)).size).toBe(articles.length);
      for (const a of articles) expect(a.a.trim().length, `${c.title} / ${a.q}`).toBeGreaterThan(40);
    }
  });

  it("uses the same four cards people were promised", () => {
    expect(HELP_CATEGORIES.map((c) => c.title)).toEqual([
      "Audio & Mastered Files",
      "Metadata & Distribution",
      "Account & Billing",
      "Royalties & Payouts",
    ]);
  });
});

describe("ticket deflection", () => {
  it("offers at most three answers, all written for the chosen area", () => {
    for (const area of TICKET_AREA_NAMES) {
      const answers = deflectionFor(area);
      expect(answers.length).toBeLessThanOrEqual(3);
      for (const a of answers) expect(a.area).toBe(area);
    }
  });

  it("has something to offer for the busiest areas", () => {
    expect(deflectionFor("Account & billing").length).toBeGreaterThan(1);
    expect(deflectionFor("My Catalog").length).toBeGreaterThan(1);
  });

  it("keeps every quick answer on the page, under a card or beside the form", () => {
    expect(FORM_TIPS.length).toBeGreaterThan(0);
    const covered = [...HELP_AREAS, GENERAL_AREA];
    for (const f of SUPPORT_FAQS) expect(covered).toContain(f.area);
  });
});
