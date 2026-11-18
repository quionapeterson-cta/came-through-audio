-- The Project Manager read policy is the one path round the launch guard (founder, 2026-11-18).
--
-- "Project managers read every team's tasks/plans" (sees_all_teams) matches super_admin and project_manager, so a
-- Project Manager could still read the launch bank through the API even though the app never lists it for them. These
-- two policies now stop at launch: a super admin keeps every team, a Project Manager keeps every team but that one.
--
-- The change is a narrowing only. Both policies stay SELECT and authenticated, and department staff keep their own
-- rows through "Department staff manage their tasks/plans" (public.in_department, guarded in 20261118120000).

ALTER POLICY "Project managers read every team's tasks" ON public.department_tasks
  USING (public.sees_all_teams(auth.uid()) AND department <> 'launch');

ALTER POLICY "Project managers read every team's plans" ON public.department_plans
  USING (public.sees_all_teams(auth.uid()) AND department <> 'launch');
