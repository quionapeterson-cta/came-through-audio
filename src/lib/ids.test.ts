import { describe, it, expect } from "vitest";
import { isCatalogId, updateTarget } from "@/lib/ids";

/** A Royalty Inspector song's id is not a catalog id, and Postgres refuses it as one (founder, 2026-11-14). */
describe("catalog ids", () => {
  it("never hands an Inspector id to Postgres as a catalog id", () => {
    expect(isCatalogId("h:09bef0e2-1f7a-4a55-9a5e-64f8a0d1b2c3")).toBe(false);
    expect(updateTarget("h:09bef0e2-1f7a-4a55-9a5e-64f8a0d1b2c3")).toBeUndefined();
  });

  it("updates a song My Catalog already holds", () => {
    expect(isCatalogId("09bef0e2-1f7a-4a55-9a5e-64f8a0d1b2c3")).toBe(true);
    expect(updateTarget("09bef0e2-1f7a-4a55-9a5e-64f8a0d1b2c3")).toBe("09bef0e2-1f7a-4a55-9a5e-64f8a0d1b2c3");
  });

  it("inserts a song with no id at all", () => {
    expect(updateTarget(undefined)).toBeUndefined();
    expect(updateTarget("")).toBeUndefined();
  });
});
