-- Only a super admin may edit a company agreement (founder, 2026-11-22).
--
-- 20261116160000 gave the approver an editing policy and 20261117200000 made creating one super-admin only, but those
-- are permissive policies: the member's own "edit my contracts" policy still lets whoever owns a company row change it,
-- including a lead who drafted one before the 2026-11-17 narrowing. A restrictive policy is ANDed with every permissive
-- one, so an owner who is not a super admin is refused while the super admin's editing policy still applies.
--
-- Only UPDATE is restricted. Reading a company agreement was already the super admin's (20261116150000), and a company
-- signer fills and signs their half through the SECURITY DEFINER signing functions, not by updating these rows.

DROP POLICY IF EXISTS "Only super admins edit company contracts" ON public.contracts;
CREATE POLICY "Only super admins edit company contracts" ON public.contracts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    NOT coalesce(is_company, false)
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    NOT coalesce(is_company, false)
    OR public.has_role(auth.uid(), 'super_admin')
  );

DROP POLICY IF EXISTS "Only super admins edit company contract parties" ON public.contract_parties;
CREATE POLICY "Only super admins edit company contract parties" ON public.contract_parties AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.contracts k
      WHERE k.id = contract_parties.contract_id AND coalesce(k.is_company, false)
    )
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.contracts k
      WHERE k.id = contract_parties.contract_id AND coalesce(k.is_company, false)
    )
    OR public.has_role(auth.uid(), 'super_admin')
  );
