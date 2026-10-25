import { describe, expect, it } from "vitest";
import { HANDBOOK, searchHandbook } from "./handbook";

describe("team handbook", () => {
  it("finds sections by every word searched", () => {
    expect(searchHandbook("placeholder IPI").map((s) => s.id)).toEqual(["registration"]);
    expect(searchHandbook("billing mailbox").length).toBeGreaterThan(0);
    expect(searchHandbook("zzzz")).toEqual([]);
  });
  it("keeps the tagline exact and the founder's line as personal branding", () => {
    const text = HANDBOOK.flatMap((s) => s.body).join(" ");
    expect(text).toContain("YOUR FIRST STOP BEFORE DISTRIBUTION");
    expect(text).not.toMatch(/1ST/);
  });
});
