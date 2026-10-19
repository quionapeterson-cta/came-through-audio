import { describe, expect, it } from "vitest";
import { BLUEPRINTS, renderContract } from "./contract-blueprints";

describe("contract blueprints", () => {
  it("every token has a matching field or party role", () => {
    for (const bp of BLUEPRINTS) {
      const keys = new Set(bp.fields.map((f) => f.key));
      for (const [, key] of bp.body.matchAll(/\{\{(\w+)\}\}/g)) expect(keys, `${bp.id}: {{${key}}}`).toContain(key);
      for (const [, role] of bp.body.matchAll(/\{\{party:([^}]+)\}\}/g)) expect(bp.roles, `${bp.id}: party ${role}`).toContain(role);
    }
  });

  it("fills fields and parties, and leaves labelled blanks for the rest", () => {
    const bp = BLUEPRINTS.find((b) => b.id === "producer-agreement")!;
    const out = renderContract(bp, { songTitle: "Midnight", fee: "$1,000" }, [{ role: "Artist", legalName: "Ada Lee" }]);
    expect(out).toContain("\"Midnight\"");
    expect(out).toContain("$1,000");
    expect(out).toContain("Ada Lee (\"Artist\")");
    expect(out).toContain("[Producer legal name]");
    expect(out).toContain("[Delivery date]");
    expect(out).not.toMatch(/\{\{/);
  });

  it("ids are unique", () => {
    expect(new Set(BLUEPRINTS.map((b) => b.id)).size).toBe(BLUEPRINTS.length);
  });
});
