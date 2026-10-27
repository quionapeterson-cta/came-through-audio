import { describe, expect, it } from "vitest";
import { BLUEPRINTS, CATEGORIES, COMPANY_BLUEPRINTS, fillBlanks, initialFields, missingFields, renderContract } from "./contract-blueprints";

const ALL = [...BLUEPRINTS, ...COMPANY_BLUEPRINTS];
const partiesFor = (roles: readonly string[]) => roles.map((role, i) => ({ role, legalName: `Person ${i + 1}` }));
const filled = (bp: (typeof ALL)[number]) => ({ ...initialFields(bp), ...Object.fromEntries(bp.fields.filter((f) => f.required).map((f) => [f.key, `x-${f.key}`])) });

describe("contract blueprints", () => {
  it("every token has a matching field or party role", () => {
    for (const bp of ALL) {
      const keys = new Set(bp.fields.map((f) => f.key));
      for (const [, key] of bp.body.matchAll(/\{\{(\w+)\}\}/g)) expect(keys, `${bp.id}: {{${key}}}`).toContain(key);
      for (const [, role] of bp.body.matchAll(/\{\{party:([^}]+)\}\}/g)) expect(bp.roles, `${bp.id}: party ${role}`).toContain(role);
    }
  });

  it("reads with no gaps once the required details and parties are in", () => {
    for (const bp of ALL) {
      const out = renderContract(bp, filled(bp), partiesFor(bp.roles));
      expect(out, bp.id).not.toMatch(/\[[^\]\n]{2,60}\]|\{\{|\{[A-Z][\w' ]*\}/);
    }
  });

  it("optional details never hold back signing, even left blank", () => {
    for (const bp of ALL) {
      expect(missingFields(bp, filled(bp)), bp.id).toEqual([]);
      expect(missingFields(bp, {}).every((f) => f.required), bp.id).toBe(true);
    }
  });

  it("a blank optional testimonial reads as fallback wording, not a gap", () => {
    for (const id of ["photo-video-release", "company-testimonial-release"]) {
      const bp = ALL.find((b) => b.id === id)!;
      const out = renderContract(bp, initialFields(bp), partiesFor(bp.roles));
      expect(out).toContain("any written testimonial Participant approves in writing later");
      expect(missingFields(bp, initialFields(bp))).toEqual([]);
    }
  });

  it("company agreements are governed by Georgia law, with no field for it", () => {
    for (const bp of COMPANY_BLUEPRINTS) {
      expect(bp.fields.some((f) => f.key === "governingLaw"), bp.id).toBe(false);
      expect(bp.body, bp.id).toContain("the laws of the State of Georgia");
    }
  });

  it("starts with today's date and the common defaults", () => {
    const bp = BLUEPRINTS.find((b) => b.id === "producer-agreement")!;
    const f = initialFields(bp, new Date(2027, 0, 5));
    expect(f["effectiveDate"]).toBe("January 5, 2027");
    expect(f["points"]).toBe("3%");
    expect(missingFields(bp, f).map((x) => x.key)).toEqual(["songTitle", "fee"]);
  });

  it("filling a field clears its gap in customized wording", () => {
    const bp = BLUEPRINTS.find((b) => b.id === "producer-agreement")!;
    const custom = renderContract(bp, {}, [{ role: "Artist", legalName: "" }]);
    expect(custom).toContain("[Production fee]");
    const out = fillBlanks(bp, custom, { fee: "$900" }, [{ role: "Artist", legalName: "Ada Lee" }]);
    expect(out).toContain("$900");
    expect(out).toContain("Ada Lee");
    expect(out).not.toContain("[Production fee]");
  });

  it("ids are unique and every blueprint has a known category", () => {
    expect(new Set(ALL.map((b) => b.id)).size).toBe(ALL.length);
    for (const bp of BLUEPRINTS) expect(CATEGORIES, bp.id).toContain(bp.category);
    expect(BLUEPRINTS.length).toBeGreaterThanOrEqual(77);
  });
});

describe("dropPrelaunch", async () => {
  const { dropPrelaunch, COMPANY_BLUEPRINTS } = await import("./contract-blueprints");
  it("removes the pre-launch section and renumbers what follows", () => {
    const body = "11. LAUNCH GIFT\nGift.\n\n12. PRE-LAUNCH CONFIDENTIALITY\nSecret.\n\n13. GENERAL\nLaw.\n\n14. SIGNATURES\nSign.";
    expect(dropPrelaunch(body)).toBe("11. LAUNCH GIFT\nGift.\n\n12. GENERAL\nLaw.\n\n13. SIGNATURES\nSign.");
  });
  it("cleans every company template that has the clause", () => {
    for (const bp of COMPANY_BLUEPRINTS) expect(dropPrelaunch(bp.body)).not.toContain("PRE-LAUNCH CONFIDENTIALITY");
  });
  it("leaves bodies without the clause alone", () => {
    expect(dropPrelaunch("1. TERMS\nx")).toBe("1. TERMS\nx");
  });
});
