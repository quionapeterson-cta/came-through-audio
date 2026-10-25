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

describe("plan comparison", () => {
  it("each plan includes everything below it, so the list only grows", async () => {
    const { PLAN_FEATURES, PLAN_TIERS } = await import("./plans");
    const counts = PLAN_TIERS.map((p) => PLAN_FEATURES.filter((f) => hasTier(p.tier, f.from)).length);
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    expect(counts.at(-1)).toBe(PLAN_FEATURES.length);
  });

  it("buttons follow the viewer's plan", async () => {
    const { planAction } = await import("@/components/PlanComparison");
    const { PLAN_TIERS } = await import("./plans");
    const [free, plus, collab] = PLAN_TIERS;
    const o = { onBuy: () => {}, onSignup: () => {} };
    expect(planAction(collab!, { ...o, tier: undefined }).label).toBe("Sign up now");
    expect(planAction(plus!, { ...o, tier: "plus" })).toMatchObject({ label: "Current plan", disabled: true });
    expect(planAction(free!, { ...o, tier: "plus" })).toMatchObject({ label: "Included", disabled: true });
    expect(planAction(collab!, { ...o, tier: "plus" }).label).toBe("Upgrade");
    expect(planAction(collab!, { ...o, tier: "free" }).label).toBe("Get started");
  });
});
