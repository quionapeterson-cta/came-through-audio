-- Seat handoff and seat expiry (founder, 2026-11-08): an artist on a seat can take the seat's plan over at any time, but
-- nothing is charged until the paid period is ready to renew. At that moment the seat becomes `handed_off` and the
-- owner's access to that artist's catalog ends — the owner already paid for the period, so there is no refund or credit.
--
-- This also closes the expiry hole in the first seat policies: they checked the status only, so a cancelled seat whose
-- paid year had ended still read and edited the artist's catalog. Every seat rule below re-reads the period.
-- Additive and safe to run again: no row is deleted, no column is dropped.

-- 1. The new state, and when it happened (for the owner's record and support).
ALTER TABLE public.artist_seats ADD COLUMN IF NOT EXISTS handed_off_at timestamptz;
ALTER TABLE public.artist_seats DROP CONSTRAINT IF EXISTS artist_seats_status_check;
ALTER TABLE public.artist_seats ADD CONSTRAINT artist_seats_status_check
  CHECK (status IN ('unclaimed', 'invited', 'active', 'canceled', 'ended', 'handed_off'));

-- 2. The owner reads and edits an artist's catalog only while the seat is live: paid, and inside the period already
--    paid for. `handed_off` is not in the list, so the owner's access ends the moment the artist takes the plan over.
DROP POLICY IF EXISTS "Seat owners read their artists' catalog" ON public.catalogs;
CREATE POLICY "Seat owners read their artists' catalog" ON public.catalogs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.artist_seats s
    WHERE s.owner_id = auth.uid() AND s.member_user_id = public.catalogs.user_id
      AND s.status IN ('active', 'canceled')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ));
DROP POLICY IF EXISTS "Seat owners update their artists' catalog" ON public.catalogs;
CREATE POLICY "Seat owners update their artists' catalog" ON public.catalogs FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.artist_seats s
    WHERE s.owner_id = auth.uid() AND s.member_user_id = public.catalogs.user_id
      AND s.status IN ('active', 'canceled')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.artist_seats s
    WHERE s.owner_id = auth.uid() AND s.member_user_id = public.catalogs.user_id
      AND s.status IN ('active', 'canceled')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ));

-- 3. The same for the artist's saved defaults.
DROP POLICY IF EXISTS "Seat owners read their artists' profile" ON public.profiles;
CREATE POLICY "Seat owners read their artists' profile" ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.artist_seats s
    WHERE s.owner_id = auth.uid() AND s.member_user_id = public.profiles.id
      AND s.status IN ('active', 'canceled')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ));

CREATE OR REPLACE FUNCTION public.set_seat_artist_defaults(_member uuid, _artist_defaults jsonb, _onboarding jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.artist_seats s
    WHERE s.owner_id = auth.uid() AND s.member_user_id = _member
      AND s.status IN ('active', 'canceled')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ) THEN
    RAISE EXCEPTION 'You can only edit the saved defaults of an artist on one of your live seats.';
  END IF;
  UPDATE public.profiles
  SET artist_defaults = _artist_defaults, onboarding = _onboarding
  WHERE id = _member;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.set_seat_artist_defaults(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_seat_artist_defaults(uuid, jsonb, jsonb) TO authenticated, service_role;

-- 4. Free plans can read what they already have, but they cannot edit a song or replace its files. Catalog Plus is
--    where editing starts, and a live artist seat lifts the artist to the seat's tier, so nobody loses access they pay
--    for. The owner editing an artist's catalog is covered by the same rule: they hold a plan to have bought the seat.
DROP POLICY IF EXISTS "Editing songs needs Catalog Plus" ON public.catalogs;
CREATE POLICY "Editing songs needs Catalog Plus" ON public.catalogs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_tier(auth.uid(), 'plus'))
  WITH CHECK (public.has_tier(auth.uid(), 'plus'));

DROP POLICY IF EXISTS "Replacing catalog files needs Catalog Plus" ON storage.objects;
CREATE POLICY "Replacing catalog files needs Catalog Plus" ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (bucket_id <> 'catalog-files' OR public.has_tier(auth.uid(), 'plus'))
  WITH CHECK (bucket_id <> 'catalog-files' OR public.has_tier(auth.uid(), 'plus'));

DROP POLICY IF EXISTS "Deleting songs needs Catalog Plus" ON public.catalogs;
CREATE POLICY "Deleting songs needs Catalog Plus" ON public.catalogs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_tier(auth.uid(), 'plus'));

DROP POLICY IF EXISTS "Deleting catalog files needs Catalog Plus" ON storage.objects;
CREATE POLICY "Deleting catalog files needs Catalog Plus" ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
  USING (bucket_id <> 'catalog-files' OR public.has_tier(auth.uid(), 'plus'));

-- 5. A handed-off seat is closed: accepting its old invite again must not turn the seat back on and reopen the owner's
--    access to the artist's catalog. The artist keeps their own plan; only the seat row is refused.
CREATE OR REPLACE FUNCTION public.accept_artist_seat(_seat_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.artist_seats;
  _email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first, then open the invite again.'; END IF;
  SELECT * INTO s FROM public.artist_seats WHERE id = _seat_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This seat invite was not found.'; END IF;
  IF s.member_user_id IS NOT NULL AND s.member_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'This seat has already been claimed by another account.';
  END IF;
  IF s.status = 'ended' THEN RAISE EXCEPTION 'This seat is no longer active.'; END IF;
  IF s.status = 'handed_off' THEN RAISE EXCEPTION 'This seat has been handed over to your own plan.'; END IF;
  SELECT lower(u.email) INTO _email FROM auth.users u WHERE u.id = auth.uid();
  IF s.invite_email IS NULL OR lower(s.invite_email) <> _email THEN
    RAISE EXCEPTION 'Sign in with the email this seat was sent to (%), or ask the catalog owner to resend it.', coalesce(s.invite_email, '');
  END IF;
  UPDATE public.artist_seats
  SET member_user_id = auth.uid(), status = 'active', accepted_at = now(), updated_at = now()
  WHERE id = s.id;
  RETURN jsonb_build_object('tier', s.tier, 'artist_name', s.artist_name);
END $$;
REVOKE ALL ON FUNCTION public.accept_artist_seat(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_artist_seat(uuid) TO authenticated, service_role;
