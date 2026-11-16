-- A block agreement can ask the signer to fill fields and tick choices (founder, 2026-11-16). Their answers are written on
-- the contract at the moment of signing, by the same function that records the signature, so a value can never arrive
-- after the agreement is closed and one signature covers both the words and the answers.

ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS block_values jsonb NOT NULL DEFAULT '{}'::jsonb;

-- The old four-argument function is replaced, not overloaded: PostgREST would otherwise have to guess between them.
DROP FUNCTION IF EXISTS public.sign_contract_by_link(uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.sign_contract_by_link(
  _party_id uuid,
  _signature_name text,
  _ip_hash text,
  _user_agent text,
  _values jsonb DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; k record; ts timestamptz := now(); done boolean := false;
BEGIN
  SELECT * INTO p FROM contract_parties WHERE id = _party_id FOR UPDATE;
  IF p IS NULL THEN RAISE EXCEPTION 'Signature request not found.'; END IF;
  IF p.signed_at IS NOT NULL THEN RAISE EXCEPTION 'Already signed.'; END IF;
  SELECT * INTO k FROM contracts WHERE id = p.contract_id FOR UPDATE;
  IF NOT k.is_company THEN RAISE EXCEPTION 'This contract is signed by logging in.'; END IF;
  IF k.status <> 'sent' THEN RAISE EXCEPTION 'This contract is not open for signing.'; END IF;
  IF lower(trim(_signature_name)) <> lower(trim(p.legal_name)) THEN RAISE EXCEPTION 'Type your legal name exactly as listed.'; END IF;
  -- Only an object is merged, and only keys the contract already holds blocks for can matter to the page; anything else
  -- is ignored rather than written.
  IF _values IS NOT NULL AND jsonb_typeof(_values) = 'object' THEN
    UPDATE contracts SET block_values = k.block_values || _values, updated_at = ts WHERE id = k.id;
  END IF;
  PERFORM set_config('cta.signing', 'on', true);
  UPDATE contract_parties SET signature_name = trim(p.legal_name), signed_at = ts, consent_at = ts,
    ip_hash = _ip_hash, user_agent = left(_user_agent, 400),
    signature_hash = encode(extensions.digest(k.body_hash || '|' || p.id::text || '|' || trim(p.legal_name) || '|' || lower(p.email) || '|' || ts::text, 'sha256'), 'hex')
  WHERE id = p.id;
  IF NOT EXISTS (SELECT 1 FROM contract_parties WHERE contract_id = k.id AND signed_at IS NULL) THEN
    UPDATE contracts SET status = 'signed', completed_at = ts, updated_at = ts WHERE id = k.id;
    done := true;
  END IF;
  PERFORM set_config('cta.signing', 'off', true);
  RETURN jsonb_build_object('completed', done);
END $$;

REVOKE ALL ON FUNCTION public.sign_contract_by_link(uuid, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sign_contract_by_link(uuid, text, text, text, jsonb) TO authenticated, service_role;

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
  IF k.status NOT IN ('sent','signed') THEN RAISE EXCEPTION 'This contract is not ready for signing yet.'; END IF;
  RETURN jsonb_build_object(
    'party_id', p.id, 'contract_id', k.id, 'title', k.title, 'blueprint', k.blueprint, 'body', k.body, 'body_hash', k.body_hash,
    'blocks', k.blocks, 'block_values', k.block_values,
    'status', k.status, 'sent_at', k.sent_at, 'completed_at', k.completed_at,
    'legal_name', p.legal_name, 'role', p.role, 'signed_at', p.signed_at,
    'can_sign', lower(p.email) = lower(coalesce(auth.jwt()->>'email','')),
    'parties', (SELECT jsonb_agg(jsonb_build_object('name', x.legal_name, 'role', x.role, 'signed_at', x.signed_at,
      'signature_name', x.signature_name, 'signature_hash', x.signature_hash) ORDER BY x.position, x.created_at)
      FROM contract_parties x WHERE x.contract_id = k.id)
  );
END $$;
