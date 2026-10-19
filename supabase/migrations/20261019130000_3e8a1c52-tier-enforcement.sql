-- Paid features enforced in the database, not only in the UI. Nothing existing is deleted or rewritten:
-- new functions, plus RESTRICTIVE policies that tighten what new writes are allowed.
--
-- Tier comes only from Paddle webhook rows in public.subscriptions (the client can never write them), with the
-- same rules as isActiveSub() in src/lib/plans.ts. When site_settings 'payments' names an environment
-- ({"environment":"live"}), only that environment's rows count, so sandbox test purchases can't unlock the live
-- site. Set it to live at launch:
--   insert into public.site_settings (id, content) values ('payments', '{"environment":"live"}')
--   on conflict (id) do update set content = excluded.content;
-- Super admins get full access for support and testing (the role can't be self-granted).

CREATE OR REPLACE FUNCTION public.user_tier(_uid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH env AS (
    SELECT content->>'environment' AS e FROM site_settings WHERE id = 'payments' AND content->>'environment' IN ('live', 'sandbox')
  ), active AS (
    SELECT s.price_id FROM subscriptions s
    WHERE s.user_id = _uid
      AND (NOT EXISTS (SELECT 1 FROM env) OR s.environment = (SELECT e FROM env))
      AND (
        (s.status IN ('active', 'trialing', 'past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR (s.status = 'canceled' AND s.current_period_end > now())
      )
  )
  SELECT CASE
    WHEN public.has_role(_uid, 'super_admin') THEN 'management'
    WHEN EXISTS (SELECT 1 FROM active WHERE price_id = 'catalog_management_yearly') THEN 'management'
    WHEN EXISTS (SELECT 1 FROM active WHERE price_id = 'catalog_collaborate_yearly') THEN 'collaborate'
    WHEN EXISTS (SELECT 1 FROM active WHERE price_id = 'catalog_plus_yearly') THEN 'plus'
    ELSE 'free'
  END
$$;

CREATE OR REPLACE FUNCTION public.has_tier(_uid uuid, _needed text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT array_position(ARRAY['free', 'plus', 'collaborate', 'management'], public.user_tier(_uid))
    >= array_position(ARRAY['free', 'plus', 'collaborate', 'management'], _needed)
$$;

REVOKE ALL ON FUNCTION public.user_tier(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_tier(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_tier(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_tier(uuid, text) TO authenticated, service_role;

-- Split sheets: generating one starts at Catalog Plus.
DROP POLICY IF EXISTS "Split sheets need Catalog Plus" ON public.split_sheets;
CREATE POLICY "Split sheets need Catalog Plus" ON public.split_sheets AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_tier(auth.uid(), 'plus'));

-- Collecting collaborator e-signatures needs the sheet owner to have Catalog and Collaborate.
-- Invited collaborators still sign for free; only the owner's plan matters.
CREATE OR REPLACE FUNCTION public.get_split_invite(_row_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; result jsonb;
BEGIN
  SELECT s.*, c.track_title, c.artist_name, c.isrc, c.user_id AS owner_id INTO r FROM split_sheets s JOIN catalogs c ON c.id = s.catalog_id WHERE s.id = _row_id;
  IF r IS NULL THEN RETURN NULL; END IF;
  IF lower(r.collaborator_email) <> lower(coalesce(auth.jwt()->>'email','')) THEN RAISE EXCEPTION 'This signature request was sent to a different email.'; END IF;
  IF r.signed_at IS NULL AND NOT public.has_tier(r.owner_id, 'collaborate') THEN
    RAISE EXCEPTION 'This split sheet is not open for collaborator signatures right now. Ask the owner to check their plan.';
  END IF;
  SELECT jsonb_build_object(
    'row_id', r.id, 'track_title', r.track_title, 'artist_name', r.artist_name, 'isrc', r.isrc,
    'legal_name', r.legal_name, 'performer_name', r.performer_name, 'role', r.role,
    'publisher_name', r.publisher_name, 'publisher_pro', r.publisher_pro, 'publisher_ipi', r.publisher_ipi, 'publisher_percentage', r.publisher_percentage,
    'notes', r.notes, 'percentage', r.assigned_percentage, 'pro', r.pro_affiliation, 'ipi', r.ipi_number, 'signed_at', r.signed_at,
    'collaborators', (SELECT jsonb_agg(jsonb_build_object('name', x.legal_name, 'performer', x.performer_name, 'role', x.role, 'percentage', x.assigned_percentage, 'signed', x.signed_at IS NOT NULL)) FROM split_sheets x WHERE x.catalog_id = r.catalog_id)
  ) INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.sign_split_invite(_row_id uuid, _signature_name text, _pro text, _ipi text, _hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  SELECT s.*, c.user_id AS owner_id INTO r FROM split_sheets s JOIN catalogs c ON c.id = s.catalog_id WHERE s.id = _row_id;
  IF r IS NULL THEN RAISE EXCEPTION 'Signature request not found.'; END IF;
  IF lower(r.collaborator_email) <> lower(coalesce(auth.jwt()->>'email','')) THEN RAISE EXCEPTION 'This signature request was sent to a different email.'; END IF;
  IF r.signed_at IS NOT NULL THEN RAISE EXCEPTION 'Already signed.'; END IF;
  IF NOT public.has_tier(r.owner_id, 'collaborate') THEN RAISE EXCEPTION 'This split sheet is not open for collaborator signatures right now. Ask the owner to check their plan.'; END IF;
  IF lower(trim(_signature_name)) <> lower(trim(coalesce(r.legal_name,''))) THEN RAISE EXCEPTION 'Type your legal name exactly as listed.'; END IF;
  UPDATE split_sheets SET signature_name = trim(_signature_name), signature_hash = _hash, signed_at = now(),
    pro_affiliation = coalesce(nullif(trim(_pro),''), pro_affiliation), ipi_number = coalesce(nullif(trim(_ipi),''), ipi_number)
  WHERE id = _row_id;
END $$;

-- Contracts: creating, adding parties and sending for signature need Catalog Management.
-- Parties invited to someone else's contract still sign for free.
DROP POLICY IF EXISTS "Contracts need Catalog Management" ON public.contracts;
CREATE POLICY "Contracts need Catalog Management" ON public.contracts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_tier(auth.uid(), 'management'));
DROP POLICY IF EXISTS "Contract parties need Catalog Management" ON public.contract_parties;
CREATE POLICY "Contract parties need Catalog Management" ON public.contract_parties AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_tier(auth.uid(), 'management'));

CREATE OR REPLACE FUNCTION public.send_contract(_contract_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k record; n int; bad int; h text;
BEGIN
  IF NOT public.has_tier(auth.uid(), 'management') THEN RAISE EXCEPTION 'Sending contracts for signature is included with Catalog Management.'; END IF;
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
