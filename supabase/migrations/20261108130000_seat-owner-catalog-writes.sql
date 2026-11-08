-- An owner works inside the catalog of each artist on their seats (founder, 2026-11-08): switching profiles in the
-- workspace is a real working switch, so the owner may add songs, upload a master and artwork, edit and remove — the
-- same things the artist can do in their own account, and nothing outside a seat they pay for.
--
-- Nothing existing changes: the artist's own rows policy still applies, and these policies only add a branch for the
-- owner of an active (or cancelled-but-paid) seat. A seat that has ended or lapsed stops working the same moment, since
-- every policy re-reads it. Additive and safe to run again.

-- 1. A song the owner adds belongs to the artist, and the artist's plan rules still apply to it (the existing catalog
--    policies are untouched and combine with OR).
DROP POLICY IF EXISTS "Seat owners add to their artists' catalog" ON public.catalogs;
CREATE POLICY "Seat owners add to their artists' catalog" ON public.catalogs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.artist_seats s
    WHERE s.owner_id = auth.uid() AND s.member_user_id = public.catalogs.user_id
      AND s.status IN ('active', 'canceled')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ));

DROP POLICY IF EXISTS "Seat owners remove from their artists' catalog" ON public.catalogs;
CREATE POLICY "Seat owners remove from their artists' catalog" ON public.catalogs FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.artist_seats s
    WHERE s.owner_id = auth.uid() AND s.member_user_id = public.catalogs.user_id
      AND s.status IN ('active', 'canceled')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ));

-- 2. The files: the bucket is folded by the artist's user id, so the owner is allowed under that one folder and no
--    other. The restrictive "Catalog files need Catalog Plus" policy still applies on upload, and the owner holds a
--    paid plan to have bought a seat in the first place.
DROP POLICY IF EXISTS "Seat owners read their artists' files" ON storage.objects;
CREATE POLICY "Seat owners read their artists' files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'catalog-files' AND EXISTS (
    SELECT 1 FROM public.artist_seats s
    WHERE s.owner_id = auth.uid() AND s.member_user_id::text = (storage.foldername(name))[1]
      AND s.status IN ('active', 'canceled')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ));

DROP POLICY IF EXISTS "Seat owners upload their artists' files" ON storage.objects;
CREATE POLICY "Seat owners upload their artists' files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'catalog-files' AND EXISTS (
    SELECT 1 FROM public.artist_seats s
    WHERE s.owner_id = auth.uid() AND s.member_user_id::text = (storage.foldername(name))[1]
      AND s.status IN ('active', 'canceled')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ));

DROP POLICY IF EXISTS "Seat owners replace their artists' files" ON storage.objects;
CREATE POLICY "Seat owners replace their artists' files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'catalog-files' AND EXISTS (
    SELECT 1 FROM public.artist_seats s
    WHERE s.owner_id = auth.uid() AND s.member_user_id::text = (storage.foldername(name))[1]
      AND s.status IN ('active', 'canceled')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ));

DROP POLICY IF EXISTS "Seat owners delete their artists' files" ON storage.objects;
CREATE POLICY "Seat owners delete their artists' files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'catalog-files' AND EXISTS (
    SELECT 1 FROM public.artist_seats s
    WHERE s.owner_id = auth.uid() AND s.member_user_id::text = (storage.foldername(name))[1]
      AND s.status IN ('active', 'canceled')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ));
