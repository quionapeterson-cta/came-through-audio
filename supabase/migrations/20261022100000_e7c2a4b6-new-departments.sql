-- New staff departments (founder, 2026-10-20): AI, Marketing, Software and Security.
-- Marketing gets its own department; the existing marketing_sales id stays and is now shown as "Sales".
-- Everyone already in marketing_sales is also added to marketing, so nobody loses access they have today.
-- Admin → Badges moves from Marketing & Sales to Marketing (with Branding and Support). The AI department sees the
-- AI Protection tab through the staff-verified admin server function, so no new table policies are needed.
-- Safe to run more than once.

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_departments_valid;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_departments_valid CHECK (
  departments <@ ARRAY['registration','royalty_accounts','finance','branding','marketing_sales','support','hr','ai','marketing','software','security']::text[]
);

UPDATE public.user_roles SET departments = array_append(departments, 'marketing')
WHERE 'marketing_sales' = ANY(departments) AND NOT 'marketing' = ANY(departments);

ALTER TABLE public.department_tasks DROP CONSTRAINT IF EXISTS department_tasks_department_check;
ALTER TABLE public.department_tasks ADD CONSTRAINT department_tasks_department_check CHECK (
  department IN ('registration','royalty_accounts','finance','branding','marketing_sales','support','hr','ai','marketing','software','security')
);

CREATE OR REPLACE FUNCTION public.can_manage_badges(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.in_department(_user_id, 'branding') OR public.in_department(_user_id, 'marketing') OR public.in_department(_user_id, 'support')
$$;
REVOKE ALL ON FUNCTION public.can_manage_badges(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_badges(uuid) TO authenticated, service_role;
