-- An owner sets up each artist they pay a seat for (founder, 2026-11-04): the same Embed Defaults and Artist Catalog
-- Profile, edited per artist. Seats already let an owner read and update their artists' catalogs; this adds their saved
-- defaults, and only those two columns, so a name, plan or role can never be changed this way.
-- Additive and safe to run again.

DROP POLICY IF EXISTS "Seat owners read their artists' profile" ON public.profiles;
CREATE POLICY "Seat owners read their artists' profile" ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.artist_seats s
    WHERE s.owner_id = auth.uid() AND s.member_user_id = public.profiles.id
      AND s.status IN ('active', 'canceled')
  ));

-- One write path, column-scoped, with the seat check on the server: the client never picks which row to write blind.
CREATE OR REPLACE FUNCTION public.set_seat_artist_defaults(_member uuid, _artist_defaults jsonb, _onboarding jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.artist_seats s
    WHERE s.owner_id = auth.uid() AND s.member_user_id = _member
      AND s.status IN ('active', 'canceled')
  ) THEN
    RAISE EXCEPTION 'You can only edit the saved defaults of an artist on one of your seats.';
  END IF;
  UPDATE public.profiles
  SET artist_defaults = _artist_defaults, onboarding = _onboarding
  WHERE id = _member;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.set_seat_artist_defaults(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_seat_artist_defaults(uuid, jsonb, jsonb) TO authenticated, service_role;
