import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAccess, type StaffAccess } from "./departments";
import { PRICE_TIER, TIER_LABEL } from "./plans";

export type AdminPurchase = { type: string; environment: string; status: string; created_at: string | null };

/** One-time buys and plan subscriptions in one list, newest first: Stripe shows both as payments. */
export function purchaseList(
  oneTime: { kind: string; details: unknown; environment: string; created_at: string | null }[],
  plans: { price_id: string; status: string; environment: string; created_at: string | null }[],
): AdminPurchase[] {
  const kindLabel = (kind: string, d: Record<string, string>) =>
    kind === "ai" ? `AI Protection · ${d["package"] ?? "package"}${Number(d["songs"]) > 1 && d["package"] === "Single" ? ` ×${d["songs"]}` : ""}`
    : kind === "expert" ? `Expert Assistance · ${d["songs"] ?? "?"} song${d["songs"] === "1" ? "" : "s"}`
    : kind;
  return [
    ...oneTime.map((p) => {
      const d = (p.details ?? {}) as Record<string, string>;
      return { type: kindLabel(p.kind, d), environment: p.environment, status: d["refunded_at"] ? "Refunded" : "Paid", created_at: p.created_at };
    }),
    ...plans.map((s) => ({
      type: `${PRICE_TIER[s.price_id] ? TIER_LABEL[PRICE_TIER[s.price_id]!] : s.price_id} (yearly plan)`,
      environment: s.environment,
      status: s.status === "canceled" ? "Canceled" : s.status.charAt(0).toUpperCase() + s.status.slice(1).replace(/_/g, " "),
      created_at: s.created_at,
    })),
  ].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
}

/** Returns the caller's staff role and departments, or null for regular users. */
export const getStaffRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffAccess | null> => {
    const { data } = await context.supabase.from("user_roles").select("role, departments").eq("user_id", context.userId);
    return resolveAccess(data ?? []);
  });

/** Staff overview across all users, limited to the sections the caller's departments allow. */
export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows } = await context.supabase.from("user_roles").select("role, departments").eq("user_id", context.userId);
    const access = resolveAccess(rows ?? []);
    if (!access || access.role === "hr_admin") throw new Error("Forbidden");
    const has = (d: StaffAccess["departments"][number]) => access.departments.includes(d);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [certs, regs, splits, purchases, plans] = await Promise.all([
      has("registration") || has("ai") ? supabaseAdmin.from("ai_protection_certificates").select("id, track_title, artist_name, format_type, blockchain_status, is_verified, issued_at").order("issued_at", { ascending: false }).limit(100) : null,
      has("registration") ? supabaseAdmin.from("agency_registrations").select("id, target_agency, status, has_signed_authorization, created_at").order("created_at", { ascending: false }).limit(100) : null,
      has("royalty_accounts") ? supabaseAdmin.from("split_sheets").select("id, collaborator_email, role, assigned_percentage, is_owner, signed_at, invited_at").order("invited_at", { ascending: false, nullsFirst: false }).limit(200) : null,
      has("finance") ? supabaseAdmin.from("purchases").select("kind, details, environment, created_at").order("created_at", { ascending: false }).limit(100) : null,
      has("finance") ? supabaseAdmin.from("subscriptions").select("price_id, status, environment, created_at").not("stripe_subscription_id", "is", null).order("created_at", { ascending: false }).limit(100) : null,
    ]);
    return {
      certificates: certs?.data ?? [],
      registrations: regs?.data ?? [],
      splits: splits?.data ?? [],
      purchases: purchaseList(purchases?.data ?? [], plans?.data ?? []),
    };
  });
