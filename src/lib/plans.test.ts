import { describe, expect, it } from "vitest";
import { assistanceItems, assistanceTotal, convertShare, hasTier, tierFromPrice } from "./plans";

describe("plans", () => {
  it("single/EP: $14.99 setup + $4.99 per song per agency", () => {
    expect(assistanceTotal("single", 3, 2)).toBe(44.93);
  });
  it("album up to 20 tracks: one $29.99 setup", () => {
    expect(assistanceTotal("album", 20, 1)).toBe(129.79);
  });
  it("album over 20 tracks adds another setup fee", () => {
    expect(assistanceTotal("album", 21, 1)).toBe(164.77);
    expect(assistanceItems("album", 21, 1)[0]).toEqual({ priceId: "expert_setup_album", quantity: 2 });
  });
  it("BMI 200% scale converts to ASCAP 100% scale", () => {
    expect(convertShare(100, "200", "100")).toBe(50);
    expect(convertShare(25, "100", "200")).toBe(50);
  });
  it("tiers unlock in order", () => {
    expect(tierFromPrice("catalog_collaborate_yearly")).toBe("collaborate");
    expect(hasTier("plus", "collaborate")).toBe(false);
    expect(hasTier("management", "collaborate")).toBe(true);
  });
});
