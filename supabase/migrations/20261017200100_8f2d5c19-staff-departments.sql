-- Departments live on the staff role row; one employee can belong to several.
-- The column may already exist (added from the dashboard), so every step here is safe to re-run.
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS departments text[] DEFAULT '{}';
ALTER TABLE public.user_roles ALTER COLUMN departments SET DEFAULT '{}';
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_departments_valid;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_departments_valid CHECK (
  departments <@ ARRAY['registration','royalty_accounts','finance','branding','marketing_sales','support','hr']::text[]
);

-- Existing employees keep every working department until HR trims them, so nobody is locked out on deploy.
UPDATE public.user_roles
SET departments = ARRAY['registration','royalty_accounts','finance','branding','marketing_sales','support']
WHERE role = 'employee' AND COALESCE(departments, '{}') = '{}';
UPDATE public.user_roles SET departments = '{}' WHERE departments IS NULL;

-- Department leads work inside departments like employees. hr_admin only manages staff, so it is not "staff" here
-- (no site_settings, tickets or queues).
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','employee','department_lead'))
$$;

CREATE OR REPLACE FUNCTION public.in_department(_user_id uuid, _dept text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND (
      role = 'super_admin'
      OR (role IN ('employee','department_lead') AND _dept = ANY(departments))
      OR (role = 'hr_admin' AND _dept = 'hr')
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','hr_admin'))
$$;

REVOKE EXECUTE ON FUNCTION public.in_department(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.in_department(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_staff(uuid) TO authenticated, service_role;

-- Department-scoped staff access.
DROP POLICY IF EXISTS "Admins handle registration queue" ON public.agency_registrations;
DROP POLICY IF EXISTS "Registration staff handle queue" ON public.agency_registrations;
CREATE POLICY "Registration staff handle queue" ON public.agency_registrations FOR ALL TO authenticated
  USING (public.in_department(auth.uid(), 'registration')) WITH CHECK (public.in_department(auth.uid(), 'registration'));

DROP POLICY IF EXISTS "Staff read tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Support staff read tickets" ON public.support_tickets;
CREATE POLICY "Support staff read tickets" ON public.support_tickets FOR SELECT TO authenticated
  USING (public.in_department(auth.uid(), 'support'));
DROP POLICY IF EXISTS "Staff update tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Support staff update tickets" ON public.support_tickets;
CREATE POLICY "Support staff update tickets" ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.in_department(auth.uid(), 'support')) WITH CHECK (public.in_department(auth.uid(), 'support'));
