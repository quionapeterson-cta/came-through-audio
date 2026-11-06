import { describe, expect, it } from "vitest";
import { BLUEPRINT_GUIDES, CHEAT_SHEETS, GUIDE_LINKS, GUIDES, linkFor } from "@/lib/guides";

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
});
