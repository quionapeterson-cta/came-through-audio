import { describe, expect, it } from "vitest";
import {
  descriptorProblem, STATEMENT_DESCRIPTOR, STATEMENT_DESCRIPTOR_LIMIT, STATEMENT_DESCRIPTOR_PREFIX,
  STATEMENT_DESCRIPTOR_PREFIX_LIMIT,
} from "./plans";

describe("card statement descriptor", () => {
  it("fits Stripe's 22-character limit with the whole business name", () => {
    expect(STATEMENT_DESCRIPTOR.length).toBeLessThanOrEqual(STATEMENT_DESCRIPTOR_LIMIT);
    expect(descriptorProblem(STATEMENT_DESCRIPTOR)).toBeNull();
  });

  it("sets a card prefix inside the 10-character limit, so Stripe can't truncate it itself", () => {
    expect(STATEMENT_DESCRIPTOR_PREFIX.length).toBeLessThanOrEqual(STATEMENT_DESCRIPTOR_PREFIX_LIMIT);
    expect(descriptorProblem(STATEMENT_DESCRIPTOR_PREFIX, true)).toBeNull();
  });

  it("keeps the prefix an exact substring of the business name, so it isn't a second DBA", () => {
    expect(STATEMENT_DESCRIPTOR.replace(/\s/g, "")).toContain(STATEMENT_DESCRIPTOR_PREFIX);
  });

  it("shows what happens without a prefix: Stripe prints the first 10 characters", () => {
    expect(STATEMENT_DESCRIPTOR.slice(0, STATEMENT_DESCRIPTOR_PREFIX_LIMIT)).toBe("CAME THROU");
    expect(STATEMENT_DESCRIPTOR_PREFIX).not.toBe(STATEMENT_DESCRIPTOR.slice(0, 10));
  });

  it("refuses what Stripe refuses", () => {
    // 22 is the limit and "CAME THROUGH AUDIO LLC" is exactly 22, so one more character is what fails.
    expect(descriptorProblem("CAME THROUGH AUDIO LLC")).toBeNull();
    expect(descriptorProblem("CAME THROUGH AUDIO LLCX")).toContain("Too long");
    expect(descriptorProblem("CAMETHROUGHAUDIO", true)).toContain("Too long");
    expect(descriptorProblem("CTA*BILLING")).toContain("Only Latin");
    expect(descriptorProblem("CTA'BILLING")).toContain("Only Latin");
    expect(descriptorProblem("12345")).toContain("letter");
    expect(descriptorProblem("AB")).toContain("Too short");
  });

  it("allows the fallback shorthand a person might type by hand", () => {
    expect(descriptorProblem("CAMETHRU", true)).toBeNull();
    expect(descriptorProblem("CTAAUDIO", true)).toBeNull();
  });
});
