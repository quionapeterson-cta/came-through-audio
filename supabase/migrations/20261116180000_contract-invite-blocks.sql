-- The signing page shows a block-built agreement as its blocks (founder, 2026-11-16), so the invite payload carries them
-- alongside the plain text that is hashed. A contract with no blocks reads exactly as before.

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
    'blocks', k.blocks,
    'status', k.status, 'sent_at', k.sent_at, 'completed_at', k.completed_at,
    'legal_name', p.legal_name, 'role', p.role, 'signed_at', p.signed_at,
    'can_sign', lower(p.email) = lower(coalesce(auth.jwt()->>'email','')),
    'parties', (SELECT jsonb_agg(jsonb_build_object('name', x.legal_name, 'role', x.role, 'signed_at', x.signed_at,
      'signature_name', x.signature_name, 'signature_hash', x.signature_hash) ORDER BY x.position, x.created_at)
      FROM contract_parties x WHERE x.contract_id = k.id)
  );
END $$;
