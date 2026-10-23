-- Co-writer PRO / IPI requests (PLAN-cowriter-ipi-request.md). Adds a table and functions; changes no existing data.
--
-- The owner asks a co-writer for their PRO and IPI. The co-writer signs in with a free account using the invited email
-- and answers once; the owner then approves, which fills only blank fields in their catalog (done in the app).
-- 1. ipi_requests: owner-only rows. The invitee never reads the table; they use the two functions below.
-- 2. get_ipi_request / answer_ipi_request: check the signed-in email matches the invited email, like get_split_invite.
-- 3. invite_sends.ipi_request_id so the shared invite limits count these emails too.
-- 4. trial_grants accepts source 'ipi_request' (the free 30-day Catalog & Collaborate trial, same fraud guard).
CREATE TABLE IF NOT EXISTS public.ipi_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  writer_name text NOT NULL CHECK (char_length(writer_name) BETWEEN 1 AND 120),
  role text NOT NULL DEFAULT '' CHECK (char_length(role) <= 40),
  email text NOT NULL CHECK (email = lower(email) AND char_length(email) <= 320),
  -- [{ "catalog_id": "…", "title": "…" }], the songs this writer is missing PRO/IPI on.
  songs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(songs) = 'array' AND jsonb_array_length(songs) BETWEEN 1 AND 200),
  artist_name text NOT NULL DEFAULT '' CHECK (char_length(artist_name) <= 120),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'applied', 'dismissed')),
  -- { "legal_name": "…", "pro": "…", "ipi": "…", "no_pro": false }
  answer jsonb,
  answered_at timestamptz,
  sent_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ipi_requests_owner ON public.ipi_requests (owner_id, created_at DESC);
GRANT SELECT, DELETE ON public.ipi_requests TO authenticated;
GRANT INSERT (writer_name, role, email, songs, artist_name) ON public.ipi_requests TO authenticated;
GRANT UPDATE (status) ON public.ipi_requests TO authenticated;
GRANT ALL ON public.ipi_requests TO service_role;
ALTER TABLE public.ipi_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage own IPI requests" ON public.ipi_requests;
CREATE POLICY "Owners manage own IPI requests" ON public.ipi_requests FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Owners may only apply or dismiss an answer, or cancel a pending request; answers come in through answer_ipi_request,
-- and the server (service role) records when the email went out.
CREATE OR REPLACE FUNCTION public.ipi_requests_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.has_tier(NEW.owner_id, 'collaborate') THEN RAISE EXCEPTION 'Co-writer requests are included with Catalog & Collaborate.'; END IF;
    IF (SELECT count(*) FROM public.ipi_requests WHERE owner_id = NEW.owner_id AND created_at > now() - interval '1 day') >= 50 THEN
      RAISE EXCEPTION 'You''ve made a lot of requests today. Try again tomorrow.';
    END IF;
    NEW.status := 'pending'; NEW.answer := NULL; NEW.answered_at := NULL; NEW.sent_at := NULL;
    NEW.expires_at := now() + interval '30 days';
  ELSIF TG_OP = 'UPDATE' AND current_setting('cta.ipi_answer', true) IS DISTINCT FROM 'on' AND coalesce(auth.role(), '') <> 'service_role' THEN
    IF NOT ((OLD.status = 'answered' AND NEW.status IN ('applied', 'dismissed')) OR (OLD.status = 'pending' AND NEW.status = 'dismissed')) THEN
      RAISE EXCEPTION 'This request can''t be changed that way.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ipi_requests_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS ipi_requests_guard ON public.ipi_requests;
CREATE TRIGGER ipi_requests_guard BEFORE INSERT OR UPDATE ON public.ipi_requests
  FOR EACH ROW EXECUTE FUNCTION public.ipi_requests_guard();

CREATE OR REPLACE FUNCTION public.get_ipi_request(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.ipi_requests;
BEGIN
  SELECT * INTO r FROM public.ipi_requests WHERE id = _id;
  IF r.id IS NULL OR r.status = 'dismissed' THEN RETURN NULL; END IF;
  IF r.email <> lower(coalesce(auth.jwt()->>'email', '')) THEN RAISE EXCEPTION 'This request was sent to a different email.'; END IF;
  RETURN jsonb_build_object('id', r.id, 'writer_name', r.writer_name, 'role', r.role, 'artist_name', r.artist_name,
    'songs', (SELECT jsonb_agg(s->'title') FROM jsonb_array_elements(r.songs) s), 'answered', r.status <> 'pending',
    'expired', r.status = 'pending' AND r.expires_at < now(), 'answer', r.answer);
END $$;

CREATE OR REPLACE FUNCTION public.answer_ipi_request(_id uuid, _legal_name text, _pro text, _ipi text, _no_pro boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.ipi_requests; ipi text := regexp_replace(coalesce(_ipi, ''), '\D', '', 'g');
BEGIN
  SELECT * INTO r FROM public.ipi_requests WHERE id = _id FOR UPDATE;
  IF r.id IS NULL OR r.status = 'dismissed' THEN RAISE EXCEPTION 'This request no longer exists.'; END IF;
  IF r.email <> lower(coalesce(auth.jwt()->>'email', '')) THEN RAISE EXCEPTION 'This request was sent to a different email.'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'You already sent your details. Thank you!'; END IF;
  IF r.expires_at < now() THEN RAISE EXCEPTION 'This request has expired. Ask for a new link.'; END IF;
  IF char_length(trim(coalesce(_legal_name, ''))) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Add your legal name.'; END IF;
  IF NOT coalesce(_no_pro, false) THEN
    IF char_length(trim(coalesce(_pro, ''))) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Choose your PRO, or tick "I''m not in a PRO yet".'; END IF;
    IF ipi !~ '^\d{9,11}$' THEN RAISE EXCEPTION 'IPI numbers are 9 to 11 digits.'; END IF;
  END IF;
  PERFORM set_config('cta.ipi_answer', 'on', true);
  UPDATE public.ipi_requests SET status = 'answered', answered_at = now(),
    answer = jsonb_build_object('legal_name', trim(_legal_name), 'pro', CASE WHEN _no_pro THEN '' ELSE trim(_pro) END,
      'ipi', CASE WHEN _no_pro THEN '' ELSE ipi END, 'no_pro', coalesce(_no_pro, false))
  WHERE id = _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_ipi_request(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.answer_ipi_request(uuid, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ipi_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.answer_ipi_request(uuid, text, text, text, boolean) TO authenticated;

ALTER TABLE public.invite_sends ADD COLUMN IF NOT EXISTS ipi_request_id uuid;
CREATE INDEX IF NOT EXISTS invite_sends_ipi ON public.invite_sends (ipi_request_id, sent_at);

ALTER TABLE public.trial_grants DROP CONSTRAINT IF EXISTS trial_grants_source_check;
ALTER TABLE public.trial_grants ADD CONSTRAINT trial_grants_source_check CHECK (source IN ('split_sheet', 'contract', 'ipi_request'));
