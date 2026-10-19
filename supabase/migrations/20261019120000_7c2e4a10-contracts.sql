-- Contracts: custom contracts built from blueprints, signature requests, and the signed contract vault.
-- New tables only; no existing data is touched.
--
-- Lifecycle: draft (owner edits freely) -> sent (send_contract freezes the text and stores its SHA-256)
-- -> signed (every party has signed through sign_contract). Signatures are only ever written by the
-- SECURITY DEFINER functions below, and each one is checked against the signer's verified email.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  blueprint text NOT NULL CHECK (char_length(blueprint) BETWEEN 1 AND 60),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  catalog_id uuid REFERENCES public.catalogs(id) ON DELETE SET NULL,
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 100000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed')),
  body_hash text,
  sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contracts_user_id ON public.contracts (user_id);

CREATE TABLE IF NOT EXISTS public.contract_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (char_length(role) BETWEEN 1 AND 60),
  legal_name text NOT NULL DEFAULT '' CHECK (char_length(legal_name) <= 200),
  email text NOT NULL DEFAULT '' CHECK (char_length(email) <= 320),
  is_owner boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  invited_at timestamptz,
  signature_name text,
  signature_hash text,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contract_parties_contract_id ON public.contract_parties (contract_id);
CREATE INDEX IF NOT EXISTS contract_parties_email ON public.contract_parties (lower(email));

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_parties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage own contracts" ON public.contracts;
CREATE POLICY "Owners manage own contracts" ON public.contracts FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND (catalog_id IS NULL OR EXISTS (SELECT 1 FROM public.catalogs c WHERE c.id = catalog_id AND c.user_id = auth.uid())));

DROP POLICY IF EXISTS "Owners manage parties of own contracts" ON public.contract_parties;
CREATE POLICY "Owners manage parties of own contracts" ON public.contract_parties FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contracts k WHERE k.id = contract_id AND k.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.contracts k WHERE k.id = contract_id AND k.user_id = auth.uid()));

-- Clients may only write the editable columns. Status, hashes and signatures go through the functions below.
REVOKE INSERT, UPDATE ON public.contracts FROM authenticated, anon;
GRANT INSERT (blueprint, title, catalog_id, fields, body) ON public.contracts TO authenticated;
GRANT UPDATE (blueprint, title, catalog_id, fields, body, updated_at) ON public.contracts TO authenticated;
REVOKE INSERT, UPDATE ON public.contract_parties FROM authenticated, anon;
GRANT INSERT (contract_id, role, legal_name, email, is_owner, position) ON public.contract_parties TO authenticated;
GRANT UPDATE (role, legal_name, email, position, invited_at) ON public.contract_parties TO authenticated;

-- Once sent, the contract text and its parties are frozen (only invited_at may still change).
CREATE OR REPLACE FUNCTION public.freeze_sent_contract()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status <> 'draft' AND (NEW.body IS DISTINCT FROM OLD.body OR NEW.fields IS DISTINCT FROM OLD.fields
    OR NEW.title IS DISTINCT FROM OLD.title OR NEW.blueprint IS DISTINCT FROM OLD.blueprint OR NEW.catalog_id IS DISTINCT FROM OLD.catalog_id) THEN
    RAISE EXCEPTION 'This contract was sent for signature and can no longer be edited.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS freeze_sent_contract ON public.contracts;
CREATE TRIGGER freeze_sent_contract BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.freeze_sent_contract();

CREATE OR REPLACE FUNCTION public.freeze_sent_contract_parties()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s text;
BEGIN
  -- The signing functions set this flag; they are the only writers allowed past the freeze.
  IF current_setting('cta.signing', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT status INTO s FROM contracts WHERE id = COALESCE(NEW.contract_id, OLD.contract_id);
  IF s IS NULL OR s = 'draft' THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'UPDATE' AND NEW.role = OLD.role AND NEW.legal_name = OLD.legal_name AND NEW.email = OLD.email
    AND NEW.position = OLD.position AND NEW.signed_at IS NOT DISTINCT FROM OLD.signed_at THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'This contract was sent for signature, so its parties can no longer change.';
END $$;
DROP TRIGGER IF EXISTS freeze_sent_contract_parties ON public.contract_parties;
CREATE TRIGGER freeze_sent_contract_parties BEFORE INSERT OR UPDATE OR DELETE ON public.contract_parties FOR EACH ROW EXECUTE FUNCTION public.freeze_sent_contract_parties();

-- Owner locks the text and opens signing.
CREATE OR REPLACE FUNCTION public.send_contract(_contract_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k record; n int; bad int; h text;
BEGIN
  SELECT * INTO k FROM contracts WHERE id = _contract_id AND user_id = auth.uid();
  IF k IS NULL THEN RAISE EXCEPTION 'Contract not found.'; END IF;
  IF k.status <> 'draft' THEN RETURN k.body_hash; END IF;
  IF char_length(trim(k.body)) = 0 THEN RAISE EXCEPTION 'Add the contract text first.'; END IF;
  SELECT count(*), count(*) FILTER (WHERE trim(legal_name) = '' OR email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') INTO n, bad FROM contract_parties WHERE contract_id = k.id;
  IF n < 2 THEN RAISE EXCEPTION 'Add at least two parties.'; END IF;
  IF bad > 0 THEN RAISE EXCEPTION 'Every party needs a legal name and a valid email.'; END IF;
  h := encode(extensions.digest(k.body, 'sha256'), 'hex');
  UPDATE contracts SET status = 'sent', body_hash = h, sent_at = now(), updated_at = now() WHERE id = k.id;
  RETURN h;
END $$;

-- Owner can unlock a sent contract for edits, but only while nobody has signed.
CREATE OR REPLACE FUNCTION public.reopen_contract(_contract_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM contracts WHERE id = _contract_id AND user_id = auth.uid() AND status = 'sent') THEN RAISE EXCEPTION 'Only a sent, unsigned contract can be reopened.'; END IF;
  IF EXISTS (SELECT 1 FROM contract_parties WHERE contract_id = _contract_id AND signed_at IS NOT NULL) THEN RAISE EXCEPTION 'Someone already signed, so this contract can no longer change.'; END IF;
  UPDATE contracts SET status = 'draft', body_hash = NULL, sent_at = NULL, updated_at = now() WHERE id = _contract_id;
END $$;

-- What a party (or the owner) sees on the signing page.
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
  IF k.status = 'draft' THEN RAISE EXCEPTION 'This contract is not ready for signing yet.'; END IF;
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

-- Typed e-signature. The hash binds the frozen contract text, the party, the typed name, the email and the time.
CREATE OR REPLACE FUNCTION public.sign_contract(_party_id uuid, _signature_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; k record; ts timestamptz := now();
BEGIN
  SELECT * INTO p FROM contract_parties WHERE id = _party_id FOR UPDATE;
  IF p IS NULL THEN RAISE EXCEPTION 'Signature request not found.'; END IF;
  IF lower(p.email) <> lower(coalesce(auth.jwt()->>'email','')) THEN RAISE EXCEPTION 'This signature request was sent to a different email.'; END IF;
  IF p.signed_at IS NOT NULL THEN RAISE EXCEPTION 'Already signed.'; END IF;
  SELECT * INTO k FROM contracts WHERE id = p.contract_id FOR UPDATE;
  IF k.status <> 'sent' THEN RAISE EXCEPTION 'This contract is not open for signing.'; END IF;
  IF lower(trim(_signature_name)) <> lower(trim(p.legal_name)) THEN RAISE EXCEPTION 'Type your legal name exactly as listed.'; END IF;
  PERFORM set_config('cta.signing', 'on', true);
  UPDATE contract_parties SET signature_name = trim(p.legal_name), signed_at = ts,
    signature_hash = encode(extensions.digest(k.body_hash || '|' || p.id::text || '|' || trim(p.legal_name) || '|' || lower(p.email) || '|' || ts::text, 'sha256'), 'hex')
  WHERE id = p.id;
  IF NOT EXISTS (SELECT 1 FROM contract_parties WHERE contract_id = k.id AND signed_at IS NULL) THEN
    UPDATE contracts SET status = 'signed', completed_at = ts, updated_at = ts WHERE id = k.id;
  END IF;
  PERFORM set_config('cta.signing', 'off', true);
END $$;

-- Contracts other people sent to me, for my own vault.
CREATE OR REPLACE FUNCTION public.my_contract_invites()
RETURNS TABLE (party_id uuid, title text, role text, status text, signed_at timestamptz, sent_at timestamptz, completed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, k.title, p.role, k.status, p.signed_at, k.sent_at, k.completed_at
  FROM contract_parties p JOIN contracts k ON k.id = p.contract_id
  WHERE lower(p.email) = lower(coalesce(auth.jwt()->>'email','')) AND k.user_id <> auth.uid() AND k.status <> 'draft'
  ORDER BY k.sent_at DESC
$$;

REVOKE ALL ON FUNCTION public.send_contract(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reopen_contract(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_contract_invite(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sign_contract(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_contract_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_contract(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_contract(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contract_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sign_contract(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_contract_invites() TO authenticated;
