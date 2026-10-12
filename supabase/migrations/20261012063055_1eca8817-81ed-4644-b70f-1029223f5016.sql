CREATE POLICY "Users read own catalog files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'catalog-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users upload own catalog files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'catalog-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own catalog files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'catalog-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own catalog files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'catalog-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Collaborator signing: invited collaborators read and sign only rows matching their verified email.
CREATE OR REPLACE FUNCTION public.get_split_invite(_row_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; result jsonb;
BEGIN
  SELECT s.*, c.track_title, c.artist_name, c.isrc INTO r FROM split_sheets s JOIN catalogs c ON c.id = s.catalog_id WHERE s.id = _row_id;
  IF r IS NULL THEN RETURN NULL; END IF;
  IF lower(r.collaborator_email) <> lower(coalesce(auth.jwt()->>'email','')) THEN RAISE EXCEPTION 'This signature request was sent to a different email.'; END IF;
  SELECT jsonb_build_object(
    'row_id', r.id, 'track_title', r.track_title, 'artist_name', r.artist_name, 'isrc', r.isrc,
    'legal_name', r.legal_name, 'role', r.role, 'percentage', r.assigned_percentage, 'pro', r.pro_affiliation, 'ipi', r.ipi_number, 'signed_at', r.signed_at,
    'collaborators', (SELECT jsonb_agg(jsonb_build_object('name', x.legal_name, 'role', x.role, 'percentage', x.assigned_percentage, 'signed', x.signed_at IS NOT NULL)) FROM split_sheets x WHERE x.catalog_id = r.catalog_id)
  ) INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.sign_split_invite(_row_id uuid, _signature_name text, _pro text, _ipi text, _hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM split_sheets WHERE id = _row_id;
  IF r IS NULL THEN RAISE EXCEPTION 'Signature request not found.'; END IF;
  IF lower(r.collaborator_email) <> lower(coalesce(auth.jwt()->>'email','')) THEN RAISE EXCEPTION 'This signature request was sent to a different email.'; END IF;
  IF r.signed_at IS NOT NULL THEN RAISE EXCEPTION 'Already signed.'; END IF;
  IF lower(trim(_signature_name)) <> lower(trim(coalesce(r.legal_name,''))) THEN RAISE EXCEPTION 'Type your legal name exactly as listed.'; END IF;
  UPDATE split_sheets SET signature_name = trim(_signature_name), signature_hash = _hash, signed_at = now(),
    pro_affiliation = coalesce(nullif(trim(_pro),''), pro_affiliation), ipi_number = coalesce(nullif(trim(_ipi),''), ipi_number)
  WHERE id = _row_id;
END $$;

REVOKE ALL ON FUNCTION public.get_split_invite(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sign_split_invite(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_split_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sign_split_invite(uuid, text, text, text, text) TO authenticated;