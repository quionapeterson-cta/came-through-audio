-- Accounts inactive for two years are deleted, after several emails (founder, 2026-11-08). This replaces catalog
-- emptying: a plan that ends now leaves the catalog read-only on Free and nothing is removed.
--
-- The table is the notice record: last_active_at is the last sign-in (or the account's creation) the schedule was built from,
-- delete_on is the day the deadline lands, and reminders lists the notices already sent. A sign-in after that activity
-- saves the account but not its files. Nothing here deletes anything by itself; the daily job does, once.
CREATE TABLE IF NOT EXISTS public.account_inactivity (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_active_at timestamptz NOT NULL,
  delete_on timestamptz NOT NULL,
  reminders text[] NOT NULL DEFAULT '{}',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_inactivity TO authenticated;
GRANT ALL ON public.account_inactivity TO service_role;
ALTER TABLE public.account_inactivity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see their own inactivity notice" ON public.account_inactivity;
CREATE POLICY "Users see their own inactivity notice" ON public.account_inactivity
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS account_inactivity_delete_on_idx
  ON public.account_inactivity (delete_on) WHERE deleted_at IS NULL;

-- The deletion receipt: the only copy of the address once auth.users is gone, kept just long enough for the day-after
-- email and then dropped. No foreign key, because the account it names no longer exists.
CREATE TABLE IF NOT EXISTS public.account_deletions (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.account_deletions TO service_role;
ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletions FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS account_deletions_deleted_at_idx ON public.account_deletions (deleted_at);

-- Who is dormant enough to schedule. Never a staff account, never anyone with a live plan (they are paying, even if
-- they have not signed in), and never anyone on a live artist seat in either direction (deleting a seat's owner would
-- take an artist's plan with it). The 24 months and the 60-day head start mirror src/lib/inactivity.ts.
CREATE OR REPLACE FUNCTION public.inactivity_candidates()
RETURNS TABLE (user_id uuid, last_active_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH env AS (
    SELECT content->>'environment' AS e FROM site_settings WHERE id = 'payments' AND content->>'environment' IN ('live', 'sandbox')
  ), activity AS (
    SELECT u.id, greatest(coalesce(u.last_sign_in_at, u.created_at), u.created_at) AS last_active_at
    FROM auth.users u
  )
  SELECT a.id, a.last_active_at
  FROM activity a
  WHERE a.last_active_at <= now() - interval '24 months' + interval '60 days'
    AND NOT public.is_staff(a.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = a.id
        AND (NOT EXISTS (SELECT 1 FROM env) OR s.environment = (SELECT e FROM env))
        AND (
          (s.status IN ('active', 'trialing', 'past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
          OR (s.status = 'canceled' AND s.current_period_end > now())
        )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.artist_seats seat
      WHERE (seat.owner_id = a.id OR seat.member_user_id = a.id)
        AND seat.status IN ('unclaimed', 'invited', 'active', 'canceled')
        AND seat.current_period_end > now()
    )
$$;
REVOKE ALL ON FUNCTION public.inactivity_candidates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inactivity_candidates() TO service_role;
