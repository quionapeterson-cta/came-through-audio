import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BLUEPRINTS, COMPANY_BLUEPRINTS, type Blueprint } from "./contract-blueprints";
import {
  AI_MODEL, FILL_SYSTEM, GENERATIONS_PER_DAY, PICK_SYSTEM, SCENARIO_MAX, SCENARIO_MIN,
  cleanDraft, fillPrompt, fillSchema, fillableFields, keywordPick, parseAiJson, pickPrompt, pickSchema, type GeneratorResult,
} from "./contract-generator";

/**
 * Contract Generator. Anyone signed in drafts from the customer blueprints ($3.99 to open each one as a contract);
 * super admins draft company agreements for free.
 * Runs on Cloudflare Workers AI's free daily allowance (CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_AI_TOKEN). When the AI
 * isn't set up, is over its daily allowance or can't decide, people get the closest blueprints instead of an error.
 */
async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

class AiUnavailable extends Error {}

/** One Workers AI call in JSON mode. */
async function runAi(system: string, prompt: string, schema: object, maxTokens: number): Promise<unknown> {
  const account = process.env["CLOUDFLARE_ACCOUNT_ID"];
  const token = process.env["CLOUDFLARE_AI_TOKEN"];
  if (!account || !token) throw new AiUnavailable("not configured");
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${AI_MODEL}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      response_format: { type: "json_schema", json_schema: schema },
      max_tokens: maxTokens,
      temperature: 0.1,
    }),
  });
  if (!res.ok) {
    // 429 or a neurons error once the free daily allowance is used up; anything else is logged for us to look at.
    console.error(`Workers AI failed [${res.status}]: ${(await res.text()).slice(0, 300)}`);
    throw new AiUnavailable(String(res.status));
  }
  const body = (await res.json()) as { success?: boolean; result?: { response?: unknown } };
  if (!body.success) throw new AiUnavailable("unsuccessful");
  return parseAiJson(body.result?.response);
}

const startOfUtcDay = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };

export const generateContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ scenario: z.string().trim().min(SCENARIO_MIN, "Tell us a little more about the deal.").max(SCENARIO_MAX), company: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }): Promise<GeneratorResult> => {
    const db = await admin();
    if (data.company) {
      const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
      if (!isSuper) throw new Error("Only super admins can draft company agreements.");
    }
    // Customers on any plan can draft; opening the contract is $3.99 (createCheckoutSession kind "contract").
    const list: Blueprint[] = data.company ? COMPANY_BLUEPRINTS : BLUEPRINTS;

    const { count } = await db.from("contract_generations" as never).select("id", { count: "exact", head: true }).eq("user_id", context.userId).gte("created_at", startOfUtcDay());
    const used = count ?? 0;
    const suggest = (reason: string, left = Math.max(0, GENERATIONS_PER_DAY - used)): GeneratorResult => ({ kind: "suggest", suggestions: keywordPick(data.scenario, list), reason, left });
    if (used >= GENERATIONS_PER_DAY) return suggest(`You've used today's ${GENERATIONS_PER_DAY} drafts. Here are the closest blueprints; drafting opens again tomorrow.`, 0);

    try {
      const pick = (await runAi(PICK_SYSTEM, pickPrompt(data.scenario, list), pickSchema, 200)) as { blueprintId?: string; reason?: string } | null;
      const bp = list.find((b) => b.id === pick?.blueprintId?.trim());
      if (!bp) return suggest("None of our blueprints is an exact match for that deal. These are the closest ones; a music attorney can help with anything unusual.");
      const raw = await runAi(FILL_SYSTEM, fillPrompt(data.scenario, bp, data.company), fillSchema(bp, fillableFields(bp, data.company).map((f) => f.key)), 1500);
      if (!raw) return suggest("We couldn't fill that one in automatically. Pick a blueprint below to start it yourself.");
      const draft = cleanDraft(bp, data.company, pick?.reason ?? "", raw);
      // The draft (not the description) is kept so a paid checkout can turn it into the contract.
      const { data: row } = await db.from("contract_generations" as never).insert({ user_id: context.userId, blueprint_id: bp.id, company: data.company, draft } as never).select("id").single();
      return { kind: "draft", draft, left: Math.max(0, GENERATIONS_PER_DAY - used - 1), generationId: (row as { id: string } | null)?.id };
    } catch (e) {
      if (e instanceof AiUnavailable) return suggest("Automatic drafting is resting right now. Here are the closest blueprints to start from.");
      throw e;
    }
  });
