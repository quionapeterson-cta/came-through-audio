import { describe, expect, it } from "vitest";
import { rateWarning, territoryBlend, territoryShares } from "./royalty-calc";

describe("rate guard", () => {
  it("stays quiet on a published rate and on zero", () => {
    expect(rateWarning("audiomack", 0.004)).toBeNull();
    expect(rateWarning("spotify", 0.004)).toBeNull();
    expect(rateWarning("tiktok", 0)).toBeNull();
  });

  it("speaks up when the typed rate leaves the cited range", () => {
    expect(rateWarning("audiomack", 0.045)?.message).toContain("$0.0010–$0.0050");
    expect(rateWarning("soundcloud", 0.03)?.message).toContain("$0.0025–$0.004");
  });

  it("suggests the published rate when a decimal slipped", () => {
    expect(rateWarning("spotify", 0.042)?.fix).toBeCloseTo(0.004, 6);
    expect(rateWarning("spotify", 0.06)?.fix).toBeUndefined();
    expect(rateWarning("spotify", 0.039)).toBeNull();
  });
});

describe("listener mix", () => {
  it("treats a single region as its own multiplier", () => {
    expect(territoryBlend({ us: "100" })).toBeCloseTo(1, 6);
    expect(territoryBlend({ ng: "100" })).toBeCloseTo(0.3, 6);
  });

  it("normalizes shares that do not add to 100", () => {
    expect(territoryBlend({ us: "50", ng: "50" })).toBeCloseTo(0.65, 6);
    expect(territoryBlend({ us: "50" })).toBeCloseTo(1, 6);
    expect(territoryShares({ us: "50", uk: "25" })).toBe(75);
  });

  it("is a no-op when nothing is entered", () => {
    expect(territoryBlend({})).toBe(1);
  });
});
