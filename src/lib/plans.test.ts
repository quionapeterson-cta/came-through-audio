import { describe, expect, it } from "vitest";
import { assistanceFees, assistanceItems, assistanceTotal, convertShare, hasTier, tierFromPrice } from "./plans";

describe("plans", () => {
  it("single/EP: $14.99 setup + $4.99 per song per agency", () => {
    expect(assistanceTotal("single", 3, 2)).toBe(44.93);
  });
  it("album up to 20 tracks: one $29.99 setup", () => {
    expect(assistanceTotal("album", 20, 1)).toBe(129.79);
  });
  it("21–26 tracks add a $14.99 Extended Repertoire Fee", () => {
    expect(assistanceFees("album", 21).extended).toBe(14.99);
    expect(assistanceFees("album", 26).extended).toBe(14.99);
    expect(assistanceTotal("album", 21, 1)).toBe(149.77);
  });
  it("27–40 tracks add a $29.99 Extended Repertoire Fee", () => {
    expect(assistanceFees("album", 27).extended).toBe(29.99);
    expect(assistanceFees("album", 40).extended).toBe(29.99);
  });
  it("the cycle repeats after 40 tracks", () => {
    expect(assistanceFees("album", 42).extended).toBe(44.98);
    expect(assistanceFees("album", 48).extended).toBe(59.98);
    expect(assistanceItems("album", 42, 1)).toEqual([
      { priceId: "expert_setup_album", quantity: 2 },
      { priceId: "expert_setup_single", quantity: 1 },
      { priceId: "expert_per_song_agency", quantity: 42 },
    ]);
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
