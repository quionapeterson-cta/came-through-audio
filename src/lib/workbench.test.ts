import { describe, expect, it } from "vitest";
import { GUIDES } from "./guides";
import { checklistProgress, customItems, defaultsFinished, dueLabel, guideIdOf, isEmptyEntry, isOverdue, metaFor, nextDue, nextRunId, nextStep, progressLabel, runId, runOf, savedGuides, sortByProgress, toggleChecked, withCustomItem, withMeta, workingOnCount, type WorkbenchEntry } from "./workbench";

const list = ["A", "B", "C", "D", "E", "F", "G", "H"];

describe("working the same blueprint again", () => {
  const guide = GUIDES.find((g) => (g.checklist?.length ?? 0) > 0)!;
  const saved = (itemId: string, checked: string[] = []): WorkbenchEntry => ({ kind: "blueprint", itemId, checked, pinned: true });

  it("names the first run with the guide id and numbers the rest", () => {
    expect(runId(guide.id, 1)).toBe(guide.id);
    expect(runId(guide.id, 2)).toBe(`${guide.id}~2`);
    expect(guideIdOf(`${guide.id}~3`)).toBe(guide.id);
    expect(runOf(`${guide.id}~3`)).toBe(3);
    expect(runOf(guide.id)).toBe(1);
  });

  it("starts the next run after the last one, whatever was skipped", () => {
    expect(nextRunId([], guide.id)).toBe(guide.id);
    expect(nextRunId([saved(guide.id)], guide.id)).toBe(`${guide.id}~2`);
    expect(nextRunId([saved(guide.id), saved(`${guide.id}~2`)], guide.id)).toBe(`${guide.id}~3`);
  });

  it("lifts the defaults sky only when both profile blueprints have a finished run", () => {
    const embed = GUIDES.find((g) => g.id === "embed-defaults")!;
    const catalog = GUIDES.find((g) => g.id === "catalog-defaults")!;
    const row = (itemId: string, checked: string[]): WorkbenchEntry => ({ kind: "blueprint", itemId, checked, pinned: true });
    expect(defaultsFinished([])).toBe(false);
    expect(defaultsFinished([row(embed.id, embed.checklist!)])).toBe(false);
    // Half of the other one is not finished, and a finished earlier run still counts.
    expect(defaultsFinished([row(embed.id, embed.checklist!), row(catalog.id, catalog.checklist!.slice(1))])).toBe(false);
    expect(defaultsFinished([row(catalog.id, catalog.checklist!), row(`${embed.id}~2`, embed.checklist!)])).toBe(true);
  });

  it("keeps every saved run as its own record, named by run", () => {
    const rows = savedGuides([saved(guide.id, guide.checklist!), saved(`${guide.id}~2`, guide.checklist!.slice(1))]);
    expect(rows.map((r) => [r.itemId, r.run, r.progress.finished])).toEqual([[guide.id, 1, true], [`${guide.id}~2`, 2, false]]);
    expect(rows[1]!.title).toBe(`${guide.title} · Run 2`);
  });
});

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

  it("leaves Working On alone when an item is ticked", () => {
    expect(toggleChecked(blank, "A")).toMatchObject({ checked: ["A"], pinned: false });
  });

  it("keeps a blueprint the member saved, and one they removed stays removed", () => {
    expect(toggleChecked({ ...blank, pinned: true }, "A").pinned).toBe(true);
    expect(toggleChecked({ ...blank, checked: ["A"], pinned: false }, "B").pinned).toBe(false);
  });

  it("unticks, and an unpinned row with nothing ticked is empty", () => {
    const next = toggleChecked({ ...blank, checked: ["A"] }, "A");
    expect(next.checked).toEqual([]);
    expect(isEmptyEntry(next)).toBe(true);
    expect(isEmptyEntry({ checked: [], pinned: true })).toBe(false);
  });
});

describe("notes and due dates", () => {
  const blank: WorkbenchEntry = { kind: "blueprint", itemId: "x", checked: [], pinned: false };

  it("keeps a note and a real date, and drops a malformed one", () => {
    const noted = withMeta(blank, "A", { note: "  Ask the accountant  ", due: "2026-11-12" });
    expect(metaFor(noted, "A")).toEqual({ note: "Ask the accountant", due: "2026-11-12" });
    expect(metaFor(withMeta(blank, "A", { due: "next week" }), "A")).toEqual({});
  });

  it("clearing both leaves nothing behind", () => {
    const noted = withMeta(blank, "A", { note: "x", due: "2026-11-12" });
    const cleared = withMeta(noted, "A", { note: "", due: "" });
    expect(cleared.meta).toEqual({});
    expect(isEmptyEntry(cleared)).toBe(true);
  });

  it("keeps an annotated row even with no ticks and no save", () => {
    expect(isEmptyEntry(withMeta(blank, "A", { note: "later" }))).toBe(false);
  });

  it("reads the soonest open due date only", () => {
    const entry = withMeta(withMeta({ ...blank, checked: ["A"] }, "A", { due: "2026-11-01" }), "B", { due: "2026-11-20" });
    expect(nextDue(entry, ["A", "B"])).toBe("2026-11-20");
    expect(dueLabel("2026-11-20")).toBe("Nov 20");
  });

  it("knows when a date has gone by", () => {
    expect(isOverdue("2026-11-05", new Date(2026, 10, 6))).toBe(true);
    expect(isOverdue("2026-11-06", new Date(2026, 10, 6))).toBe(false);
  });
});

describe("the member's own checklist item", () => {
  const blank: WorkbenchEntry = { kind: "blueprint", itemId: "x", checked: [], pinned: false };

  it("keeps one item of their own, trimmed", () => {
    expect(customItems(withCustomItem(blank, "  Ask about the split  "))).toEqual(["Ask about the split"]);
    expect(customItems(blank)).toEqual([]);
  });

  it("holds its note and stays the member's item", () => {
    const own = withCustomItem(blank, "Ask about the split");
    const noted = withMeta(own, "Ask about the split", { note: "Tuesday" });
    expect(customItems(noted)).toEqual(["Ask about the split"]);
    expect(metaFor(noted, "Ask about the split")).toMatchObject({ note: "Tuesday", custom: true });
    expect(customItems(withMeta(noted, "Ask about the split", { note: "" }))).toEqual(["Ask about the split"]);
  });

  it("replaces it rather than adding a second, and drops the old tick", () => {
    const own = withCustomItem({ ...blank, checked: ["Ask about the split"] }, "Ask about the split");
    const renamed = toggleChecked(withCustomItem(own, "Ask about the splits"), "Ask about the splits");
    expect(customItems(renamed)).toEqual(["Ask about the splits"]);
    expect(renamed.checked).toEqual(["Ask about the splits"]);
  });

  it("goes away, with its tick, when the wording is cleared", () => {
    const own = toggleChecked(withCustomItem(blank, "Ask about the split"), "Ask about the split");
    const cleared = withCustomItem(own, "  ");
    expect(customItems(cleared)).toEqual([]);
    expect(cleared.checked).toEqual([]);
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

describe("nextStep", () => {
  it("suggests the dated item first, then the next unticked one", () => {
    const entries: WorkbenchEntry[] = [
      { kind: "blueprint", itemId: "music-business-startup", checked: ["Name checked"], pinned: true, meta: { "Business bank account": { due: "2026-11-30" } } },
      { kind: "blueprint", itemId: "record-label", checked: [], pinned: true },
    ];
    const step = nextStep(entries, []);
    expect(step.kind).toBe("item");
    expect(step.guideId).toBe("music-business-startup");
    expect(step.detail).toContain("Business bank account");
    expect(step.detail).toContain("due Nov 30");
  });

  it("falls back to a draft, then a contract out for signature", () => {
    const draft = nextStep([], [{ id: "c1", title: "Producer Agreement", status: "draft" }, { id: "c2", title: "Beat Lease", status: "sent" }]);
    expect(draft).toMatchObject({ kind: "contract", contractId: "c1" });
    const sent = nextStep([], [{ id: "c2", title: "Beat Lease", status: "sent" }]);
    expect(sent).toMatchObject({ kind: "contract", contractId: "c2" });
  });

  it("points at the library when nothing is in progress", () => {
    expect(nextStep([], []).kind).toBe("browse");
  });

  it("skips a finished blueprint", () => {
    const guide = GUIDES.find((g) => g.id === "record-label")!;
    const done = [{ kind: "blueprint" as const, itemId: guide.id, checked: [...(guide.checklist ?? [])], pinned: true }];
    expect(savedGuides(done)).toHaveLength(1);
    expect(nextStep(done, []).kind).toBe("browse");
  });
});
