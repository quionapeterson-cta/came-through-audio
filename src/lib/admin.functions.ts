import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Returns the caller's staff role, or null for regular users. */
export const getStaffRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const roles = (data ?? []).map((r) => r.role);
    if (roles.includes("super_admin")) return "super_admin" as const;
    if (roles.includes("employee")) return "employee" as const;
    return null;
  });

/** Staff-only overview of queues across all users. */
export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isStaff, error } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (error || !isStaff) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [certs, regs, splits, purchases, staff] = await Promise.all([
      supabaseAdmin.from("ai_protection_certificates").select("id, track_title, artist_name, format_type, blockchain_status, is_verified, issued_at").order("issued_at", { ascending: false }).limit(100),
      supabaseAdmin.from("agency_registrations").select("id, target_agency, status, has_signed_authorization, created_at").order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("split_sheets").select("id, collaborator_email, role, assigned_percentage, is_owner, signed_at, invited_at").order("invited_at", { ascending: false, nullsFirst: false }).limit(200),
      supabaseAdmin.from("purchases").select("id, kind, environment, created_at").order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("admin_whitelist").select("id, email, assigned_role, created_at").order("created_at"),
    ]);
    return {
      certificates: certs.data ?? [],
      registrations: regs.data ?? [],
      splits: splits.data ?? [],
      purchases: purchases.data ?? [],
      staff: staff.data ?? [],
    };
  });
