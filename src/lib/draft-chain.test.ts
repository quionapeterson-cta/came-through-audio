import { describe, expect, it } from "vitest";
import { framePoints, gradeProof, rateChain } from "./draft-chain";

describe("rateChain", () => {
  it("is pending with fewer than two dates", () => expect(rateChain(["2026-01-01"]).status).toBe("pending"));
  it("is strong when dates are more than 7 days apart", () => expect(rateChain(["2026-03-10", "2026-01-01"])).toMatchObject({ status: "strong", first: "2026-01-01", days: 68 }));
  it("is weak at exactly 7 days apart", () => expect(rateChain(["2026-01-01", "2026-01-08"]).status).toBe("weak"));
});

describe("gradeProof", () => {
  const strong = rateChain(["2026-01-01", "2026-03-10"]);
  it("gives A+ when draft chain is strong and DAW shows a date", () => expect(gradeProof(strong, "2026-03-12")).toBe("A+"));
  it("gives A (no penalty) when DAW shows no date", () => expect(gradeProof(strong, undefined)).toBe("A"));
  it("a DAW date cannot lift a weak chain to A+", () => expect(gradeProof(rateChain(["2026-01-01", "2026-01-03"]), "2026-01-04")).toBe("C"));
  it("stays pending without two draft dates", () => expect(gradeProof(rateChain([]), "2026-01-04")).toBe("Pending"));
});

describe("framePoints", () => {
  it("samples near the end of a 51-second video", () => expect(Math.max(...framePoints(51))).toBeGreaterThan(48));
});
