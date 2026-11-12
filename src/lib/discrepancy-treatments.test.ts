import { describe, it, expect } from "vitest";
import { TREATMENTS, fixesFor, nameFromIssue, treatmentForIssue } from "@/lib/discrepancy-treatments";

/** Every difference the comparison found is listed with the rule that fixes it, never only the headline one. */
describe("difference treatments", () => {
  it("gives each issue on one recording its own treatment and fix", () => {
    const issues = [
      "The agency has ISRC US-CTA-16-00001, your catalog has US-CTA-26-00111",
      "The agency has ISWC T-123.456.789-0, your catalog has none",
      "Ann Lee isn't on the agency's registration",
      "Ann Lee's share is 60% there, 50% here",
    ];
    const fixes = fixesFor(issues, { catalogIsrc: "US-CTA-26-00111", agencyIsrc: "US-CTA-16-00001" });
    expect(fixes.map((f) => f.treatment)).toEqual([
      TREATMENTS.checkDistributor, TREATMENTS.iswc, TREATMENTS.writerAtAgency, TREATMENTS.share,
    ]);
    expect(fixes[2]!.text).toContain("Ann Lee");
    expect(fixes[2]!.headline).toContain("Ann Lee");
    expect(fixes.every((f) => !f.headline.includes("{") && !f.text.includes("{"))).toBe(true);
    expect(fixes.every((f) => f.code === "US-CTA-16-00001")).toBe(true);
  });

  it("names the writer an issue is about, so the fix says who to change", () => {
    expect(nameFromIssue("Kim Roe's IPI is 00123456789 there, 00123456780 here")).toBe("Kim Roe");
    expect(nameFromIssue("The agency lists Sam Poe, who isn't in your catalog")).toBe("Sam Poe");
    expect(nameFromIssue("The agency has ISRC US-CTA-16-00001, your catalog has none")).toBe("");
  });

  it("lists a repeated difference once", () => {
    expect(fixesFor(["Not on the BMI list", "Not on the BMI list"], { catalogIsrc: "", agencyIsrc: "" })).toHaveLength(1);
  });

  it("treats a song the agency does not list as a submission", () => {
    expect(treatmentForIssue("Not on the SoundExchange list", { catalogIsrc: "US-CTA-26-00001", agencyIsrc: "" })).toBe(TREATMENTS.submit);
  });

  it("offers the agency's code when the catalog has none", () => {
    expect(treatmentForIssue("The agency has ISRC US-CTA-16-00001, your catalog has none", { catalogIsrc: "", agencyIsrc: "US-CTA-16-00001" })).toBe(TREATMENTS.adoptAgency);
  });
});
