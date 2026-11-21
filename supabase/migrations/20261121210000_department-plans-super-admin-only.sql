-- Task Bank → Plans are the super admin's alone (founder, 2026-11-21).
--
-- Phase 4 item 9 (2026-10-25) gave every department a quarterly plan generated from its scorecard: the lead set the
-- targets, milestones became Task Bank tasks, and finishing them filled the bar. A plan is that department's numbers,
-- so it now sits with Legal and Company Contracts rather than with the team that carries it out: the toggle is hidden
-- for everyone else in the app (canViewDepartmentPlans in src/lib/departments.ts) and the two policies that let staff
-- read or change a plan are replaced by one super-admin policy here.
--
-- What stays: every staff member keeps their Task Bank, including the ordinary tasks a plan's milestones created —
-- those are department_tasks rows and this file does not touch them, nor the existing plans and their goals.
-- Additive to the rest of the schema and safe to run more than once.

DROP POLICY IF EXISTS "Department staff manage their plans" ON public.department_plans;
DROP POLICY IF EXISTS "Project managers read every team's plans" ON public.department_plans;
DROP POLICY IF EXISTS "Super admins manage department plans" ON public.department_plans;
CREATE POLICY "Super admins manage department plans" ON public.department_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
