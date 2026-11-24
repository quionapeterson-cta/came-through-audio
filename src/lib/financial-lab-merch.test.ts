import { describe, expect, it } from "vitest";
import { breakevenChart } from "./financial-lab-merch";

describe("breakeven chart", () => {
  it("draws the run's cost as the flat line and reaches the crossing", () => {
    const chart = breakevenChart({ quantity: 50, unitCost: 9, price: 30 });
    expect(chart).toEqual({ upto: 50, top: 1500, upfront: 450, breakevenUnits: 15 });
  });

  it("extends the axis past the run when the run alone cannot recover the cost", () => {
    const chart = breakevenChart({ quantity: 10, unitCost: 10, price: 5 });
    expect(chart?.breakevenUnits).toBe(20);
    expect(chart?.upto).toBe(20);
    expect(chart?.upfront).toBe(100);
  });

  it("owns no crossing without a price or without a cost", () => {
    expect(breakevenChart({ quantity: 50, unitCost: 9, price: 0 })).toBeNull();
    expect(breakevenChart({ quantity: 50, unitCost: 0, price: 30 })).toBeNull();
    expect(breakevenChart({ quantity: 0, unitCost: 9, price: 30 })).toBeNull();
  });

  it("keeps a free run off the axis so the chart never divides by zero", () => {
    const chart = breakevenChart({ quantity: 20, unitCost: 0, price: 10 });
    expect(chart).toBeNull();
  });
});
