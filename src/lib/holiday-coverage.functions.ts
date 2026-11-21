import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAccess } from "@/lib/departments";
import { canSeeHolidayPlan, type CoverageSection } from "@/lib/holiday-coverage";
import {
  COVERAGE_SECTIONS,
  HOLIDAY_BREAKS,
  HOLIDAY_PAY_STATUS,
} from "@/lib/holiday-coverage.server";

export type HolidayPlanData = {
  breaks: string[];
  payStatus: "undecided";
  sections: CoverageSection[];
};

/**
 * Admin → Holiday Cover (founder, 2026-11-05; server-side 2026-11-21): the rota is super admins and department leads
 * only, and the rule is the same `canSeeHolidayPlan` the menu uses. Nothing about the plan travels in the bundle.
 */
export const getHolidayPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HolidayPlanData> => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role, departments")
      .eq("user_id", context.userId);
    const access = resolveAccess((data ?? []) as { role: string; departments?: string[] | null }[]);
    if (!canSeeHolidayPlan(access))
      throw new Error("Holiday Cover is for super admins and department leads.");
    return {
      breaks: [...HOLIDAY_BREAKS],
      payStatus: HOLIDAY_PAY_STATUS,
      sections: COVERAGE_SECTIONS,
    };
  });
