import { describe, expect, it } from "vitest";
import { BADGES, BADGE_TAB, BADGE_TABS, badgeTab, badgesInTab, limitText } from "@/lib/badges";

// A goal is not a limit (founder, 2026-11-21): only a badge that declares a real ceiling prints a fraction.
describe("limitText", () => {
  it("says nothing for an ordinary milestone", () => {
    expect(limitText({}, 5)).toBeUndefined();
    expect(limitText({}, 0)).toBeUndefined();
  });

  it("prints the fraction a genuinely limited badge holds to", () => {
    expect(limitText({ limit: 5 }, 3)).toBe("3/5");
    expect(limitText({ limit: 5 }, 9)).toBe("5/5");
  });

  it("leaves every live badge without a limit today", () => {
    expect(BADGES.filter((b) => b.limit)).toEqual([]);
  });
});

// Badges are organized by the workspace tab that earns them (founder, 2026-11-21). The mapping is written out per badge
// id, so these tests are what stops a new badge drifting onto a tab by accident.
describe("badges organized by tab", () => {
  it("places every live badge and nothing else", () => {
    const ids = BADGES.map((b) => b.id).sort();
    expect(Object.keys(BADGE_TAB).sort()).toEqual(ids);
  });

  it("files every badge on exactly one tab", () => {
    for (const badge of BADGES) {
      expect(BADGE_TABS.map((t) => t.id)).toContain(badgeTab(badge));
    }
    const filed = BADGE_TABS.reduce((n, t) => n + badgesInTab(t.id).length, 0);
    expect(filed).toBe(BADGES.length);
  });

  it("refuses a badge that was never placed on a tab, instead of filing it under account", () => {
    expect(() => badgeTab({ ...BADGES[0]!, id: "not_a_badge" })).toThrow(
      /not mapped to a workspace tab/,
    );
  });

  it("gives every tab at least one badge", () => {
    for (const tab of BADGE_TABS) expect(badgesInTab(tab.id).length).toBeGreaterThan(0);
  });

  it("names the action that awards each badge", () => {
    for (const badge of BADGES) expect(badge.action.trim().length).toBeGreaterThan(0);
  });

  it("puts the task sets on the tab that does the work", () => {
    const tabOf = (id: string) => badgeTab(BADGES.find((b) => b.id === id)!);
    expect(tabOf("sealed")).toBe("splits");
    expect(tabOf("lyric_locked_gold")).toBe("embed");
    expect(tabOf("embedded")).toBe("embed");
    expect(tabOf("health_report_matched")).toBe("health");
    expect(tabOf("ai_slayer")).toBe("protect");
    expect(tabOf("contract_signed")).toBe("learn");
    expect(tabOf("cover_single")).toBe("catalog");
    expect(tabOf("genesis")).toBe("account");
  });
});
