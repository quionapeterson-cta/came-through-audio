-- The approver edits and the brand kit, both found by walking the loop end to end (2026-11-16).
--
-- 1. A Super Admin reading a lead's agreement in the queue could not save a correction: the only UPDATE policy on
--    contracts was the owner's, and the only parties policy the same. Approval itself works through send_contract's
--    SECURITY DEFINER sibling, but "read and edit, then approve" needs the wording to be writable by the approver.
--    Status, body_hash, sent_at and the approval record are NOT in the column-level UPDATE grant, so this cannot flip a
--    state or forge a fingerprint, and freeze_sent_contract still refuses to touch a settled agreement.
-- 2. brand_kit_id was readable and writable nowhere: picking a branding kit and saving a new contract failed with
--    "permission denied for column brand_kit_id". It is the member's own choice of their own kit, so it joins the columns
--    the browser may set.

CREATE POLICY "Super admins edit company contracts" ON public.contracts
  FOR UPDATE TO authenticated
  USING (coalesce(is_company, false) AND public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (coalesce(is_company, false) AND public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins edit company contract parties" ON public.contract_parties
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contracts k WHERE k.id = contract_parties.contract_id AND coalesce(k.is_company, false) AND public.has_role(auth.uid(), 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.contracts k WHERE k.id = contract_parties.contract_id AND coalesce(k.is_company, false) AND public.has_role(auth.uid(), 'super_admin')));

GRANT INSERT (brand_kit_id), UPDATE (brand_kit_id) ON public.contracts TO authenticated;
