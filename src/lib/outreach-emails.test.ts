import { describe, expect, it } from "vitest";
import { outreachDraft } from "./outreach-emails";
import { COMPANY_BLUEPRINTS } from "./contract-blueprints";

const f = { name: "Sam", company: "Example Records", line: "Loved Friday's release.", demo: "Tue 1 PM", sender: "Qui-Ona Peterson" };

describe("company outreach kit", () => {
  it("drafts each email with their details, the tagline and an honest subject", () => {
    for (const kind of ["cold", "followup", "demo"] as const) {
      const d = outreachDraft(kind, f);
      expect(d.body).toContain("Hi Sam,");
      expect(d.body).toContain("Loved Friday's release.");
      expect(d.body).toContain("YOUR FIRST STOP BEFORE DISTRIBUTION");
      expect(d.subject.length).toBeLessThan(80);
    }
    expect(outreachDraft("demo", f).body).toContain("Tue 1 PM");
  });
  it("has all 8 outreach agreements as company templates", () => {
    const ids = COMPANY_BLUEPRINTS.map((b) => b.id);
    for (const id of ["company-mutual-nda", "company-referral", "company-co-marketing", "company-data-sharing", "company-sponsored-badge", "company-pilot", "company-api-integration", "company-loi"]) expect(ids).toContain(id);
  });
});
