import { describe, expect, it } from "vitest";
import { badgeKeys, badgeSlug, MAX_SLUG, setFolderProblem, slugProblem } from "./badge-protocol";

describe("badgeSlug", () => {
  it("turns a title into the bucket name", () => {
    expect(badgeSlug("Holiday 2026")).toBe("holiday-2026");
    expect(badgeSlug("First Placement!")).toBe("first-placement");
    expect(badgeSlug("R&B → Split")).toBe("r-and-b-split");
  });

  it("collapses separators and never leaves a stray hyphen", () => {
    expect(badgeSlug("  --Big   Moment--  ")).toBe("big-moment");
    expect(badgeSlug("Already-Fine")).toBe("already-fine");
    expect(badgeSlug("?!")).toBe("");
  });

  it("caps the length without breaking the pattern", () => {
    const long = badgeSlug("a".repeat(80));
    expect(long.length).toBe(MAX_SLUG);
    expect(slugProblem(long)).toBeNull();
    expect(slugProblem(badgeSlug(`${"x".repeat(47)} word`))).toBeNull();
  });
});

describe("slugProblem", () => {
  it("accepts the rule", () => {
    expect(slugProblem("holiday-2026")).toBeNull();
    expect(slugProblem("first-placement")).toBeNull();
  });

  it("names the mistake", () => {
    expect(slugProblem("")).toMatch(/name/i);
    expect(slugProblem("Holiday")).toMatch(/[Ll]owercase/);
    expect(slugProblem("holiday 2026")).toMatch(/hyphens/);
    expect(slugProblem("holiday_2026")).toMatch(/hyphens/);
    expect(slugProblem("holiday--2026")).toMatch(/single hyphens/);
    expect(slugProblem("-holiday")).toMatch(/letter/);
    expect(slugProblem("a".repeat(MAX_SLUG + 1))).toMatch(/48/);
  });
});

describe("setFolderProblem", () => {
  it("allows no set at all", () => expect(setFolderProblem("")).toBeNull());
  it("names a set folder by the same rule, however it is typed", () => {
    expect(setFolderProblem("badge-drops")).toBeNull();
    expect(setFolderProblem("Badge Drops")).toBeNull();
    expect(setFolderProblem("!!!")).toMatch(/name/i);
  });
});

describe("badgeKeys", () => {
  it("puts the web copy at the root and the master under 4k/", () => {
    expect(badgeKeys({ scope: "playful", slug: "holiday-2026" })).toEqual({
      web: "icons/playful/holiday-2026.webp",
      master: "4k/icons/playful/holiday-2026.png",
    });
  });

  it("keeps a set folder consistent across both files", () => {
    expect(badgeKeys({ scope: "serious", slug: "first-placement", set: "Badge Drops" })).toEqual({
      web: "icons/serious/badge-drops/first-placement.webp",
      master: "4k/icons/serious/badge-drops/first-placement.png",
    });
  });
});
