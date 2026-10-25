-- Admin calendar (Phase 4 item 8, approved 2026-10-25), part 2 of 2. Run 20261025210000 first.
-- Private entries (only their owner sees them), department calendars shared inside each department, department leads
-- see every department's calendar, super admins see every department, and the Project Manager role sees every team's
-- calendar and Task Bank (read only). Project managers get no other staff data. Additive and safe to run again.

CREATE OR REPLACE FUNCTION public.sees_all_teams(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text IN ('super_admin', 'project_manager'))
$$;
CREATE OR REPLACE FUNCTION public.is_department_lead(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = 'department_lead')
$$;
REVOKE ALL ON FUNCTION public.sees_all_teams(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_department_lead(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sees_all_teams(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_department_lead(uuid) TO authenticated, service_role;

-- Project managers read every team's Task Bank (they can't add, change or delete tasks).
DROP POLICY IF EXISTS "Project managers read every team's tasks" ON public.department_tasks;
CREATE POLICY "Project managers read every team's tasks" ON public.department_tasks FOR SELECT TO authenticated
  USING (public.sees_all_teams(auth.uid()));

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  -- NULL = a private entry; otherwise the department whose calendar it's on.
  department text CHECK (department IS NULL OR department IN ('registration','royalty_accounts','finance','branding','marketing_sales','support','hr','ai','marketing','software','security','research','launch')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 5000),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX IF NOT EXISTS calendar_events_starts ON public.calendar_events (starts_at);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "See own, department and allowed calendars" ON public.calendar_events;
CREATE POLICY "See own, department and allowed calendars" ON public.calendar_events FOR SELECT TO authenticated USING (
  owner_id = auth.uid()
  OR (department IS NOT NULL AND (public.in_department(auth.uid(), department) OR public.sees_all_teams(auth.uid()) OR public.is_department_lead(auth.uid())))
);
DROP POLICY IF EXISTS "Add to own or own department calendar" ON public.calendar_events;
CREATE POLICY "Add to own or own department calendar" ON public.calendar_events FOR INSERT TO authenticated WITH CHECK (
  owner_id = auth.uid() AND (department IS NULL OR public.in_department(auth.uid(), department))
);
DROP POLICY IF EXISTS "Owners change their entries" ON public.calendar_events;
CREATE POLICY "Owners change their entries" ON public.calendar_events FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND (department IS NULL OR public.in_department(auth.uid(), department)));
DROP POLICY IF EXISTS "Owners delete their entries" ON public.calendar_events;
CREATE POLICY "Owners delete their entries" ON public.calendar_events FOR DELETE TO authenticated USING (owner_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
