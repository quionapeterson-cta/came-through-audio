import { describe, expect, it } from "vitest";
import { PUBLISHED_AMOUNTS } from "./price-check";
import { soldPrices, stripeLookupKeyText } from "./price-list";

describe("the copy-paste lookup key list", () => {
  it("lists every sold price once", () => {
    const keys = soldPrices().map((row) => row.lookupKey);
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only lists keys the checkout guard has a published amount for", () => {
    for (const row of soldPrices())
      expect(PUBLISHED_AMOUNTS[row.lookupKey], row.lookupKey).toBeDefined();
  });

  it("states the type each price must be created with", () => {
    const text = stripeLookupKeyText();
    expect(text).toMatch(/branding_yearly\s+\$13\.99\s+yearly subscription/);
    expect(text).toMatch(/contract_generator\s+\$3\.99\s+one-time/);
    expect(text).toMatch(/catalog_management_yearly\s+\$89\.99\/yr\s+yearly subscription/);
    expect(text).toMatch(/artist_seat_management_yearly\s+\$69\.99\/yr\s+yearly subscription/);
    // The pause fee is the one monthly subscription on the list (founder, 2026-11-20).
    expect(text).toMatch(/vault_month\s+\$1\.99 \/ month\s+monthly subscription/);
  });

  it("puts each key on exactly one line", () => {
    const lines = stripeLookupKeyText().split("\n");
    for (const row of soldPrices()) {
      expect(
        lines.filter((line) => line.startsWith(row.lookupKey)),
        row.lookupKey,
      ).toHaveLength(1);
    }
  });
});
