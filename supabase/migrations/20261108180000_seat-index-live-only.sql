-- A handed-off or ended seat is the owner's record, not a paid place on their subscription. The webhook renumbers the
-- live seats from 0, so the unique key has to skip those rows or the owner's next subscription update collides with one
-- (founder, 2026-11-08). Additive and safe to run again: no row is deleted, no column changes.

DROP INDEX IF EXISTS public.artist_seats_subscription_seat_key;
CREATE UNIQUE INDEX artist_seats_subscription_seat_key
  ON public.artist_seats (stripe_subscription_id, seat_index)
  WHERE stripe_subscription_id IS NOT NULL AND status IN ('unclaimed', 'invited', 'active', 'canceled');
