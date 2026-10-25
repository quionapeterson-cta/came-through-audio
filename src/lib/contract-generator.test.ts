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

describe("$3.99 generated contracts", () => {
  it("checks out one contract_generator for the buyer's own draft and returns to Contracts", async () => {
    const { checkoutInput, planCheckout } = await import("./stripe-mapping");
    const id = "00000000-0000-4000-8000-000000000001";
    expect(planCheckout(checkoutInput.parse({ kind: "contract", generationId: id }), "u1")).toMatchObject({
      mode: "payment", items: [{ lookupKey: "contract_generator", quantity: 1 }], metadata: { userId: "u1", kind: "contract", generation: id }, returnTab: "learn", managed: true,
    });
    expect(() => checkoutInput.parse({ kind: "contract", generationId: "nope" })).toThrow();
  });

  it("turns a paid draft into one paid contract with both parties, once", async () => {
    const { contractFromPurchase } = await import("./contract-generator.server");
    const draft = cleanDraft(producer, false, "", { fields: { fee: "$500", songTitle: "Bloodline" }, parties: { Producer: "Jordan Lee" } });
    const gen = { id: "g1", user_id: "u1", draft, contract_id: null as string | null, company: false };
    const inserts: Record<string, unknown[]> = {};
    const db = {
      from(table: string) {
        const q = {
          select: () => q, eq: () => q,
          maybeSingle: async () => ({ data: table === "contract_generations" ? gen : null }),
          insert(row: unknown) { (inserts[table] ??= []).push(row); return { select: () => ({ single: async () => ({ data: { id: "k1" }, error: null }) }), error: null, then: (r: (v: unknown) => void) => r({ error: null }) }; },
          update(row: { contract_id?: string }) { if (row.contract_id) gen.contract_id = row.contract_id; return { eq: async () => ({}) }; },
        };
        return q;
      },
    };
    const purchase = { id: "p1", user_id: "u1", details: { generation: "g1" } };
    expect(await contractFromPurchase(db as never, purchase)).toBe("k1");
    expect(inserts["contracts"]?.[0]).toMatchObject({ user_id: "u1", blueprint: "producer-agreement", paid_purchase_id: "p1", fields: expect.objectContaining({ fee: "$500", songTitle: "Bloodline" }) });
    expect(inserts["contract_parties"]?.[0]).toEqual([
      expect.objectContaining({ role: "Artist", legal_name: "", is_owner: true, position: 0 }),
      expect.objectContaining({ role: "Producer", legal_name: "Jordan Lee", is_owner: false, position: 1 }),
    ]);
    // Stripe retries the webhook: the same payment never makes a second contract.
    expect(await contractFromPurchase(db as never, purchase)).toBe("k1");
    expect(inserts["contracts"]).toHaveLength(1);
    await expect(contractFromPurchase(db as never, { ...purchase, user_id: "someone else" })).rejects.toThrow();
  });
});
