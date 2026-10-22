-- Company agreements can be signed without an account: the signer opens their private link (an HMAC of the party id,
-- never stored) and confirms a 6-digit code emailed to the invited address. Adds columns and one table only;
-- no existing data is changed. Customer contracts and split sheets still sign through a logged-in account.

-- Signature evidence (PLAN-admin-contracts §3), written only by the signing functions.
ALTER TABLE public.contract_parties ADD COLUMN IF NOT EXISTS consent_at timestamptz;
ALTER TABLE public.contract_parties ADD COLUMN IF NOT EXISTS ip_hash text;
ALTER TABLE public.contract_parties ADD COLUMN IF NOT EXISTS user_agent text CHECK (char_length(user_agent) <= 400);

-- One live code per party, stored as a hash. Server only: no client access at all.
CREATE TABLE IF NOT EXISTS public.contract_sign_codes (
  party_id uuid PRIMARY KEY REFERENCES public.contract_parties(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contract_sign_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contract_sign_codes FROM anon, authenticated;
GRANT ALL ON public.contract_sign_codes TO service_role;

-- Signs a company agreement for a party whose link and emailed code the server already checked.
-- Same signature hash as sign_contract, plus the consent time, hashed IP and device.
CREATE OR REPLACE FUNCTION public.sign_contract_by_link(_party_id uuid, _signature_name text, _ip_hash text, _user_agent text)
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

REVOKE ALL ON FUNCTION public.sign_contract_by_link(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sign_contract_by_link(uuid, text, text, text) TO service_role;
