-- Super Admin approval before a company agreement goes out (founder, 2026-11-16), part 2 of 2.
--
-- A department lead may now draft a company agreement, but nothing reaches a signer until a super admin approves it.
-- That rule is enforced here, in the database, because `send_contract` is callable from any browser holding a session:
-- the status alone would be advice, not a gate. Everything is additive — new statuses are a superset of the old three,
-- new columns are nullable, and existing rows keep their exact status and behaviour.

-- 1. Where the review stands, kept on the contract itself so the audit lives with the agreement.
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS reviewer_note text;

ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_reviewer_note;
ALTER TABLE public.contracts ADD CONSTRAINT contracts_reviewer_note
  CHECK (reviewer_note IS NULL OR char_length(reviewer_note) <= 2000);

-- 2. Two states join the three that shipped. 'changes_requested' is a draft the approver has read; 'pending_approval'
--    is a finished draft waiting. Both are unsendable until the functions below move them.
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_status_check;
ALTER TABLE public.contracts ADD CONSTRAINT contracts_status_check
  CHECK (status IN ('draft', 'pending_approval', 'changes_requested', 'sent', 'signed'));

-- 3. Who may author, and who may see, a company agreement. Creation widens to the four lead roles; reading widens to
--    the super admin, who would otherwise never see a contract they did not create (every policy here is user_id based).
DROP POLICY IF EXISTS "Only super admins create company contracts" ON public.contracts;
CREATE POLICY "Leads create company contracts" ON public.contracts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT coalesce(is_company, false)
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'hr_admin')
    OR public.has_role(auth.uid(), 'project_manager')
    OR public.has_role(auth.uid(), 'department_lead')
  );

DROP POLICY IF EXISTS "Super admins read company contracts" ON public.contracts;
CREATE POLICY "Super admins read company contracts" ON public.contracts FOR SELECT TO authenticated
  USING (coalesce(is_company, false) AND public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins read company contract parties" ON public.contract_parties;
CREATE POLICY "Super admins read company contract parties" ON public.contract_parties FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contracts k
    WHERE k.id = contract_parties.contract_id
      AND coalesce(k.is_company, false)
      AND public.has_role(auth.uid(), 'super_admin')
  ));

-- 4. The freeze grows a doorway instead of being removed: the text may change in a draft, while the approver is looking
--    at it, and after it is sent back for changes. A sent or signed contract stays frozen exactly as before.
CREATE OR REPLACE FUNCTION public.freeze_sent_contract()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status IN ('draft', 'changes_requested') THEN RETURN NEW; END IF;
  IF OLD.status = 'pending_approval' AND public.has_role(auth.uid(), 'super_admin') THEN RETURN NEW; END IF;
  IF NEW.body IS DISTINCT FROM OLD.body OR NEW.fields IS DISTINCT FROM OLD.fields
    OR NEW.title IS DISTINCT FROM OLD.title OR NEW.blueprint IS DISTINCT FROM OLD.blueprint
    OR NEW.catalog_id IS DISTINCT FROM OLD.catalog_id THEN
    RAISE EXCEPTION 'This contract was sent for signature and can no longer be edited.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS freeze_sent_contract ON public.contracts;
CREATE TRIGGER freeze_sent_contract BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.freeze_sent_contract();

CREATE OR REPLACE FUNCTION public.freeze_sent_contract_parties()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s text;
BEGIN
  -- The signing functions set this flag; they are the only writers allowed past the freeze.
  IF current_setting('cta.signing', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT status INTO s FROM contracts WHERE id = COALESCE(NEW.contract_id, OLD.contract_id);
  IF s IS NULL OR s IN ('draft', 'changes_requested') THEN RETURN COALESCE(NEW, OLD); END IF;
  IF s = 'pending_approval' AND public.has_role(auth.uid(), 'super_admin') THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'UPDATE' AND NEW.role = OLD.role AND NEW.legal_name = OLD.legal_name AND NEW.email = OLD.email
    AND NEW.position = OLD.position AND NEW.signed_at IS NOT DISTINCT FROM OLD.signed_at THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'This contract was sent for signature, so its parties can no longer change.';
END $$;
DROP TRIGGER IF EXISTS freeze_sent_contract_parties ON public.contract_parties;
CREATE TRIGGER freeze_sent_contract_parties BEFORE INSERT OR UPDATE OR DELETE ON public.contract_parties
  FOR EACH ROW EXECUTE FUNCTION public.freeze_sent_contract_parties();

-- 5. Sending. Same body as 20261108150000, with the approval gate in front of it. A lead's company agreement can never
--    reach 'sent' from here, whatever the browser calls.
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
  IF coalesce(k.is_company, false) AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Company agreements go out only after a Super Admin approves them. Submit it for approval instead.';
  END IF;
  IF k.status = 'pending_approval' THEN RAISE EXCEPTION 'This contract is waiting for Super Admin approval.'; END IF;
  IF k.status = 'changes_requested' THEN RAISE EXCEPTION 'This contract was sent back for changes. Fix it and resubmit for approval.'; END IF;
  IF NOT public.has_tier(auth.uid(), 'management') AND k.paid_purchase_id IS NULL THEN RAISE EXCEPTION 'Sending contracts for signature is included with Catalog Management, or with a $3.99 generated contract.'; END IF;
  IF k.status <> 'draft' THEN RETURN k.body_hash; END IF;
  IF char_length(trim(k.body)) = 0 THEN RAISE EXCEPTION 'Add the contract text first.'; END IF;
  -- POSIX classes rather than \s and \. so the pattern survives every SQL transport unchanged.
  SELECT count(*), count(*) FILTER (WHERE trim(legal_name) = '' OR email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') INTO n, bad FROM contract_parties WHERE contract_id = k.id;
  IF n < 2 THEN RAISE EXCEPTION 'Add at least two parties.'; END IF;
  IF bad > 0 THEN RAISE EXCEPTION 'Every party needs a legal name and a valid email.'; END IF;
  h := encode(extensions.digest(k.body, 'sha256'), 'hex');
  UPDATE contracts SET status = 'sent', body_hash = h, sent_at = now(), updated_at = now() WHERE id = k.id;
  RETURN h;
END $$;

-- 6. A lead hands the finished draft to the approver. Nothing is hashed yet, so nothing can be signed yet.
CREATE OR REPLACE FUNCTION public.submit_contract_for_approval(_contract_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k record; n int; bad int;
BEGIN
  SELECT * INTO k FROM contracts WHERE id = _contract_id AND user_id = auth.uid();
  IF k.id IS NULL THEN RAISE EXCEPTION 'Contract not found.'; END IF;
  IF NOT coalesce(k.is_company, false) THEN RAISE EXCEPTION 'Only company agreements are approved before sending.'; END IF;
  IF public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'A Super Admin sends their own agreements directly.'; END IF;
  IF k.status NOT IN ('draft', 'changes_requested') THEN RAISE EXCEPTION 'This contract is already with the approver or sent.'; END IF;
  IF char_length(trim(k.body)) = 0 THEN RAISE EXCEPTION 'Add the contract text first.'; END IF;
  SELECT count(*), count(*) FILTER (WHERE trim(legal_name) = '' OR email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') INTO n, bad FROM contract_parties WHERE contract_id = k.id;
  IF n < 2 THEN RAISE EXCEPTION 'Add at least two parties.'; END IF;
  IF bad > 0 THEN RAISE EXCEPTION 'Every party needs a legal name and a valid email.'; END IF;
  UPDATE contracts
    SET status = 'pending_approval', submitted_at = now(), submitted_by = auth.uid(),
        reviewer_note = NULL, updated_at = now()
    WHERE id = k.id;
END $$;

-- 7. The approver edits nothing here: they confirm what they read. The hash is taken now, so the signed text is the
--    approved text.
CREATE OR REPLACE FUNCTION public.approve_contract(_contract_id uuid, _note text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k record; n int; bad int; h text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Only a Super Admin can approve a company agreement.'; END IF;
  SELECT * INTO k FROM contracts WHERE id = _contract_id FOR UPDATE;
  IF k.id IS NULL THEN RAISE EXCEPTION 'Contract not found.'; END IF;
  IF k.status <> 'pending_approval' THEN RAISE EXCEPTION 'That contract is not waiting for approval.'; END IF;
  IF char_length(trim(k.body)) = 0 THEN RAISE EXCEPTION 'Add the contract text first.'; END IF;
  SELECT count(*), count(*) FILTER (WHERE trim(legal_name) = '' OR email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') INTO n, bad FROM contract_parties WHERE contract_id = k.id;
  IF n < 2 THEN RAISE EXCEPTION 'Add at least two parties.'; END IF;
  IF bad > 0 THEN RAISE EXCEPTION 'Every party needs a legal name and a valid email.'; END IF;
  h := encode(extensions.digest(k.body, 'sha256'), 'hex');
  UPDATE contracts
    SET status = 'sent', body_hash = h, sent_at = now(), approved_at = now(), approved_by = auth.uid(),
        reviewer_note = nullif(trim(coalesce(_note, '')), ''), updated_at = now()
    WHERE id = k.id;
  RETURN h;
END $$;

-- 8. Sent back with a reason. The note is internal: it lives on the contract and never prints on the PDF.
CREATE OR REPLACE FUNCTION public.request_contract_changes(_contract_id uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k record; reason text := trim(coalesce(_note, ''));
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Only a Super Admin can send a contract back.'; END IF;
  IF char_length(reason) < 3 THEN RAISE EXCEPTION 'Say what needs changing.'; END IF;
  SELECT * INTO k FROM contracts WHERE id = _contract_id FOR UPDATE;
  IF k.id IS NULL THEN RAISE EXCEPTION 'Contract not found.'; END IF;
  IF k.status <> 'pending_approval' THEN RAISE EXCEPTION 'That contract is not waiting for approval.'; END IF;
  UPDATE contracts
    SET status = 'changes_requested', reviewer_note = reason, updated_at = now()
    WHERE id = k.id;
END $$;

-- 9. The lead picks their draft back up. Only the owner (or the approver) may reopen it, and only from review.
CREATE OR REPLACE FUNCTION public.resume_changed_contract(_contract_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k record;
BEGIN
  SELECT * INTO k FROM contracts WHERE id = _contract_id;
  IF k.id IS NULL THEN RAISE EXCEPTION 'Contract not found.'; END IF;
  IF k.user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Contract not found.'; END IF;
  IF k.status <> 'changes_requested' THEN RAISE EXCEPTION 'That contract is not waiting for changes.'; END IF;
  UPDATE contracts SET status = 'draft', body_hash = NULL, sent_at = NULL, updated_at = now() WHERE id = k.id;
END $$;

-- 10. A contract in review is not signable, and not in anyone's signing inbox. Only a sent or signed agreement is.
CREATE OR REPLACE FUNCTION public.get_contract_invite(_party_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; k record;
BEGIN
  SELECT * INTO p FROM contract_parties WHERE id = _party_id;
  IF p IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO k FROM contracts WHERE id = p.contract_id;
  IF lower(p.email) <> lower(coalesce(auth.jwt()->>'email','')) AND k.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'This signature request was sent to a different email.';
  END IF;
  IF k.status NOT IN ('sent', 'signed') THEN RAISE EXCEPTION 'This contract is not ready for signing yet.'; END IF;
  RETURN jsonb_build_object(
    'party_id', p.id, 'contract_id', k.id, 'title', k.title, 'blueprint', k.blueprint, 'body', k.body, 'body_hash', k.body_hash,
    'status', k.status, 'sent_at', k.sent_at, 'completed_at', k.completed_at,
    'legal_name', p.legal_name, 'role', p.role, 'signed_at', p.signed_at,
    'can_sign', lower(p.email) = lower(coalesce(auth.jwt()->>'email','')),
    'parties', (SELECT jsonb_agg(jsonb_build_object('name', x.legal_name, 'role', x.role, 'signed_at', x.signed_at,
      'signature_name', x.signature_name, 'signature_hash', x.signature_hash) ORDER BY x.position, x.created_at)
      FROM contract_parties x WHERE x.contract_id = k.id)
  );
END $$;

CREATE OR REPLACE FUNCTION public.my_contract_invites()
RETURNS TABLE (party_id uuid, title text, role text, status text, signed_at timestamptz, sent_at timestamptz, completed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, k.title, p.role, k.status, p.signed_at, k.sent_at, k.completed_at
  FROM contract_parties p JOIN contracts k ON k.id = p.contract_id
  WHERE lower(p.email) = lower(coalesce(auth.jwt()->>'email','')) AND k.user_id <> auth.uid()
    AND k.status IN ('sent', 'signed')
  ORDER BY k.sent_at DESC
$$;

REVOKE ALL ON FUNCTION public.submit_contract_for_approval(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_contract(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_contract_changes(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resume_changed_contract(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_contract_for_approval(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_contract(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_contract_changes(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_changed_contract(uuid) TO authenticated;
