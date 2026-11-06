import { describe, expect, it } from "vitest";
import { checklistProgress, isEmptyEntry, progressLabel, savedGuides, sortByProgress, toggleChecked, workingOnCount, type WorkbenchEntry } from "./workbench";

const list = ["A", "B", "C", "D", "E", "F", "G", "H"];

describe("checklistProgress", () => {
  it("counts ticked out of total with a rounded percent", () => {
    const p = checklistProgress(list, ["A", "B", "C"]);
    expect(p).toEqual({ done: 3, total: 8, pct: 38, started: true, finished: false });
    expect(progressLabel(p)).toBe("3 of 8 · 38%");
  });

  it("is finished only when every item is ticked", () => {
    expect(checklistProgress(list, list).finished).toBe(true);
    expect(checklistProgress(list, list.slice(1)).finished).toBe(false);
  });

  it("ignores ticks on wording that is no longer on the checklist", () => {
    expect(checklistProgress(["A", "B"], ["A", "Old wording"]).done).toBe(1);
  });

  it("is 0, not NaN, with no checklist", () => {
    expect(checklistProgress(undefined, ["A"])).toEqual({ done: 0, total: 0, pct: 0, started: false, finished: false });
  });
});

describe("toggleChecked", () => {
  const blank: WorkbenchEntry = { kind: "blueprint", itemId: "x", checked: [], pinned: false };

  it("saves a blueprint to Working On on the first tick", () => {
    expect(toggleChecked(blank, "A")).toMatchObject({ checked: ["A"], pinned: true });
  });

  it("does not re-save one the member removed", () => {
    const removed = { ...blank, checked: ["A"], pinned: false };
    expect(toggleChecked(removed, "B").pinned).toBe(false);
  });

  it("unticks, and an unpinned row with nothing ticked is empty", () => {
    const next = toggleChecked({ ...blank, checked: ["A"] }, "A");
    expect(next.checked).toEqual([]);
    expect(isEmptyEntry(next)).toBe(true);
    expect(isEmptyEntry({ checked: [], pinned: true })).toBe(false);
  });
});

describe("sortByProgress", () => {
  it("puts in-progress first and finished after, each alphabetical", () => {
    const p = (done: number) => checklistProgress(["A", "B"], ["A", "B"].slice(0, done));
    const { inProgress, finished } = sortByProgress([
      { title: "Zed", progress: p(1) }, { title: "Alpha", progress: p(2) }, { title: "Beta", progress: p(0) }, { title: "Aardvark", progress: p(2) },
    ]);
    expect(inProgress.map((x) => x.title)).toEqual(["Beta", "Zed"]);
    expect(finished.map((x) => x.title)).toEqual(["Aardvark", "Alpha"]);
  });
});

describe("savedGuides and workingOnCount", () => {
  it("lists saved blueprints and counts what is still in progress", () => {
    const entries = [
      { kind: "blueprint" as const, itemId: "music-business-startup", checked: ["Name checked"], pinned: true },
      { kind: "blueprint" as const, itemId: "record-label", checked: ["Label purpose decided"], pinned: false },
    ];
    expect(savedGuides(entries).map((x) => x.guide.id)).toEqual(["music-business-startup"]);
    expect(workingOnCount(entries, [{ status: "draft" }, { status: "signed" }])).toBe(2);
  });
});
