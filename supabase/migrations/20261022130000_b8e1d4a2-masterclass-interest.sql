-- Catalog Management members can ask to be told when Masterclasses open (founder, 2026-10-20), using the same
-- interest list as add-on artist seats. Safe to run more than once.
ALTER TABLE public.feature_interest DROP CONSTRAINT IF EXISTS feature_interest_feature_check;
ALTER TABLE public.feature_interest ADD CONSTRAINT feature_interest_feature_check CHECK (feature IN ('artist_seats', 'masterclasses'));
