import { describe, expect, it } from "vitest";
import { searchHelp } from "./help-search";

describe("help chat search (no AI)", () => {
  it("answers from our own content", () => {
    expect(searchHelp("How do refunds work?")[0]?.title).toBe("How do the plans and refunds work?");
    expect(searchHelp("what is the MLC")[0]?.source).toBe("Glossary");
    expect(searchHelp("how do i reset my password")[0]?.id).toBe("basic-password");
    expect(searchHelp("how do I embed metadata into my mp3")[0]?.title).toMatch(/embed/i);
  });
  it("says it doesn't know instead of guessing", () => {
    expect(searchHelp("what is the weather today")).toEqual([]);
    expect(searchHelp("   ")).toEqual([]);
  });
  it("never gives away a paid guide, only where to find it", () => {
    const guide = searchHelp("home recording cheat sheet", 10).find((a) => a.source === "Guide");
    if (guide) expect(guide.text).toContain("Contracts & Blueprints");
  });
});

describe("price and common questions", () => {
  it.each([
    ["How much is AI protection", "price-ai"],
    ["how much do plans cost", "price-plans"],
    ["what does expert registration cost", "price-expert"],
    ["how much is the branding kit", "price-branding"],
    ["difference between embedding and registering", "ask-embed-vs-register"],
    ["how do I change my email", "ask-change-email"],
  ])("%s", (q, id) => {
    expect(searchHelp(q)[0]?.id).toBe(id);
  });
});
