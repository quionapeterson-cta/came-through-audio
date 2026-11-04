-- Add-on artist seats (founder, 2026-11-04): the owner buys a seat on their own yearly subscription, then sends it to
-- the artist's email. The artist signs up (or signs in) with that email and accepts, exactly like an invited split-sheet
-- signature. The seat then grants them its tier and the owner can see and manage their catalog.
--
-- Additive and safe to run again: no existing row is changed, and no column is dropped.

CREATE TABLE IF NOT EXISTS public.artist_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The seat's tier, which is the tier the invited artist works at.
  tier text NOT NULL CHECK (tier IN ('plus', 'collaborate', 'management')),
  -- What the owner calls this artist, and the inbox the seat was sent to.
  artist_name text NOT NULL DEFAULT '',
  invite_email text,
  -- Set when the artist accepts; from then on this row is their seat.
  member_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- unclaimed: paid, no artist named yet. invited: emailed, waiting. active: accepted. canceled/ended: no longer paid.
  status text NOT NULL DEFAULT 'unclaimed' CHECK (status IN ('unclaimed', 'invited', 'active', 'canceled', 'ended')),
  stripe_subscription_id text,
  current_period_end timestamptz,
  environment text NOT NULL CHECK (environment IN ('live', 'sandbox')),
  invited_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS artist_seats_subscription_key ON public.artist_seats (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS artist_seats_owner_key ON public.artist_seats (owner_id);
CREATE INDEX IF NOT EXISTS artist_seats_member_key ON public.artist_seats (member_user_id);

ALTER TABLE public.artist_seats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage their seats" ON public.artist_seats;
CREATE POLICY "Owners manage their seats" ON public.artist_seats FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "Artists read their own seat" ON public.artist_seats;
CREATE POLICY "Artists read their own seat" ON public.artist_seats FOR SELECT TO authenticated
  USING (member_user_id = auth.uid());
DROP POLICY IF EXISTS "Staff read seats" ON public.artist_seats;
CREATE POLICY "Staff read seats" ON public.artist_seats FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_seats TO authenticated;
GRANT ALL ON public.artist_seats TO service_role;

-- 1. The invite behind /seat/<id>: what an invited artist sees before signing in. The email is the invitee's own, so
--    showing it back is what tells them which address to sign up with.
CREATE OR REPLACE FUNCTION public.get_artist_seat_invite(_seat_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.artist_seats;
  _inviter text;
BEGIN
  SELECT * INTO s FROM public.artist_seats WHERE id = _seat_id;
  IF NOT FOUND OR s.invite_email IS NULL THEN RETURN NULL; END IF;
  IF s.status NOT IN ('invited', 'active', 'canceled') THEN RETURN NULL; END IF;
  SELECT coalesce(p.stage_name, p.legal_name) INTO _inviter FROM public.profiles p WHERE p.id = s.owner_id;
  RETURN jsonb_build_object(
    'artist_name', s.artist_name,
    'tier', s.tier,
    'inviter', _inviter,
    'email', s.invite_email,
    'claimed', s.member_user_id IS NOT NULL,
    'ends_on', s.current_period_end
  );
END $$;
REVOKE ALL ON FUNCTION public.get_artist_seat_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_artist_seat_invite(uuid) TO anon, authenticated, service_role;

-- 2. Accepting: only the inbox the seat was sent to can claim it, so a forwarded link can't take someone's seat.
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

-- 3. The owner sees and manages every catalog they pay a seat for. Additive: the existing own-rows policy still applies,
--    and policies combine with OR, so nothing an artist could do changes.
DROP POLICY IF EXISTS "Seat owners read their artists' catalog" ON public.catalogs;
CREATE POLICY "Seat owners read their artists' catalog" ON public.catalogs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.artist_seats s
    WHERE s.owner_id = auth.uid() AND s.member_user_id = public.catalogs.user_id
      AND s.status IN ('active', 'canceled')
  ));
DROP POLICY IF EXISTS "Seat owners update their artists' catalog" ON public.catalogs;
CREATE POLICY "Seat owners update their artists' catalog" ON public.catalogs FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.artist_seats s
    WHERE s.owner_id = auth.uid() AND s.member_user_id = public.catalogs.user_id
      AND s.status IN ('active', 'canceled')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.artist_seats s
    WHERE s.owner_id = auth.uid() AND s.member_user_id = public.catalogs.user_id
      AND s.status IN ('active', 'canceled')
  ));

-- 4. user_tier: a seat lifts the invited artist to its tier, never higher than the best of their own plan and the seat.
--    Same body as before, with the seat added; super admins and paused accounts are unchanged.
CREATE OR REPLACE FUNCTION public.user_tier(_uid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH env AS (
    SELECT content->>'environment' AS e FROM site_settings WHERE id = 'payments' AND content->>'environment' IN ('live', 'sandbox')
  ), tiers AS (
    SELECT array_position(ARRAY['free', 'plus', 'collaborate', 'management'], coalesce((
      SELECT f.granted_tier FROM founding_upgrades f
      WHERE f.user_id = _uid AND f.ended_at IS NULL AND f.paid_tier = public.paid_tier(_uid)
        AND (NOT EXISTS (SELECT 1 FROM env) OR f.environment = (SELECT e FROM env))
      LIMIT 1
    ), public.paid_tier(_uid), 'free')) AS paid_rank,
    array_position(ARRAY['free', 'plus', 'collaborate', 'management'], coalesce((
      SELECT s.tier FROM artist_seats s
      WHERE s.member_user_id = _uid AND s.status IN ('active', 'canceled')
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
        AND (NOT EXISTS (SELECT 1 FROM env) OR s.environment = (SELECT e FROM env))
      ORDER BY array_position(ARRAY['plus', 'collaborate', 'management'], s.tier) DESC
      LIMIT 1
    ), 'free')) AS seat_rank
  )
  SELECT CASE
    WHEN public.has_role(_uid, 'super_admin') THEN 'management'
    WHEN public.is_paused(_uid) THEN 'free'
    ELSE (ARRAY['free', 'plus', 'collaborate', 'management'])[greatest((SELECT paid_rank FROM tiers), (SELECT seat_rank FROM tiers))]
  END
$$;
REVOKE ALL ON FUNCTION public.user_tier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_tier(uuid) TO authenticated, service_role;
