ALTER TABLE public.split_sheets
  ADD COLUMN IF NOT EXISTS performer_name text,
  ADD COLUMN IF NOT EXISTS publisher_name text,
  ADD COLUMN IF NOT EXISTS publisher_pro text,
  ADD COLUMN IF NOT EXISTS publisher_ipi text,
  ADD COLUMN IF NOT EXISTS publisher_percentage numeric;

CREATE OR REPLACE FUNCTION public.get_split_invite(_row_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; result jsonb;
BEGIN
  SELECT s.*, c.track_title, c.artist_name, c.isrc INTO r FROM split_sheets s JOIN catalogs c ON c.id = s.catalog_id WHERE s.id = _row_id;
  IF r IS NULL THEN RETURN NULL; END IF;
  IF lower(r.collaborator_email) <> lower(coalesce(auth.jwt()->>'email','')) THEN RAISE EXCEPTION 'This signature request was sent to a different email.'; END IF;
  SELECT jsonb_build_object(
    'row_id', r.id, 'track_title', r.track_title, 'artist_name', r.artist_name, 'isrc', r.isrc,
    'legal_name', r.legal_name, 'performer_name', r.performer_name, 'role', r.role, 'percentage', r.assigned_percentage, 'pro', r.pro_affiliation, 'ipi', r.ipi_number, 'signed_at', r.signed_at,
    'publisher_name', r.publisher_name, 'publisher_pro', r.publisher_pro, 'publisher_ipi', r.publisher_ipi, 'publisher_percentage', r.publisher_percentage,
    'collaborators', (SELECT jsonb_agg(jsonb_build_object('name', x.legal_name, 'performer', x.performer_name, 'role', x.role, 'percentage', x.assigned_percentage, 'signed', x.signed_at IS NOT NULL)) FROM split_sheets x WHERE x.catalog_id = r.catalog_id)
  ) INTO result;
  RETURN result;
END $$;