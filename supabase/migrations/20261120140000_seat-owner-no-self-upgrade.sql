-- A seat cannot be opened by the account that holds it (founder, 2026-11-20). Applied in Lovable first; this file is the
-- repo's record of it, so a rebuild from migrations keeps the same rule.
--
-- "Owners manage their seats" was FOR ALL, which included INSERT: an owner could write a row of their own with an
-- active status and the highest tier and public.user_tier would lift their account to it, without a cent going to
-- Stripe. Seats are bought through Stripe and written by the payments webhook (service role, which RLS does not
-- restrict), so the signed-in client has no reason to create or delete one. It keeps exactly two rights on its own
-- rows: read them, and update the invite (the artist's name and inbox, and the invited status).
--
-- The status itself is still policed by the artist_seats_owner_guard trigger: a seat only becomes active when the
-- invited artist accepts it through accept_artist_seat, never from a browser update.

DROP POLICY IF EXISTS "Owners manage their seats" ON public.artist_seats;

-- Read: the owner sees every seat they pay for.
DROP POLICY IF EXISTS "Owners read their seats" ON public.artist_seats;
CREATE POLICY "Owners read their seats" ON public.artist_seats FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- Write: only the invite on a row they already own, and only to a row that stays theirs.
DROP POLICY IF EXISTS "Owners update their seat invites" ON public.artist_seats;
CREATE POLICY "Owners update their seat invites" ON public.artist_seats FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- No INSERT and no DELETE policy: with row level security on, nothing a signed-in client sends can add or remove a
-- seat. Accepting an invite runs through accept_artist_seat (SECURITY DEFINER), which is the one path that may move a
-- seat to active.
