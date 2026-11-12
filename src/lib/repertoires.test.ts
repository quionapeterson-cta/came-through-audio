import { describe, expect, it } from "vitest";
import { COUNTRIES, TERRITORY_OPTIONS } from "@/lib/repertoires";

describe("territories of collection rights", () => {
  it("offers Worldwide first, then the whole world, once each", () => {
    expect(TERRITORY_OPTIONS[0]).toBe("Worldwide");
    expect(new Set(TERRITORY_OPTIONS).size).toBe(TERRITORY_OPTIONS.length);
    // Bigger than the society list on purpose: territories are not the countries we know societies for.
    expect(TERRITORY_OPTIONS.length).toBeGreaterThan(COUNTRIES.length + 100);
    expect(TERRITORY_OPTIONS).toContain("United States");
    expect(TERRITORY_OPTIONS).toContain("Jamaica");
    // Sorted after Worldwide, so the picker is scannable (plain case-folded order, the same rule the list is built with).
    const rest = [...TERRITORY_OPTIONS.slice(1)];
    const folded = (v: string) => v.toLowerCase();
    expect(rest).toEqual([...rest].sort((a, b) => (folded(a) < folded(b) ? -1 : folded(a) > folded(b) ? 1 : 0)));
  });
});
