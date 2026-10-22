-- Need more time and Pause (PLAN-catalog-emptying.md §9–12, answered 2026-10-21). Run AFTER 20261022150000 (catalog lapses).
-- Adds one table and a pause rule to the tier check. Nothing existing is deleted. Safe to run again.

-- 1. Every Need more time ("extend") and Pause, so each can be limited to once every 12 months.
--    Written only by the server (payment webhook and retention functions); users read their own.
CREATE TABLE IF NOT EXISTS public.account_pauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('extend', 'pause')),
  months integer CHECK (months BETWEEN 1 AND 3),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  -- Set when a pause is resumed early.
  ended_at timestamptz,
  stripe_subscription_id text,
  purchase_id uuid REFERENCES public.purchases(id) ON DELETE SET NULL,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'live')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_pauses_user ON public.account_pauses (user_id, created_at DESC);
-- One pause per Vault payment, so a webhook retry can't start a second one.
CREATE UNIQUE INDEX IF NOT EXISTS account_pauses_purchase ON public.account_pauses (purchase_id) WHERE purchase_id IS NOT NULL;
GRANT SELECT ON public.account_pauses TO authenticated;
GRANT ALL ON public.account_pauses TO service_role;
ALTER TABLE public.account_pauses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see their own pauses" ON public.account_pauses;
CREATE POLICY "Users see their own pauses" ON public.account_pauses FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2. A paused account uses Free features (catalog read-only) until the pause ends, even though Stripe shows the
--    subscription as trialing. Same as 20261019130000 otherwise.
CREATE OR REPLACE FUNCTION public.is_paused(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM account_pauses p
    WHERE p.user_id = _uid AND p.kind = 'pause' AND p.ended_at IS NULL AND now() >= p.starts_at AND now() < p.ends_at
  )
$$;
REVOKE ALL ON FUNCTION public.is_paused(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_paused(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.user_tier(_uid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH env AS (
    SELECT content->>'environment' AS e FROM site_settings WHERE id = 'payments' AND content->>'environment' IN ('live', 'sandbox')
  ), active AS (
    SELECT s.price_id FROM subscriptions s
    WHERE s.user_id = _uid
      AND (NOT EXISTS (SELECT 1 FROM env) OR s.environment = (SELECT e FROM env))
      AND (
        (s.status IN ('active', 'trialing', 'past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR (s.status = 'canceled' AND s.current_period_end > now())
      )
  )
  SELECT CASE
    WHEN public.has_role(_uid, 'super_admin') THEN 'management'
    WHEN public.is_paused(_uid) THEN 'free'
    WHEN EXISTS (SELECT 1 FROM active WHERE price_id = 'catalog_management_yearly') THEN 'management'
    WHEN EXISTS (SELECT 1 FROM active WHERE price_id = 'catalog_collaborate_yearly') THEN 'collaborate'
    WHEN EXISTS (SELECT 1 FROM active WHERE price_id = 'catalog_plus_yearly') THEN 'plus'
    ELSE 'free'
  END
$$;
REVOKE ALL ON FUNCTION public.user_tier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_tier(uuid) TO authenticated, service_role;

-- 3. The emptying countdown never starts while an account is paused.
CREATE OR REPLACE FUNCTION public.catalog_lapse_candidates()
RETURNS TABLE (user_id uuid, plan_ended_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH env AS (
    SELECT content->>'environment' AS e FROM site_settings WHERE id = 'payments' AND content->>'environment' IN ('live', 'sandbox')
  ), owners AS (
    SELECT DISTINCT c.user_id FROM catalogs c
  )
  SELECT o.user_id, coalesce(max(s.current_period_end), now()) AS plan_ended_at
  FROM owners o
  JOIN subscriptions s ON s.user_id = o.user_id AND (NOT EXISTS (SELECT 1 FROM env) OR s.environment = (SELECT e FROM env))
  WHERE public.user_tier(o.user_id) = 'free'
    AND NOT public.is_staff(o.user_id)
    AND NOT public.is_paused(o.user_id)
  GROUP BY o.user_id
$$;
REVOKE ALL ON FUNCTION public.catalog_lapse_candidates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_lapse_candidates() TO service_role;

-- 4. The lapse job writes its rows; users only read their own (policy in 20261022150000).
GRANT ALL ON public.catalog_lapses TO service_role;
