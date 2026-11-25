import { describe, expect, it } from "vitest";
import {
  allocationSlices,
  allocateBudget,
  blueprintOf,
  categorySpend,
  paidPlanRows,
  planFromStore,
  planStore,
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
    const slices = allocationSlices([
      { ...lines[0]!, budget: 300 },
      { ...lines[1]!, budget: 100 },
    ]);
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

describe("the plan after a refresh", () => {
  it("stores the project, the target and the edited rows, never the derived allocation", () => {
    const plan = planStore({
      kind: "merch-run",
      target: 800,
      rows: [row({ paid: true, actual: "120" })],
    });
    expect(Object.keys(plan).sort()).toEqual(["kind", "rows", "target"]);
    expect(plan.rows[0]!.paid).toBe(true);
  });

  it("restores a plan it wrote, and opens nothing when the project is unknown", () => {
    const stored = planStore({
      kind: "studio-master",
      target: 1200,
      rows: [row({ category: "Studio Time", budget: 480, paid: true, actual: "500" })],
    });
    const back = planFromStore(stored);
    expect(back?.kind).toBe("studio-master");
    expect(back?.target).toBe(1200);
    expect(back?.rows).toHaveLength(1);
    expect(back?.rows[0]).toMatchObject({ budget: 480, paid: true, actual: "500" });

    expect(planFromStore({ kind: "not-a-project", rows: [] })).toBeNull();
    expect(planFromStore(null)).toBeNull();
  });

  it("drops a row with no category and one whose id repeats", () => {
    const back = planFromStore({
      kind: "music-video",
      target: 500,
      rows: [
        { id: "same", category: "Director & Camera Operator", budget: 225 },
        { id: "same", category: "Editing & Color Grading", budget: 125 },
        { id: "no-category", budget: 20 },
      ],
    });
    expect(back?.rows).toHaveLength(1);
    expect(back?.rows[0]!.category).toBe("Director & Camera Operator");
  });

  it("hands the tax worksheet only the paid lines with money on them", () => {
    const back = planFromStore({
      kind: "music-video",
      target: 500,
      rows: [
        { id: "a", category: "Crew Essentials", budget: 25, paid: true, actual: "30" },
        { id: "b", category: "Crew Essentials", budget: 25, paid: false },
        { id: "c", category: "Crew Essentials", budget: 0, paid: true },
        { id: "d", category: "Crew Essentials", budget: 40, paid: true },
      ],
    });
    const paid = paidPlanRows(back);
    expect(paid.map((entry) => entry.id)).toEqual(["a", "d"]);
  });
});
