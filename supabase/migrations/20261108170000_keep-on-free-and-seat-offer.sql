-- Keeping a catalog on Free, and an owner offering a seat's plan (founder, 2026-11-08).
--
-- 1. Before the emptying date, a member whose plan ended may choose the Free plan instead: the catalog stays read-only
--    and is never emptied, and a paid plan can be started whenever they are ready. `kept_free_at` is that choice; a
--    later paid tier clears the whole lapse row, so the next plan end starts fresh.
-- 2. An owner may offer a seat's plan to its artist ("this is yours if you want it"). It is only an offer: nothing in
--    billing moves until the artist completes the same seat handoff checkout, and the offer dies with the seat.
-- Additive and safe to run again: no row is deleted and no column is dropped.

ALTER TABLE public.catalog_lapses ADD COLUMN IF NOT EXISTS kept_free_at timestamptz;
ALTER TABLE public.artist_seats ADD COLUMN IF NOT EXISTS handoff_offered_at timestamptz;
