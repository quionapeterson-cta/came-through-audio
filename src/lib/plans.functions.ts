import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mergePlans, type CompanyPlan } from "@/lib/company-plans";
import { REPO_PLANS } from "@/lib/company-plans.server";

export type { CompanyPlan };

/**
 * Super admins only: every company plan (Admin → Plans). The plans main holds are read from `PLAN-*.md` in the server
 * bundle, so a merge to main updates the tab with no paste; rows loaded into `company_plans` by hand still show for any
 * slug the repository does not have. Row security also limits that table to super admins.
 */
export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CompanyPlan[]> => {
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("Forbidden");
    const { data, error } = await context.supabase
      .from("company_plans" as never)
      .select("slug, title, status, body, updated_at")
      .order("title");
    // A database that cannot answer must not hide the plans the repository already has.
    if (error) return mergePlans(REPO_PLANS, []);
    return mergePlans(REPO_PLANS, (data ?? []) as unknown as CompanyPlan[]);
  });
