-- Several artist seats on one purchase (founder, 2026-11-04): the owner picks how many artists to add, so one seat
-- subscription carries that many seats. Each artist still gets their own row, invite, acceptance and catalog, so the
-- unique key becomes the subscription plus the seat's place in it.
-- Additive and safe to run again: seats bought before this land on index 0 and keep working.

ALTER TABLE public.artist_seats ADD COLUMN IF NOT EXISTS seat_index integer NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS public.artist_seats_subscription_key;
CREATE UNIQUE INDEX IF NOT EXISTS artist_seats_subscription_seat_key
  ON public.artist_seats (stripe_subscription_id, seat_index)
  WHERE stripe_subscription_id IS NOT NULL;

-- The invite and the artist's own seat are looked up by id and by member, which the existing indexes already cover.
COMMENT ON COLUMN public.artist_seats.seat_index IS
  'Which seat of its subscription this row is: 0-based, one row per artist bought.';
