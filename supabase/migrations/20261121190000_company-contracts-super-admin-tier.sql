-- Company Contracts belongs to the super admin, not to a member plan (founder, 2026-11-21).
--
-- The 2026-10-19 tier pass made every contracts insert require Catalog Management. That is right for a member's own
-- deals, but Admin -> Company Contracts is the LLC's own paperwork: a super admin with a free account could open the
-- tab and build a template, then got "permission denied for table contracts" on Save draft. The same tier check on
-- contract_parties blocked the parties, and send_contract blocked sending the finished agreement.
--
-- Keep the member rule exactly as it was and carve out only company agreements saved by a super admin.

DROP POLICY IF EXISTS "Contracts need Catalog Management" ON public.contracts;
CREATE POLICY "Contracts need Catalog Management" ON public.contracts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    public.has_tier(auth.uid(), 'management')
    OR (coalesce(is_company, false) AND public.has_role(auth.uid(), 'super_admin'))
  );

DROP POLICY IF EXISTS "Contract parties need Catalog Management" ON public.contract_parties;
CREATE POLICY "Contract parties need Catalog Management" ON public.contract_parties AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    public.has_tier(auth.uid(), 'management')
    OR EXISTS (
      SELECT 1 FROM public.contracts k
      WHERE k.id = contract_parties.contract_id
        AND k.user_id = auth.uid()
        AND k.paid_purchase_id IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.contracts k
      WHERE k.id = contract_parties.contract_id
        AND coalesce(k.is_company, false)
        AND public.has_role(auth.uid(), 'super_admin')
    )
  );

CREATE OR REPLACE FUNCTION public.send_contract(_contract_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k record; n int; bad int; h text;
BEGIN
  SELECT * INTO k FROM contracts WHERE id = _contract_id;
  IF k.id IS NULL THEN RAISE EXCEPTION 'Contract not found.'; END IF;
  IF k.user_id <> auth.uid() THEN
    IF public.seat_is_live(auth.uid(), k.user_id) THEN
      RAISE EXCEPTION 'Only the artist can send this contract under their name. A seat lets you read it, not send it.';
    END IF;
    RAISE EXCEPTION 'Contract not found.';
  END IF;
  IF coalesce(k.is_company,false) AND NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Company agreements go out only after a Super Admin approves them. Submit it for approval instead.';
  END IF;
  IF k.status = 'pending_approval' THEN RAISE EXCEPTION 'This contract is waiting for Super Admin approval.'; END IF;
  IF k.status = 'changes_requested' THEN RAISE EXCEPTION 'This contract was sent back for changes. Fix it and resubmit for approval.'; END IF;
  IF NOT public.has_tier(auth.uid(),'management') AND k.paid_purchase_id IS NULL
     AND NOT (coalesce(k.is_company,false) AND public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Sending contracts for signature is included with Catalog Management, or with a % generated contract.', chr(36) || '3.99';
  END IF;
  IF k.status <> 'draft' THEN RETURN k.body_hash; END IF;
  IF char_length(trim(k.body)) = 0 THEN RAISE EXCEPTION 'Add the contract text first.'; END IF;
  SELECT count(*), count(*) FILTER (WHERE trim(legal_name) = '' OR email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') INTO n, bad FROM contract_parties WHERE contract_id = k.id;
  IF n < 2 THEN RAISE EXCEPTION 'Add at least two parties.'; END IF;
  IF bad > 0 THEN RAISE EXCEPTION 'Every party needs a legal name and a valid email.'; END IF;
  h := encode(extensions.digest(k.body, 'sha256'), 'hex');
  UPDATE contracts SET status = 'sent', body_hash = h, sent_at = now(), updated_at = now() WHERE id = k.id;
  RETURN h;
END $function$;

-- The block_values column arrived after the table's column grants were written, so PostgREST refused every insert that
-- carried it. template_id had the same gap on UPDATE: reopening a saved custom template and saving it failed.
GRANT INSERT (block_values) ON public.contracts TO authenticated;
GRANT UPDATE (block_values, template_id) ON public.contracts TO authenticated;
