import { describe, expect, it } from "vitest";
import { BLUEPRINTS, COMPANY_BLUEPRINTS, blueprintById } from "./contract-blueprints";
import { cleanDraft, fillPrompt, fillSchema, fillableFields, keywordPick, parseAiJson, pickPrompt } from "./contract-generator";

const producer = blueprintById("producer-agreement")!;

describe("Contract Generator", () => {
  it("keeps only the blueprint's own fields and real names, and lists what's still required", () => {
    const d = cleanDraft(producer, false, "Custom production for your song.", {
      fields: { fee: " $500 ", songTitle: "Bloodline", madeUp: "should be dropped", points: "" },
      parties: { Artist: "Artist", Producer: "Jordan Lee", Stranger: "Nobody" },
      notCovered: ["Exclusive beat for 2 years", 42],
    });
    expect(d.fields).toEqual({ fee: "$500", songTitle: "Bloodline" });
    expect(d.parties).toEqual({ Producer: "Jordan Lee" });
    expect(d.notCovered).toEqual(["Exclusive beat for 2 years"]);
    const required = producer.fields.filter((f) => f.required && !f.value && f.key !== "effectiveDate" && !["fee", "songTitle"].includes(f.key)).map((f) => f.label);
    expect(d.missing).toEqual(required);
  });

  it("never lets company drafts change Georgia law or the signer's title", () => {
    const blank = COMPANY_BLUEPRINTS.find((b) => b.id === "company-blank")!;
    expect(fillableFields(blank, true).map((f) => f.key)).not.toContain("signerTitle");
    expect(cleanDraft(blank, true, "", { fields: { signerTitle: "CEO", terms: "Both sides keep it private." }, parties: {} }).fields).toEqual({ terms: "Both sides keep it private." });
  });

  it("reads JSON however the model wraps it", () => {
    expect(parseAiJson({ a: 1 })).toEqual({ a: 1 });
    expect(parseAiJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseAiJson('Sure! {"a":1} Hope that helps')).toEqual({ a: 1 });
    expect(parseAiJson("no json here")).toBeNull();
  });

  it("suggests the closest blueprints without the AI", () => {
    expect(keywordPick("I want to buy an exclusive beat license from a producer", BLUEPRINTS)).toContain("beat-license-exclusive");
    expect(keywordPick("zzz qqq", BLUEPRINTS)).toEqual([]);
  });

  it("builds prompts and schemas from the blueprint", () => {
    expect(pickPrompt("my deal", BLUEPRINTS)).toContain("producer-agreement | Music Producer Agreement");
    expect(fillPrompt("my deal", producer, false)).toContain("fee: ");
    const schema = fillSchema(producer, fillableFields(producer, false).map((f) => f.key)) as { properties: { parties: { required: string[] } } };
    expect(schema.properties.parties.required).toEqual(["Artist", "Producer"]);
  });
});
