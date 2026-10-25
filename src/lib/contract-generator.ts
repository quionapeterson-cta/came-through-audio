import type { Blueprint } from "@/lib/contract-blueprints";

/**
 * Contract Generator (PLAN-master-notes, founder 2026-10-25): someone describes their deal in their own words and gets
 * a draft from our blueprints. The AI (Cloudflare Workers AI, free tier) only PICKS a blueprint and FILLS its fields
 * and party names from what they wrote; the contract text is always the blueprint's own wording, so it can't invent
 * terms. Anything the deal needs that the blueprint doesn't cover is listed for them instead of written in.
 */

/** Price per generated contract, any plan (lookup key contract_generator). Company drafts are free. */
export const CONTRACT_PRICE = "$3.99";
export const CONTRACT_LOOKUP_KEY = "contract_generator";

/** Drafts per person per day (UTC), so one account can't use up the shared free allowance. */
export const GENERATIONS_PER_DAY = 10;
export const SCENARIO_MIN = 20;
export const SCENARIO_MAX = 2000;
/** Cloudflare's model with JSON output; about 200 of the free 10,000 daily neurons per draft. */
export const AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export type GeneratedDraft = {
  blueprintId: string;
  /** One line on why this blueprint fits. */
  reason: string;
  fields: Record<string, string>;
  /** Legal name per role, only when the description names someone. */
  parties: Record<string, string>;
  /** Required fields still blank: they fill these in the editor. */
  missing: string[];
  /** Parts of the deal this blueprint doesn't cover (add them in Edit terms, or ask a lawyer). */
  notCovered: string[];
};

/** What the generator returns: a draft, or the closest blueprints when the AI can't pick one or isn't available. */
export type GeneratorResult =
  | { kind: "draft"; draft: GeneratedDraft; left: number; /** Customer drafts: the saved draft that checkout turns into a contract. */ generationId?: string | undefined }
  | { kind: "suggest"; suggestions: string[]; reason: string; left: number };

/** The menu the AI picks from: one line per blueprint. */
export function blueprintMenu(list: Blueprint[]): string {
  return list.map((b) => `${b.id} | ${b.name} | ${b.category} | ${b.summary} Use when: ${b.whenToUse}`).join("\n");
}

export const PICK_SYSTEM = `You match a music business deal to the best contract template.
Pick exactly one template id from the list, or "none" if no template fits the deal at all.
Answer only with the JSON asked for. The reason is one short plain sentence a musician would understand.`;

export const pickSchema = {
  type: "object",
  properties: { blueprintId: { type: "string" }, reason: { type: "string" } },
  required: ["blueprintId", "reason"],
};

export function pickPrompt(scenario: string, list: Blueprint[]): string {
  return `Templates (id | name | category | summary):\n${blueprintMenu(list)}\n\nThe deal, in the user's words:\n"""${scenario}"""`;
}

export const FILL_SYSTEM = `You fill in a music contract template from a user's description of their deal.
Rules:
- Use only facts the user actually wrote. Never invent names, amounts, percentages, dates, places or terms.
- If the description doesn't say something, leave that field as an empty string.
- Copy amounts, percentages and dates the way the user wrote them.
- Party names: only real names the user gave for that role, otherwise an empty string.
- notCovered: short plain phrases for parts of the deal the template's fields can't hold (empty list if none).
Answer only with the JSON asked for.`;

export function fillSchema(bp: Blueprint, fieldKeys: string[]) {
  const str = { type: "string" };
  return {
    type: "object",
    properties: {
      fields: { type: "object", properties: Object.fromEntries(fieldKeys.map((k) => [k, str])), required: fieldKeys },
      parties: { type: "object", properties: Object.fromEntries(bp.roles.map((r) => [r, str])), required: [...bp.roles] },
      notCovered: { type: "array", items: str },
    },
    required: ["fields", "parties", "notCovered"],
  };
}

/** Fields the AI may fill. Company agreements keep Georgia law and the admin's own title. */
export function fillableFields(bp: Blueprint, company: boolean) {
  return bp.fields.filter((f) => !(company && (f.key === "governingLaw" || f.key === "signerTitle")));
}

export function fillPrompt(scenario: string, bp: Blueprint, company: boolean): string {
  const lines = fillableFields(bp, company).map((f) => `- ${f.key}: ${f.label}${f.required ? " (required)" : ""}. ${f.tip}${f.placeholder ? ` Example format: ${f.placeholder}` : ""}`);
  return `Template: ${bp.name}. ${bp.summary}
Roles: ${bp.roles.join(" and ")}.
Fields:
${lines.join("\n")}

The deal, in the user's words:
"""${scenario}"""`;
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** The AI's answer, cleaned: only this blueprint's fields and roles, plain strings, nothing invented added back. */
export function cleanDraft(bp: Blueprint, company: boolean, reason: string, raw: unknown): GeneratedDraft {
  const r = (raw && typeof raw === "object" ? raw : {}) as { fields?: Record<string, unknown>; parties?: Record<string, unknown>; notCovered?: unknown };
  const fields: Record<string, string> = {};
  for (const f of fillableFields(bp, company)) {
    const v = clip(r.fields?.[f.key], f.multiline ? 2000 : 200);
    if (v) fields[f.key] = v;
  }
  const parties: Record<string, string> = {};
  for (const role of bp.roles) {
    const v = clip(r.parties?.[role], 120);
    // Models sometimes echo the role itself ("Producer") instead of a name; that isn't a name.
    if (v && v.toLowerCase() !== role.toLowerCase()) parties[role] = v;
  }
  const notCovered = (Array.isArray(r.notCovered) ? r.notCovered : []).map((x) => clip(x, 160)).filter(Boolean).slice(0, 8);
  const missing = bp.fields.filter((f) => f.required && !fields[f.key] && !f.value && f.key !== "effectiveDate" && !(company && f.key === "signerTitle")).map((f) => f.label);
  return { blueprintId: bp.id, reason: clip(reason, 240), fields, parties, missing, notCovered };
}

/** Workers AI JSON mode returns the object itself or a JSON string, sometimes wrapped in a code fence. */
export function parseAiJson(response: unknown): unknown {
  if (response && typeof response === "object") return response;
  if (typeof response !== "string") return null;
  const text = response.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try { return JSON.parse(text); } catch {
    const m = /\{[\s\S]*\}/.exec(text);
    try { return m ? JSON.parse(m[0]) : null; } catch { return null; }
  }
}

const WORD = /[a-z0-9]+/g;
const STOP = new Set("a an and the i im my me we our for to of in on with is it that this be are was will they them their you your from at by as or".split(" "));
const words = (s: string) => (s.toLowerCase().match(WORD) ?? []).filter((w) => w.length > 2 && !STOP.has(w));

/** Without the AI: the blueprints whose name, summary and terms share the most words with the description. */
export function keywordPick(scenario: string, list: Blueprint[], n = 3): string[] {
  const want = new Set(words(scenario));
  const scored = list.map((b) => {
    const name = words(b.name), rest = words(`${b.summary} ${b.whenToUse} ${b.keyTerms.join(" ")}`);
    const score = name.filter((w) => want.has(w)).length * 3 + new Set(rest.filter((w) => want.has(w))).size;
    return { id: b.id, score };
  }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map((s) => s.id);
}
