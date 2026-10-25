import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailLayout, escapeHtml, SITE_URL } from "./email-layout";
import { COMPANY_LEGAL_NAME } from "./contract-blueprints";
import { getPaymentsEnvironment } from "./payments-env";
import { BETA_AGREEMENT } from "./beta";
import { TIER_LABEL, type Tier } from "./plans";

/**
 * Beta testers (Phase 4 item 3): who signed the Beta Tester Agreement, Grant lifetime access, and everyone's checklist
 * results. Super admins only (no Head of Marketing yet, founder 2026-10-25). Lifetime access is a server-written plan
 * row `lifetime_<party id>` with no end date; it never takes a Founding 100 seat (that counts Stripe payments only).
 */
const PRICE: Record<Exclude<Tier, "free">, string> = { plus: "catalog_plus_yearly", collaborate: "catalog_collaborate_yearly", management: "catalog_management_yearly" };
const lifetimeId = (partyId: string) => `lifetime_${partyId}`;

async function superAdminDb(context: { supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "super_admin" }) => PromiseLike<{ data: unknown }> }; userId: string }) {
  const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
  if (!isSuper) throw new Error("Only super admins can manage beta testers.");
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

type SignedParty = { id: string; legal_name: string; email: string; is_owner: boolean; signed_at: string | null; contracts: { title: string; blueprint: string; status: string; is_company: boolean; fields: Record<string, string> | null } };
export type BetaTesterRow = { partyId: string; name: string; email: string; signedAt: string; agreedTier: string; hasAccount: boolean; lifetime: string | null };
export type BetaFeedbackRow = { name: string; email: string; itemId: string; result: string | null; note: string; updatedAt: string };

const tierFromLabel = (label: string | undefined): Exclude<Tier, "free"> =>
  (Object.entries(TIER_LABEL).find(([t, l]) => t !== "free" && l === label)?.[0] as Exclude<Tier, "free"> | undefined) ?? "management";

/** Everyone who fully signed a Beta Tester Agreement, with their account and lifetime access. */
export const listBetaTesters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BetaTesterRow[]> => {
    const db = await superAdminDb(context);
    const { data, error } = await db.from("contract_parties" as never)
      .select("id, legal_name, email, is_owner, signed_at, contracts!inner(title, blueprint, status, is_company, fields)")
      .eq("is_owner", false).eq("contracts.blueprint", BETA_AGREEMENT).eq("contracts.is_company", true).eq("contracts.status", "signed");
    if (error) throw new Error("Couldn't load beta testers.");
    const parties = (data ?? []) as unknown as SignedParty[];
    const { data: grants } = await db.from("subscriptions").select("paddle_subscription_id, price_id").in("paddle_subscription_id", parties.map((p) => lifetimeId(p.id)));
    const granted = new Map((grants ?? []).map((g) => [g.paddle_subscription_id, g.price_id]));
    return Promise.all(parties.map(async (p) => {
      const { data: uid } = await db.rpc("user_id_by_email" as never, { _email: p.email.trim() } as never);
      const price = granted.get(lifetimeId(p.id));
      const tier = price ? (Object.entries(PRICE).find(([, v]) => v === price)?.[0] as Tier | undefined) : undefined;
      return { partyId: p.id, name: p.legal_name, email: p.email, signedAt: p.signed_at ?? "", agreedTier: p.contracts.fields?.["tier"] || TIER_LABEL.management,
        hasAccount: !!uid, lifetime: tier ? TIER_LABEL[tier] : null };
    }));
  });

/** Gives a signed beta tester lifetime access at the plan in their agreement (or the one chosen), and emails them. */
export const grantLifetimeAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ partyId: z.string().uuid(), tier: z.enum(["plus", "collaborate", "management"]).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await superAdminDb(context);
    const { data: row } = await db.from("contract_parties" as never)
      .select("id, legal_name, email, is_owner, signed_at, contracts!inner(title, blueprint, status, is_company, fields)").eq("id", data.partyId).maybeSingle();
    const p = row as unknown as SignedParty | null;
    if (!p || p.is_owner || !p.signed_at || p.contracts.blueprint !== BETA_AGREEMENT || !p.contracts.is_company || p.contracts.status !== "signed") {
      throw new Error("Lifetime access is only for testers with a fully signed Beta Tester Agreement.");
    }
    const { data: existing } = await db.from("subscriptions").select("id").eq("paddle_subscription_id", lifetimeId(p.id)).maybeSingle();
    if (existing) throw new Error("This tester already has lifetime access.");
    const { data: userId } = await db.rpc("user_id_by_email" as never, { _email: p.email.trim() } as never);
    if (!userId) throw new Error(`No account uses ${p.email} yet. Ask them to sign up free with that email, then grant access.`);
    const tier = data.tier ?? tierFromLabel(p.contracts.fields?.["tier"]);
    const { error } = await db.from("subscriptions").insert({
      user_id: userId as unknown as string,
      paddle_subscription_id: lifetimeId(p.id),
      paddle_customer_id: `granted_by_${context.userId}`,
      product_id: "beta_lifetime",
      price_id: PRICE[tier],
      status: "active",
      cancel_at_period_end: false,
      current_period_start: new Date().toISOString(),
      current_period_end: null,
      environment: getPaymentsEnvironment(),
    });
    if (error) throw new Error("Couldn't grant lifetime access. Try again.");
    const key = process.env["RESEND_API_KEY"];
    if (key) {
      const html = emailLayout(`<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Thank you, beta tester</p>
<h1 style="font-size:24px;margin:8px 0 16px">Came Through Audio Came Through for you</h1>
<p style="font-size:15px;line-height:1.6">Hi ${escapeHtml(p.legal_name || "there")}, thank you for testing Came Through Audio before launch. Your lifetime ${TIER_LABEL[tier]} access is active now, at no charge.</p>
<a href="${SITE_URL}/workspace" style="display:inline-block;background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px">Open your workspace</a>`,
        { reason: `You're receiving this because you signed a Beta Tester Agreement with ${COMPANY_LEGAL_NAME}, which includes lifetime access.` });
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "Came Through Audio <collaborate@camethroughaudio.com>", to: [p.email.trim()], subject: `Your lifetime ${TIER_LABEL[tier]} is active`, html }),
      }).catch((e) => console.error("Lifetime access email failed:", e));
    }
    return { tier: TIER_LABEL[tier] };
  });

/** Every tester's checklist results, newest first. */
export const listBetaFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BetaFeedbackRow[]> => {
    const db = await superAdminDb(context);
    const { data, error } = await db.from("beta_feedback" as never).select("user_id, item_id, result, note, updated_at").order("updated_at", { ascending: false }).limit(2000);
    if (error) throw new Error("Couldn't load beta results. Run migration 20261025180000 first.");
    const rows = (data ?? []) as { user_id: string; item_id: string; result: string | null; note: string; updated_at: string }[];
    const ids = [...new Set(rows.map((r) => r.user_id))];
    const people = new Map<string, { name: string; email: string }>();
    for (const id of ids) {
      const [{ data: u }, { data: prof }] = await Promise.all([db.auth.admin.getUserById(id), db.from("profiles").select("stage_name, legal_name").eq("id", id).maybeSingle()]);
      people.set(id, { name: prof?.legal_name || prof?.stage_name || "", email: u.user?.email ?? "" });
    }
    return rows.map((r) => ({ ...people.get(r.user_id)!, itemId: r.item_id, result: r.result, note: r.note, updatedAt: r.updated_at }));
  });
