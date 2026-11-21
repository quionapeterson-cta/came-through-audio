import { describe, expect, it } from "vitest";
import {
  PRESTIGE_FRAMES,
  badgesToUnlock,
  ecosystemCompletion,
  frameById,
  frameTierLabel,
  frameUnlocked,
} from "./prestige-badge";

// The thresholds the studio's copy promises: Starter at 1 badge, Pro at 5 or half the ecosystem, Master at 10 or all
// of it. The plain obsidian plaque is the one everybody starts on.
const obsidian = frameById("obsidian")!;
const cobalt = frameById("glow-cobalt")!;
const diamond = frameById("diamond-gold")!;
const iced = frameById("iced-platinum")!;

describe("ecosystemCompletion", () => {
  it("reads earned badges as a share of the live ecosystem", () => {
    expect(ecosystemCompletion(0, 10)).toBe(0);
    expect(ecosystemCompletion(5, 10)).toBe(0.5);
    expect(ecosystemCompletion(3, 4)).toBe(0.75);
  });

  it("stays between 0 and 1, and is 0 when no badge is live", () => {
    expect(ecosystemCompletion(12, 10)).toBe(1);
    expect(ecosystemCompletion(-3, 10)).toBe(0);
    expect(ecosystemCompletion(0, 0)).toBe(0);
    expect(ecosystemCompletion(4, 0)).toBe(0);
    expect(ecosystemCompletion(2, -1)).toBe(0);
  });
});

describe("frameUnlocked", () => {
  it("always wears the plain obsidian plaque", () => {
    expect(frameUnlocked(obsidian, 0, 0)).toBe(true);
    expect(frameUnlocked(obsidian, 0, 100)).toBe(true);
  });

  it("opens the starter glow at one badge", () => {
    expect(frameUnlocked(cobalt, 0, 100)).toBe(false);
    expect(frameUnlocked(cobalt, 1, 100)).toBe(true);
    // A tiny ecosystem still only needs the one badge, not a share of it.
    expect(frameUnlocked(cobalt, 1, 2)).toBe(true);
  });

  it("opens the diamond bezel at five badges or half the ecosystem", () => {
    expect(frameUnlocked(diamond, 4, 100)).toBe(false);
    expect(frameUnlocked(diamond, 5, 100)).toBe(true);
    // Half of 8 is 4, so a small shelf opens it sooner than the count would.
    expect(frameUnlocked(diamond, 4, 8)).toBe(true);
    expect(frameUnlocked(diamond, 3, 8)).toBe(false);
    // A share that isn't whole rounds up: half of 5 is 3, never 2.5 badges.
    expect(frameUnlocked(diamond, 3, 5)).toBe(true);
    expect(frameUnlocked(diamond, 2, 5)).toBe(false);
  });

  it("opens the iced-out plaque at ten badges or a finished ecosystem", () => {
    expect(frameUnlocked(iced, 9, 100)).toBe(false);
    expect(frameUnlocked(iced, 10, 100)).toBe(true);
    expect(frameUnlocked(iced, 6, 6)).toBe(true);
    expect(frameUnlocked(iced, 5, 6)).toBe(false);
    expect(frameUnlocked(iced, 10, 1000)).toBe(true);
  });

  it("never goes back once earned", () => {
    for (const frame of PRESTIGE_FRAMES) {
      for (const total of [0, 1, 4, 9, 40]) {
        for (let earned = 0; earned < 12; earned++) {
          if (frameUnlocked(frame, earned, total))
            expect(frameUnlocked(frame, earned + 1, total)).toBe(true);
        }
      }
    }
  });
});

describe("badgesToUnlock", () => {
  it("asks nothing for the plaque everybody has", () => {
    expect(badgesToUnlock(obsidian, 0, 0)).toBe(0);
    expect(badgesToUnlock(obsidian, 7, 20)).toBe(0);
  });

  it("counts the shorter of the badge count and the ecosystem share", () => {
    expect(badgesToUnlock(cobalt, 0, 100)).toBe(1);
    expect(badgesToUnlock(cobalt, 1, 100)).toBe(0);
    expect(badgesToUnlock(diamond, 0, 100)).toBe(5);
    expect(badgesToUnlock(diamond, 4, 100)).toBe(1);
    expect(badgesToUnlock(diamond, 3, 8)).toBe(1);
    expect(badgesToUnlock(iced, 0, 100)).toBe(10);
    expect(badgesToUnlock(iced, 5, 6)).toBe(1);
    expect(badgesToUnlock(iced, 0, 6)).toBe(6);
  });

  it("is 0 once the frame is worn, and never negative", () => {
    expect(badgesToUnlock(diamond, 50, 100)).toBe(0);
    expect(badgesToUnlock(iced, 40, 40)).toBe(0);
    expect(badgesToUnlock(diamond, 900, 100)).toBe(0);
  });

  it("falls back to the badge count when no badge is live", () => {
    expect(badgesToUnlock(cobalt, 0, 0)).toBe(1);
    expect(badgesToUnlock(diamond, 4, 0)).toBe(1);
    expect(badgesToUnlock(iced, 0, 0)).toBe(10);
  });

  it("always agrees with frameUnlocked", () => {
    for (const frame of PRESTIGE_FRAMES) {
      for (const total of [0, 1, 2, 3, 5, 8, 11, 20, 134]) {
        for (let earned = 0; earned <= 14; earned++) {
          const unlocked = frameUnlocked(frame, earned, total);
          const needed = badgesToUnlock(frame, earned, total);
          expect(needed === 0).toBe(unlocked);
          // The count on screen is what is left to the frame's own goal, never more than its badge count.
          expect(needed).toBeLessThanOrEqual(frame.badges);
          // Every earned badge closes the gap by one.
          if (!unlocked) expect(badgesToUnlock(frame, earned + 1, total)).toBe(needed - 1);
        }
      }
    }
  });
});

describe("frame catalog", () => {
  it("keeps one entry per id, and finds each by it", () => {
    expect(new Set(PRESTIGE_FRAMES.map((f) => f.id)).size).toBe(PRESTIGE_FRAMES.length);
    for (const frame of PRESTIGE_FRAMES) expect(frameById(frame.id)).toBe(frame);
    expect(frameById("no-such-frame" as never)).toBeUndefined();
  });

  it("holds one plaque, three glows, two bezels and two iced finishes", () => {
    const tiers = PRESTIGE_FRAMES.map((f) => f.tier);
    expect(tiers.filter((t) => t === "base")).toHaveLength(1);
    expect(tiers.filter((t) => t === "starter")).toHaveLength(3);
    expect(tiers.filter((t) => t === "pro")).toHaveLength(2);
    expect(tiers.filter((t) => t === "master")).toHaveLength(2);
    // Both frames of a tier open on the same terms, so the higher finish is never cheaper.
    for (const tier of ["starter", "pro", "master"] as const) {
      const goals = PRESTIGE_FRAMES.filter((f) => f.tier === tier).map(
        (f) => `${f.badges}/${f.completion}`,
      );
      expect(new Set(goals).size).toBe(1);
    }
  });

  it("gives every frame its name, hint and tier label", () => {
    for (const frame of PRESTIGE_FRAMES) {
      expect(frame.name.trim()).not.toBe("");
      expect(frame.hint.trim()).not.toBe("");
      expect(frameTierLabel[frame.tier]).toBeTruthy();
    }
    expect(frameTierLabel.base).toMatch(/always/i);
    expect(frameTierLabel.pro).toMatch(/5/);
    expect(frameTierLabel.master).toMatch(/10/);
  });

  it("never asks a starting member for a share of an ecosystem as their first badge", () => {
    expect(obsidian).toMatchObject({ badges: 0, completion: 0 });
    for (const frame of PRESTIGE_FRAMES.filter((f) => f.tier !== "base")) {
      expect(frame.badges).toBeGreaterThanOrEqual(1);
      expect(frame.completion).toBeGreaterThanOrEqual(0);
      expect(frame.completion).toBeLessThanOrEqual(1);
    }
    for (const frame of PRESTIGE_FRAMES.filter((f) => f.tier === "base"))
      expect(frame.completion).toBe(0);
  });
});
