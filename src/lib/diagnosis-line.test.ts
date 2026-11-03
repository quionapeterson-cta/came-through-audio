import { describe, it, expect } from "vitest";
import { diagnosisLine, ORGAN_IMPACT } from "@/lib/royalty-checkup";

/** The locked format from PLAN-royalty-health-hub-v2 §2/§4: `Diagnosis: [Organ Condition] : [Royalty Impact]`. */
describe("diagnosis headline", () => {
  it("reads Diagnosis: condition : impact", () => {
    expect(diagnosisLine({ organ: "heart", dx: "Blockage in the left heart artery." })).toBe(
      "Diagnosis: Blockage in the left heart artery : Performance royalties uncollected.",
    );
  });

  it("drops a trailing full stop before the colon", () => {
    expect(diagnosisLine({ organ: "kidneys", dx: "Your kidneys aren't filtering." })).toBe(
      "Diagnosis: Your kidneys aren't filtering : Mechanical royalties held or unmatched.",
    );
  });

  it("gives every organ a royalty impact", () => {
    expect(Object.values(ORGAN_IMPACT).every((v) => v.length > 0)).toBe(true);
  });
});
