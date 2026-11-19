import { describe, expect, it } from "vitest";
import { PUBLISHED_AMOUNTS, amountProblem, usdText } from "./price-check";

describe("the published price list", () => {
  it("reads every sold lookup key from the constant that quotes it", () => {
    expect(PUBLISHED_AMOUNTS["contract_generator"]).toBe(399);
    expect(PUBLISHED_AMOUNTS["branding_yearly"]).toBe(1399);
    expect(PUBLISHED_AMOUNTS["catalog_management_yearly"]).toBe(8999);
    expect(PUBLISHED_AMOUNTS["artist_seat_management_yearly"]).toBe(6999);
    expect(PUBLISHED_AMOUNTS["ai_protection_album"]).toBe(1699);
    expect(PUBLISHED_AMOUNTS["vault_month"]).toBe(199);
    expect(PUBLISHED_AMOUNTS["expert_per_song_agency"]).toBe(499);
  });
});

describe("a Stripe price that disagrees with the site", () => {
  it("lets the published amount through", () => {
    expect(amountProblem("contract_generator", 399)).toBeNull();
    expect(amountProblem("branding_yearly", 1399)).toBeNull();
  });

  it("names the lookup key and both amounts", () => {
    const problem = amountProblem("contract_generator", 1499);
    expect(problem).toContain("contract_generator");
    expect(problem).toContain("$14.99");
    expect(problem).toContain("$3.99");
  });

  it("refuses a branding price left at the old $14.99", () => {
    expect(amountProblem("branding_yearly", 1499)).toContain("$13.99");
  });

  it("refuses a price Stripe holds no amount for", () => {
    expect(amountProblem("contract_generator", null)).toContain("no amount");
  });

  it("has no opinion about a key the site doesn't publish", () => {
    expect(amountProblem("some_future_price", 123)).toBeNull();
  });

  it("formats cents the way the site quotes dollars", () => {
    expect(usdText(399)).toBe("$3.99");
    expect(usdText(1399)).toBe("$13.99");
  });
});
