import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAccess, type StaffAccess } from "./departments";

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
    const [certs, regs, splits, purchases] = await Promise.all([
      has("registration") || has("ai") ? supabaseAdmin.from("ai_protection_certificates").select("id, track_title, artist_name, format_type, blockchain_status, is_verified, issued_at").order("issued_at", { ascending: false }).limit(100) : null,
      has("registration") ? supabaseAdmin.from("agency_registrations").select("id, target_agency, status, has_signed_authorization, created_at").order("created_at", { ascending: false }).limit(100) : null,
      has("royalty_accounts") ? supabaseAdmin.from("split_sheets").select("id, collaborator_email, role, assigned_percentage, is_owner, signed_at, invited_at").order("invited_at", { ascending: false, nullsFirst: false }).limit(200) : null,
      has("finance") ? supabaseAdmin.from("purchases").select("id, kind, environment, created_at").order("created_at", { ascending: false }).limit(100) : null,
    ]);
    return {
      certificates: certs?.data ?? [],
      registrations: regs?.data ?? [],
      splits: splits?.data ?? [],
      purchases: purchases?.data ?? [],
    };
  });
