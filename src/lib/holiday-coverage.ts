import type { StaffAccess } from "./departments";

/**
 * Holiday coverage (founder, 2026-11-05): one or two department leads work each break so members are not met with a
 * silent inbox, and any employee who wants the extra earnings can put their name down. Pay is NOT decided: the rate,
 * the hours and whether it is overtime are the founder's call, so this plan carries no number at all until then.
 *
 * The plan's wording lives in `holiday-coverage.server.ts` (founder, 2026-11-21), because the tab is for super admins
 * and department leads and a public JavaScript file is not a place for a restricted plan. The panel reads it through
 * `getHolidayPlan`, which applies the rule below first.
 */
export type CoverageSection = { title: string; points: string[]; undecided?: string };

/** Super admins and department leads see this plan; nobody else needs the rota. */
export function canSeeHolidayPlan(access: StaffAccess | null | undefined): boolean {
  return access?.role === "super_admin" || access?.role === "department_lead";
}
