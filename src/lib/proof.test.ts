import { describe, expect, it } from "vitest";
import { chainStrength, PACKAGES } from "./proof";
import { assistanceTotal } from "@/lib/plans";

describe("proof rules", () => {
  it("days apart is a strong chain", () => expect(chainStrength(new Date("2026-01-01"), new Date("2026-01-04"))).toMatch(/^Strong/));
  it("same day is weak", () => expect(chainStrength(new Date("2026-01-01T10:00"), new Date("2026-01-01T10:00"))).toMatch(/^Weak/));
  it("package prices", () => expect(PACKAGES.map((p) => p.price)).toEqual([2.99, 9.99, 16.99, 24.99]));
});
describe("registration assistance", () => {
  it("singles cap at 6", () => expect(assistanceTotal("single", 10, 1)).toBeCloseTo(14.99 + 4.99 * 6));
  it("21 album tracks bill a second entry", () => expect(assistanceTotal("album", 21, 1)).toBeCloseTo(29.99 * 2 + 4.99 * 21));
  it("blank inputs total 0", () => expect(assistanceTotal("album", 0, 0)).toBe(0));
});
