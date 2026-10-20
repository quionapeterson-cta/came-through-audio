import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CompanyPlan = { slug: string; title: string; status: string; body: string; updated_at: string };

/** Super admins only: every company plan (Admin → Plans). Row security also limits the table to super admins. */
export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!isSuper) throw new Error("Forbidden");
    const { data, error } = await context.supabase.from("company_plans" as never).select("slug, title, status, body, updated_at").order("title");
    if (error) throw new Error("Couldn't load plans.");
    return (data ?? []) as unknown as CompanyPlan[];
  });
