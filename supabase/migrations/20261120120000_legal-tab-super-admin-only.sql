-- Admin → Legal is the super admin's alone (founder, 2026-11-20): the Security department no longer replaces the wording
-- of the Terms, Privacy Policy or Refund Policy. The tab and this policy now say the same thing, and every change and
-- removal still lands in legal_override_history. Replaces the department check from 20261027200000; additive otherwise.
CREATE OR REPLACE FUNCTION public.can_edit_legal(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'super_admin')
$$;
REVOKE ALL ON FUNCTION public.can_edit_legal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_legal(uuid) TO authenticated, service_role;
