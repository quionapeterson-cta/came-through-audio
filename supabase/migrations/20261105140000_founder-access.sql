-- Founder-only badge decisions (founder, 2026-11-05). Approving badge art and marking it uploaded to R2 used to depend
-- on the super_admin role; it now depends on one account, claimed once in Admin → Badges → Badge Protocol. A later super
-- admin can read the queue but cannot approve it. Additive.
CREATE TABLE IF NOT EXISTS public.founder_access (
  user_id uuid PRIMARY KEY,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.founder_access TO authenticated;
GRANT ALL ON public.founder_access TO service_role;

ALTER TABLE public.founder_access ENABLE ROW LEVEL SECURITY;

-- Staff who run badges can see whether the seat is claimed.
DROP POLICY IF EXISTS "Super admins read founder access" ON public.founder_access;
CREATE POLICY "Super admins read founder access" ON public.founder_access FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- One seat, one account: writes only ever come from the server after it has checked the caller.
DROP POLICY IF EXISTS "No client writes to founder access" ON public.founder_access;

CREATE OR REPLACE FUNCTION public.is_founder(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.founder_access WHERE user_id = _user_id);
$$;
REVOKE ALL ON FUNCTION public.is_founder(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_founder(uuid) TO authenticated, service_role;

-- Badge decisions move from the super_admin role to the founder's account.
DROP POLICY IF EXISTS "Super admins decide submissions" ON public.badge_submissions;
DROP POLICY IF EXISTS "Founder decides submissions" ON public.badge_submissions;
CREATE POLICY "Founder decides submissions" ON public.badge_submissions FOR UPDATE TO authenticated
  USING (public.is_founder(auth.uid())) WITH CHECK (public.is_founder(auth.uid()));
