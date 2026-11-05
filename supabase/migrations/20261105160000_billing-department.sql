-- Billing department (founder, 2026-11-05): a dedicated seat for refunds, plan cancellations and billing questions, so
-- the person who handles billing does not have to sit in Finance. Finance keeps its access too. Additive, safe to run
-- more than once.
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_departments_valid;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_departments_valid CHECK (
  departments <@ ARRAY['registration','royalty_accounts','finance','billing','branding','marketing_sales','support','hr','ai','marketing','software','security','research','launch']::text[]
);

-- Task Bank and department plans each list their departments too; without these a Billing task could not be saved.
ALTER TABLE public.department_tasks DROP CONSTRAINT IF EXISTS department_tasks_department_check;
ALTER TABLE public.department_tasks ADD CONSTRAINT department_tasks_department_check CHECK (
  department IN ('registration','royalty_accounts','finance','billing','branding','marketing_sales','support','hr','ai','marketing','software','security','research','launch')
);

ALTER TABLE public.department_plans DROP CONSTRAINT IF EXISTS department_plans_department_check;
ALTER TABLE public.department_plans ADD CONSTRAINT department_plans_department_check CHECK (
  department IN ('registration','royalty_accounts','finance','billing','branding','marketing_sales','support','hr','ai','marketing','software','security','research','launch')
);

-- The console's log policy follows the new department, exactly as src/lib/departments.ts does.
CREATE OR REPLACE FUNCTION public.can_see_billing(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = 'super_admin' OR 'billing' = ANY (departments) OR 'finance' = ANY (departments))
  );
$$;
REVOKE ALL ON FUNCTION public.can_see_billing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_billing(uuid) TO authenticated, service_role;
