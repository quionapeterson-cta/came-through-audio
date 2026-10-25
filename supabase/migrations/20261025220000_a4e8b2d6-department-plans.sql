-- Department plan generator (Phase 4 item 9, approved 2026-10-25): a quarter's plan per department with goals (the
-- department scorecard numbers) and milestones, which are Task Bank tasks linked by plan_id, so finishing them fills
-- the progress bar and earns the department's staff badge. Run after 20261025210100 (uses sees_all_teams).
-- Additive and safe to run again.
CREATE TABLE IF NOT EXISTS public.department_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL CHECK (department IN ('registration','royalty_accounts','finance','branding','marketing_sales','support','hr','ai','marketing','software','security','research','launch')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  period_start date NOT NULL,
  period_end date NOT NULL CHECK (period_end >= period_start),
  -- [{ "name", "target", "current", "unit", "lowerIsBetter" }]
  goals jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.department_tasks ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.department_plans(id) ON DELETE SET NULL;

ALTER TABLE public.department_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Department staff manage their plans" ON public.department_plans;
CREATE POLICY "Department staff manage their plans" ON public.department_plans FOR ALL TO authenticated
  USING (public.in_department(auth.uid(), department)) WITH CHECK (public.in_department(auth.uid(), department));
DROP POLICY IF EXISTS "Project managers read every team's plans" ON public.department_plans;
CREATE POLICY "Project managers read every team's plans" ON public.department_plans FOR SELECT TO authenticated
  USING (public.sees_all_teams(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.department_plans TO authenticated;
GRANT ALL ON public.department_plans TO service_role;
