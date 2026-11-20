-- An owner's seat row is read-only apart from the invite (founder, 2026-11-20, extending the Lovable policy change of the
-- same day). The old FOR ALL policy had let an owner insert a seat of their own; 20261120140000 replaced it with read
-- plus invite-only update. That still left every column of an existing row writable, so an owner holding one real seat
-- could point it at their own account and pick a tier, and public.user_tier would lift them to it without a plan being
-- paid for. The guard below freezes the paid columns and the ownership itself; only the invite stays writable.
--
-- Service role (the payments webhook) and SECURITY DEFINER functions (accept_artist_seat, seat handoff) run as other
-- roles, so current_user is not 'authenticated' and neither of those paths is affected.
--
-- The invite path (inviteSeatArtist, offerSeatHandoff) runs as the member's own JWT, so it needs UPDATE on exactly the
-- invite columns; it was failing with "permission denied" before this file, which the invite itself logged and
-- swallowed. Those columns are granted below, one by one.

CREATE OR REPLACE FUNCTION public.artist_seats_owner_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    -- The seat becomes active only when the invited artist accepts it, never from a browser update.
    IF NEW.status IS DISTINCT FROM OLD.status
       AND (NEW.status <> 'invited' OR OLD.member_user_id IS NOT NULL OR OLD.status IN ('active','canceled','ended','handed_off')) THEN
      RAISE EXCEPTION 'A seat becomes active only when the invited artist accepts it.';
    END IF;
    -- What was paid for, who holds it and how long it runs are not the owner's to edit.
    IF NEW.tier IS DISTINCT FROM OLD.tier
       OR NEW.member_user_id IS DISTINCT FROM OLD.member_user_id
       OR NEW.current_period_end IS DISTINCT FROM OLD.current_period_end
       OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
       OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
       OR NEW.environment IS DISTINCT FROM OLD.environment
       OR NEW.seat_index IS DISTINCT FROM OLD.seat_index
       OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at THEN
      RAISE EXCEPTION 'A seat''s plan, owner, period and subscription are set by the payment, not from your account.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Second lock: the row is written by the payments webhook, so a signed-in client never needs to add or remove one.
REVOKE INSERT, DELETE ON public.artist_seats FROM authenticated;

-- And the invite is the only thing it may write, said by the privilege itself: UPDATE is granted per column, so tier,
-- owner, period, subscription and seat_index cannot be written even if a later policy allowed an update. Without this
-- grant the invite (and the handoff offer) failed with "permission denied", because authenticated held SELECT alone.
GRANT UPDATE (artist_name, invite_email, invited_at, status, updated_at, handoff_offered_at)
  ON public.artist_seats TO authenticated;
