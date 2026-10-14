import { describe, expect, it } from "vitest";
import { rateChain } from "./draft-chain";

describe("rateChain", () => {
  it("is pending with fewer than two dates", () => expect(rateChain(["2026-01-01"]).status).toBe("pending"));
  it("is strong when dates are more than 7 days apart", () => expect(rateChain(["2026-03-10", "2026-01-01"])).toMatchObject({ status: "strong", first: "2026-01-01", days: 68 }));
  it("is weak at exactly 7 days apart", () => expect(rateChain(["2026-01-01", "2026-01-08"]).status).toBe("weak"));
});
