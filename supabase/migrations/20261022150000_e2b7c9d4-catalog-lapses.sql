-- Catalog emptying after a plan ends (PLAN-catalog-emptying.md, approved 2026-10-21).
-- 30 days after someone's last plan ends, their catalog songs, masters and artwork are emptied. Signed split sheets,
-- signed contracts, AI Protection certificates and agency registration records are kept. Nothing is deleted by this
-- migration itself; it only adds a table, snapshot columns and safer delete rules. Safe to run again.

-- 1. One row per account in its 30-day grace period (or already emptied).
CREATE TABLE IF NOT EXISTS public.catalog_lapses (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_ended_at timestamptz NOT NULL,
  empty_after timestamptz NOT NULL,
  reminders text[] NOT NULL DEFAULT '{}',
  emptied_at timestamptz,
  songs_emptied integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.catalog_lapses TO authenticated;
GRANT ALL ON public.catalog_lapses TO service_role;
ALTER TABLE public.catalog_lapses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see their own catalog lapse" ON public.catalog_lapses;
CREATE POLICY "Users see their own catalog lapse" ON public.catalog_lapses FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2. Split sheets outlive their song: keep the song's title, artist, ISRC and owner on the sheet when the song goes,
--    and keep the old song ID so a sheet's rows still belong together.
ALTER TABLE public.split_sheets ADD COLUMN IF NOT EXISTS track_title text;
ALTER TABLE public.split_sheets ADD COLUMN IF NOT EXISTS artist_name text;
ALTER TABLE public.split_sheets ADD COLUMN IF NOT EXISTS isrc text;
ALTER TABLE public.split_sheets ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.split_sheets DROP CONSTRAINT IF EXISTS split_sheets_catalog_id_fkey;

CREATE OR REPLACE FUNCTION public.snapshot_song_before_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE split_sheets SET track_title = OLD.track_title, artist_name = OLD.artist_name, isrc = OLD.isrc, owner_id = OLD.user_id
  WHERE catalog_id = OLD.id;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.snapshot_song_before_delete() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS snapshot_song_before_delete ON public.catalogs;
CREATE TRIGGER snapshot_song_before_delete BEFORE DELETE ON public.catalogs FOR EACH ROW EXECUTE FUNCTION public.snapshot_song_before_delete();

-- The owner can still read split sheets whose song is gone.
DROP POLICY IF EXISTS "Owners read split sheets of removed songs" ON public.split_sheets;
CREATE POLICY "Owners read split sheets of removed songs" ON public.split_sheets FOR SELECT TO authenticated USING (owner_id = auth.uid());

-- 3. Records that must survive a song's removal point at nothing instead of blocking or vanishing.
ALTER TABLE public.ai_protection_certificates DROP CONSTRAINT IF EXISTS ai_protection_certificates_catalog_id_fkey;
ALTER TABLE public.ai_protection_certificates ADD CONSTRAINT ai_protection_certificates_catalog_id_fkey
  FOREIGN KEY (catalog_id) REFERENCES public.catalogs(id) ON DELETE SET NULL;
ALTER TABLE public.agency_registrations DROP CONSTRAINT IF EXISTS agency_registrations_catalog_id_fkey;
ALTER TABLE public.agency_registrations ADD CONSTRAINT agency_registrations_catalog_id_fkey
  FOREIGN KEY (catalog_id) REFERENCES public.catalogs(id) ON DELETE SET NULL;
-- A song's own health results go with it.
ALTER TABLE public.royalty_health_checks DROP CONSTRAINT IF EXISTS royalty_health_checks_catalog_id_fkey;
ALTER TABLE public.royalty_health_checks ADD CONSTRAINT royalty_health_checks_catalog_id_fkey
  FOREIGN KEY (catalog_id) REFERENCES public.catalogs(id) ON DELETE CASCADE;

-- 4. Signed split sheets stay readable to everyone who signed, even after the song is gone.
CREATE OR REPLACE FUNCTION public.get_split_invite(_row_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; result jsonb;
BEGIN
  SELECT s.*, coalesce(c.track_title, s.track_title) AS song_title, coalesce(c.artist_name, s.artist_name) AS song_artist,
    coalesce(c.isrc, s.isrc) AS song_isrc, coalesce(c.user_id, s.owner_id) AS song_owner
  INTO r FROM split_sheets s LEFT JOIN catalogs c ON c.id = s.catalog_id WHERE s.id = _row_id;
  IF r IS NULL OR r.song_owner IS NULL THEN RETURN NULL; END IF;
  IF lower(r.collaborator_email) <> lower(coalesce(auth.jwt()->>'email','')) THEN RAISE EXCEPTION 'This signature request was sent to a different email.'; END IF;
  IF r.signed_at IS NULL AND NOT public.has_tier(r.song_owner, 'collaborate') THEN
    RAISE EXCEPTION 'This split sheet is not open for collaborator signatures right now. Ask the owner to check their plan.';
  END IF;
  SELECT jsonb_build_object(
    'row_id', r.id, 'track_title', r.song_title, 'artist_name', r.song_artist, 'isrc', r.song_isrc,
    'legal_name', r.legal_name, 'performer_name', r.performer_name, 'role', r.role,
    'publisher_name', r.publisher_name, 'publisher_pro', r.publisher_pro, 'publisher_ipi', r.publisher_ipi, 'publisher_percentage', r.publisher_percentage,
    'notes', r.notes, 'percentage', r.assigned_percentage, 'pro', r.pro_affiliation, 'ipi', r.ipi_number, 'signed_at', r.signed_at,
    'collaborators', (SELECT jsonb_agg(jsonb_build_object('name', x.legal_name, 'performer', x.performer_name, 'role', x.role, 'percentage', x.assigned_percentage, 'signed', x.signed_at IS NOT NULL)) FROM split_sheets x WHERE x.catalog_id = r.catalog_id)
  ) INTO result;
  RETURN result;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_split_invite(uuid) FROM PUBLIC, anon;

-- Signing still needs the song to exist (and its owner on Catalog & Collaborate).
CREATE OR REPLACE FUNCTION public.sign_split_invite(_row_id uuid, _signature_name text, _pro text, _ipi text, _hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  SELECT s.*, c.user_id AS owner_id INTO r FROM split_sheets s JOIN catalogs c ON c.id = s.catalog_id WHERE s.id = _row_id;
  IF r IS NULL THEN RAISE EXCEPTION 'This split sheet is no longer open for signatures.'; END IF;
  IF lower(r.collaborator_email) <> lower(coalesce(auth.jwt()->>'email','')) THEN RAISE EXCEPTION 'This signature request was sent to a different email.'; END IF;
  IF r.signed_at IS NOT NULL THEN RAISE EXCEPTION 'Already signed.'; END IF;
  IF NOT public.has_tier(r.owner_id, 'collaborate') THEN RAISE EXCEPTION 'This split sheet is not open for collaborator signatures right now. Ask the owner to check their plan.'; END IF;
  IF lower(trim(_signature_name)) <> lower(trim(coalesce(r.legal_name,''))) THEN RAISE EXCEPTION 'Type your legal name exactly as listed.'; END IF;
  UPDATE split_sheets SET signature_name = trim(_signature_name), signature_hash = _hash, signed_at = now(),
    pro_affiliation = coalesce(nullif(trim(_pro),''), pro_affiliation), ipi_number = coalesce(nullif(trim(_ipi),''), ipi_number)
  WHERE id = _row_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.sign_split_invite(uuid, text, text, text, text) FROM PUBLIC, anon;

-- 5. Accounts that have songs, had a plan, and have no plan now (same rules and payment environment as user_tier).
--    Staff are never included. Server job only.
CREATE OR REPLACE FUNCTION public.catalog_lapse_candidates()
RETURNS TABLE (user_id uuid, plan_ended_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH env AS (
    SELECT content->>'environment' AS e FROM site_settings WHERE id = 'payments' AND content->>'environment' IN ('live', 'sandbox')
  ), owners AS (
    SELECT DISTINCT c.user_id FROM catalogs c
  )
  SELECT o.user_id, coalesce(max(s.current_period_end), now()) AS plan_ended_at
  FROM owners o
  JOIN subscriptions s ON s.user_id = o.user_id AND (NOT EXISTS (SELECT 1 FROM env) OR s.environment = (SELECT e FROM env))
  WHERE public.user_tier(o.user_id) = 'free'
    AND NOT public.is_staff(o.user_id)
  GROUP BY o.user_id
$$;
REVOKE ALL ON FUNCTION public.catalog_lapse_candidates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_lapse_candidates() TO service_role;
