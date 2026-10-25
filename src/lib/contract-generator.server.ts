import type { SupabaseClient } from "@supabase/supabase-js";
import { BLUEPRINTS, initialFields } from "./contract-blueprints";
import type { GeneratedDraft } from "./contract-generator";

/**
 * A paid draft becomes the buyer's contract (payment webhook, service role): the blueprint with the filled fields and
 * names, both parties, marked paid so it can be edited and sent on any plan. Safe to call twice for one payment.
 */
export async function contractFromPurchase(db: SupabaseClient, purchase: { id: string; user_id: string; details: Record<string, string> }) {
  const generationId = purchase.details["generation"];
  if (!generationId) throw new Error(`Contract purchase ${purchase.id} has no draft`);
  const { data: gen } = await db.from("contract_generations" as never).select("id, user_id, draft, contract_id, company").eq("id", generationId).maybeSingle();
  const g = gen as { id: string; user_id: string; draft: GeneratedDraft | null; contract_id: string | null; company: boolean } | null;
  if (!g || g.user_id !== purchase.user_id || g.company || !g.draft) throw new Error(`Contract purchase ${purchase.id}: draft ${generationId} not found`);
  if (g.contract_id) return g.contract_id;
  const bp = BLUEPRINTS.find((b) => b.id === g.draft!.blueprintId);
  if (!bp) throw new Error(`Contract purchase ${purchase.id}: blueprint ${g.draft.blueprintId} not found`);
  const fields = { ...initialFields(bp), ...g.draft.fields };
  const { data: k, error } = await db.from("contracts" as never).insert({ user_id: purchase.user_id, blueprint: bp.id, title: bp.name, fields, body: "", paid_purchase_id: purchase.id } as never).select("id").single();
  if (error || !k) throw error ?? new Error("Contract not created");
  const contractId = (k as { id: string }).id;
  const parties = bp.roles.map((role, position) => ({ contract_id: contractId, role, legal_name: g.draft!.parties[role] ?? "", email: "", is_owner: position === 0, position }));
  const { error: pErr } = await db.from("contract_parties" as never).insert(parties as never);
  if (pErr) throw pErr;
  await db.from("contract_generations" as never).update({ purchase_id: purchase.id, contract_id: contractId } as never).eq("id", g.id);
  return contractId;
}

