import { describe, expect, it } from "vitest";
import { BETA_ITEMS, betaItemsFor } from "./beta";
import { blueprintById, renderContract, initialFields } from "./contract-blueprints";

describe("beta testing", () => {
  it("gives each plan its own items plus every plan below it, with unique ids", () => {
    expect(new Set(BETA_ITEMS.map((i) => i.id)).size).toBe(BETA_ITEMS.length);
    const free = betaItemsFor("free"), plus = betaItemsFor("plus"), mgmt = betaItemsFor("management");
    expect(free.every((i) => i.tier === "free")).toBe(true);
    expect(plus.length).toBeGreaterThan(free.length);
    expect(mgmt).toHaveLength(BETA_ITEMS.length);
    // Each paid plan checks that the next plan up stays locked.
    expect(BETA_ITEMS.filter((i) => i.id.endsWith("-locks")).map((i) => i.tier)).toEqual(["free", "plus", "collaborate"]);
  });
  it("has a Beta Tester Agreement under Georgia law with the beta dates and lifetime plan filled in", () => {
    const bp = blueprintById("company-beta-agreement")!;
    const text = renderContract(bp, initialFields(bp), [{ role: "Company", legalName: "Qui-Ona Peterson" }, { role: "Participant", legalName: "Jordan Lee" }]);
    expect(text).toContain("Came Through Audio, LLC");
    expect(text).toContain("November 9 to November 26, 2026");
    expect(text).toContain("lifetime access to the Catalog Management plan");
    expect(text).toContain("the State of Georgia");
    expect(text).not.toMatch(/\{\{/);
  });
});
