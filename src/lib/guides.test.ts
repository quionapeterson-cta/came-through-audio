import { describe, expect, it } from "vitest";
import { BLUEPRINT_GUIDES, CHEAT_SHEETS, crossedSteps, GUIDE_LINKS, GUIDES, linkFor } from "@/lib/guides";

const royalty = BLUEPRINT_GUIDES.find((g) => g.id === "royalty-registration")!;

describe("blueprint guides", () => {
  it("links every royalty registration item to the screen that finishes it", () => {
    for (const item of royalty.checklist ?? []) expect(linkFor(royalty.id, item)?.label, item).toBeTruthy();
  });

  it("only links items that are on their guide's checklist", () => {
    for (const [guideId, links] of Object.entries(GUIDE_LINKS)) {
      const guide = GUIDES.find((g) => g.id === guideId);
      expect(guide, guideId).toBeTruthy();
      for (const item of Object.keys(links)) expect(guide!.checklist, `${guideId}: ${item}`).toContain(item);
    }
  });

  it("points a blueprint link at a guide that exists", () => {
    for (const links of Object.values(GUIDE_LINKS)) {
      for (const link of Object.values(links)) {
        expect(link.label.trim()).not.toBe("");
        if (link.where === "blueprint") expect(GUIDES.some((g) => g.id === link.guideId), link.label).toBe(true);
      }
    }
  });

  it("has no links on the cheat sheets, which are done in a studio", () => {
    for (const sheet of CHEAT_SHEETS) expect(GUIDE_LINKS[sheet.id]).toBeUndefined();
  });

  it("names only steps that exist when a guide maps its own", () => {
    for (const g of BLUEPRINT_GUIDES) {
      if (!g.stepOf) continue;
      expect(g.stepOf.length, g.id).toBe(g.checklist!.length);
      for (const at of g.stepOf) expect(at >= 0 && at < g.steps.length, `${g.id}: step ${at}`).toBe(true);
    }
  });

  it("crosses a step out only once every item that proves it is ticked", () => {
    const royalty = BLUEPRINT_GUIDES.find((g) => g.id === "royalty-registration")!;
    expect(crossedSteps(royalty, royalty.checklist!.slice(0, 1))).toEqual(new Set([0]));
    expect(crossedSteps(royalty, [])).toEqual(new Set());

    // Two items prove the same step, so one tick leaves the instructions alone.
    const embed = BLUEPRINT_GUIDES.find((g) => g.id === "embed-defaults")!;
    expect(crossedSteps(embed, ["Artist name and label"]).has(0)).toBe(false);
    expect(crossedSteps(embed, ["Artist name and label", "Contact email to embed"]).has(0)).toBe(true);
  });

  it("prints the copyright pamphlet with the composition and the master explained in full", () => {
    const g = BLUEPRINT_GUIDES.find((x) => x.id === "copyright-protection")!;
    const pamphlet = g.pamphlet ?? [];
    const headings = pamphlet.map((p) => p.heading).join(" | ");
    expect(headings).toContain("composition");
    expect(headings).toContain("master");
    // The money side is its own read: mechanicals versus performances, SoundExchange, then how the three fit together.
    expect(headings).toContain("The MLC");
    expect(headings).toContain("SoundExchange");
    expect(headings).toContain("four places SoundExchange collects");
    expect(headings).toContain("How they all work together");
    expect(pamphlet.flatMap((p) => p.points ?? []).length).toBeGreaterThan(10);
    // Each section is a real explanation, not a label, and the steps stay short enough to read at a glance.
    expect(pamphlet.every((p) => p.body.length > 200)).toBe(true);
    expect(g.steps.every((s) => s.text.length < 900)).toBe(true);
  });

  it("points every numbered step at a checklist item, so no instruction is left unfinished", () => {
    for (const g of BLUEPRINT_GUIDES) {
      const claimed = new Set((g.checklist ?? []).map((_, i) => g.stepOf?.[i] ?? i));
      const unclaimed = g.steps.map((_, i) => i).filter((i) => !claimed.has(i)).map((i) => `${g.id} step ${i + 1}: ${g.steps[i]!.title}`);
      expect(unclaimed).toEqual([]);
    }
  });

  it("stops at the last step of a guide shorter than its checklist", () => {
    const g = { ...BLUEPRINT_GUIDES.find((x) => x.id === "copyright-protection")! };
    // Every item claims one step, and no map may point past the last instruction.
    expect(crossedSteps(g, g.checklist!).size).toBeLessThanOrEqual(g.steps.length);
  });
});
