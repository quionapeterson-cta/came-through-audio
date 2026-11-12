import { describe, expect, it } from "vitest";
import { COUNTRIES, TERRITORY_EXTRA_OPTIONS, TERRITORY_OPTIONS } from "@/lib/repertoires";
import { COUNTRY_NAMES, countryOptions } from "@/lib/country-names";

describe("territories of collection rights", () => {
  it("offers Worldwide first, then the US, then the whole world, once each", () => {
    expect(TERRITORY_OPTIONS[0]).toBe("Worldwide");
    expect(TERRITORY_OPTIONS[1]).toBe("United States");
    expect(new Set(TERRITORY_OPTIONS).size).toBe(TERRITORY_OPTIONS.length);
    // Bigger than the society list on purpose: territories are not the countries we know societies for.
    expect(TERRITORY_OPTIONS.length).toBeGreaterThan(COUNTRIES.length + 100);
    expect(TERRITORY_OPTIONS).toContain("United States");
    expect(TERRITORY_OPTIONS).toContain("Jamaica");
    // Sorted after those two, so the picker is scannable (plain case-folded order, the same rule the list is built with).
    const rest = [...TERRITORY_OPTIONS.slice(2)];
    const folded = (v: string) => v.toLowerCase();
    expect(rest).toEqual([...rest].sort((a, b) => (folded(a) < folded(b) ? -1 : folded(a) > folded(b) ? 1 : 0)));
  });
  it("offers Worldwide first among the territories a member can add, and never the United States", () => {
    expect(TERRITORY_EXTRA_OPTIONS[0]).toBe("Worldwide");
    expect(TERRITORY_EXTRA_OPTIONS).not.toContain("United States");
    expect(TERRITORY_EXTRA_OPTIONS).toHaveLength(TERRITORY_OPTIONS.length - 1);
  });
});

describe("a country picker with a saved answer", () => {
  it("lists every country, opens on the United States, and keeps an older free-text answer selectable", () => {
    const plain = countryOptions("");
    expect(plain).toHaveLength(COUNTRY_NAMES.length);
    expect(plain[0]).toBe("United States");
    const saved = countryOptions("USA");
    expect(saved[0]).toBe("United States");
    expect(saved[1]).toBe("USA");
    expect(saved).toHaveLength(COUNTRY_NAMES.length + 1);
  });

  it("doesn't duplicate a value we already list", () => {
    expect(countryOptions("United States")).toHaveLength(COUNTRY_NAMES.length);
    expect(countryOptions("  ")).toHaveLength(COUNTRY_NAMES.length);
  });
});
