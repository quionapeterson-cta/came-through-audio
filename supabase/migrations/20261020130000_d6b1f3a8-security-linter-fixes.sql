-- Security linter fixes. Grants and policies only: no tables, columns or rows change.

-- 1. RLS was on with no policies, so nobody could use these tables through the API.
-- Staff roster: only people who manage staff (super_admin, hr_admin) can read or edit it.
-- The signup trigger is SECURITY DEFINER, so it keeps reading the whitelist.
DROP POLICY IF EXISTS "Staff managers manage the whitelist" ON public.admin_whitelist;
CREATE POLICY "Staff managers manage the whitelist" ON public.admin_whitelist FOR ALL TO authenticated
  USING (public.can_manage_staff(auth.uid()))
  WITH CHECK (public.can_manage_staff(auth.uid()));

-- Health checks: owners read the checks for their own songs; staff can read and maintain all of them.
DROP POLICY IF EXISTS "Owners read their health checks" ON public.royalty_health_checks;
CREATE POLICY "Owners read their health checks" ON public.royalty_health_checks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.catalogs c WHERE c.id = royalty_health_checks.catalog_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "Staff manage health checks" ON public.royalty_health_checks;
CREATE POLICY "Staff manage health checks" ON public.royalty_health_checks FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- 2. Trigger functions only ever run from their triggers, which don't need EXECUTE, so nobody
-- may call them directly. Looked up by name because rls_auto_enable was created outside these migrations.
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('assign_admin_role_on_signup', 'handle_new_user', 'rls_auto_enable')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;

-- 3. Helpers stay callable by signed-in users on purpose: RLS policies run as the signed-in user and call
-- has_role / is_staff / in_department / can_manage_staff / is_room_*; the /sign page calls the split-invite RPCs.
-- Re-assert that anonymous visitors can't call them.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.user_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.in_department(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_room_host(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_room_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_split_invite(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sign_split_invite(uuid, text, text, text, text) FROM PUBLIC, anon;
