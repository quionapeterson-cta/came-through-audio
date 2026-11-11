import { describe, expect, it } from "vitest";
import { isoDate } from "@/lib/metadata";

/**
 * The save boundary that broke a Spotify import: the catalog's release_date is a Postgres date, and this database refuses
 * "2019" and "2019-05" ("invalid input syntax for type date"), which is exactly what Spotify sends when the day, or the
 * month, isn't published. Deezer always sends a full date, which is why only Spotify failed.
 */
describe("isoDate", () => {
  it("completes the partial dates Spotify publishes", () => {
    expect(isoDate("2019")).toBe("2019-01-01");
    expect(isoDate("2019-05")).toBe("2019-05-01");
    expect(isoDate(" 2021 ")).toBe("2021-01-01");
  });

  it("leaves a full date exactly as it is", () => {
    expect(isoDate("2019-05-17")).toBe("2019-05-17");
    expect(isoDate("2024-02-29")).toBe("2024-02-29");
  });

  it("keeps a blank blank, so no date is invented for an unreleased song", () => {
    expect(isoDate("")).toBe("");
    expect(isoDate(undefined)).toBe("");
    expect(isoDate("   ")).toBe("");
  });

  it("does not reshape something it doesn't recognise, so a real mistake still shows", () => {
    expect(isoDate("May 2019")).toBe("May 2019");
    expect(isoDate("2019-5-1")).toBe("2019-5-1");
  });
});
