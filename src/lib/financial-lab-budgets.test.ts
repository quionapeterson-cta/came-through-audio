import { describe, expect, it } from "vitest";
import {
  allocationSlices,
  allocateBudget,
  blueprintOf,
  categorySpend,
  type ExpenseRow,
} from "./financial-lab-budgets";

const row = (over: Partial<ExpenseRow>): ExpenseRow => ({
  id: Math.random().toString(36),
  category: "Studio Time",
  item: "",
  budget: 100,
  actual: "",
  paid: false,
  ...over,
});

describe("allocation ring", () => {
  it("turns a generated allocation into slices that fill the ring", () => {
    const lines = allocateBudget(500, blueprintOf("music-video"));
    const slices = allocationSlices(lines);
    expect(slices.map((slice) => slice.percent)).toEqual([45, 25, 15, 10, 5]);
    expect(slices.reduce((sum, slice) => sum + slice.budget, 0)).toBe(500);
    expect(slices[0]!.start).toBe(0);
    expect(slices[0]!.end).toBeCloseTo(0.45, 9);
    expect(slices.at(-1)!.end).toBeCloseTo(1, 9);
  });

  it("follows a typed line budget rather than the blueprint's percentage", () => {
    const lines = allocateBudget(100, blueprintOf("music-video"));
    const slices = allocationSlices([{ ...lines[0]!, budget: 300 }, { ...lines[1]!, budget: 100 }]);
    expect(slices[0]!.percent).toBe(75);
    expect(slices[1]!.percent).toBe(25);
  });

  it("leaves every slice empty when nothing is allocated", () => {
    const lines = allocateBudget(0, blueprintOf("music-video"));
    const slices = allocationSlices(lines);
    expect(slices.every((slice) => slice.budget === 0 && slice.percent === 0)).toBe(true);
    expect(slices.every((slice) => slice.start === 0 && slice.end === 0)).toBe(true);
  });
});

describe("planned against paid", () => {
  it("adds rows that share a category into one pair", () => {
    const groups = categorySpend([
      row({ budget: 100, paid: true, actual: "80" }),
      row({ budget: 50, paid: true, actual: "70" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.planned).toBe(150);
    expect(groups[0]!.spent).toBe(150);
    expect(groups[0]!.over).toBe(0);
  });

  it("flags only the money paid past the plan", () => {
    const [group] = categorySpend([row({ budget: 100, paid: true, actual: "140" })]);
    expect(group!.spent).toBe(140);
    expect(group!.over).toBe(40);
  });

  it("uses the budgeted amount for a paid line with no actual typed", () => {
    const [group] = categorySpend([row({ budget: 120, paid: true, actual: "" })]);
    expect(group!.spent).toBe(120);
    expect(group!.over).toBe(0);
  });

  it("keeps an unpaid line at zero spent, and hides an empty custom row", () => {
    const groups = categorySpend([
      row({ category: "Lighting", budget: 90, paid: false }),
      row({ category: "Custom", budget: 0, paid: false, custom: true }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.label).toBe("Lighting");
    expect(groups[0]!.spent).toBe(0);
  });
});
