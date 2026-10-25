-- Founding 100 (PLAN-founding-upgrades, approved 2026-10-25): the first 100 people who pay for Catalog Plus get
-- Catalog & Collaborate, and the first 100 who pay for Catalog & Collaborate get Catalog Management, for as long as
-- they keep paying without a gap. Sandbox purchases have their own count, so testing never uses a live seat.
-- Seats are written only by a trigger on subscriptions (which only the payment webhook writes), so nobody can
-- grant one to themselves. Additive: no existing data changes.

CREATE TABLE IF NOT EXISTS public.founding_upgrades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  environment text NOT NULL CHECK (environment IN ('live', 'sandbox')),
  paid_tier text NOT NULL CHECK (paid_tier IN ('plus', 'collaborate')),
  granted_tier text NOT NULL CHECK (granted_tier IN ('collaborate', 'management')),
  seat int NOT NULL CHECK (seat BETWEEN 1 AND 100),
  granted_at timestamptz NOT NULL DEFAULT now(),
  -- Set when their paid plan lapses; a seat never comes back after a gap.
  ended_at timestamptz,
  UNIQUE (environment, paid_tier, seat),
  UNIQUE (environment, paid_tier, user_id)
);
ALTER TABLE public.founding_upgrades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own founding seat" ON public.founding_upgrades;
CREATE POLICY "Users read own founding seat" ON public.founding_upgrades FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Staff read founding seats" ON public.founding_upgrades;
CREATE POLICY "Staff read founding seats" ON public.founding_upgrades FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
GRANT SELECT ON public.founding_upgrades TO authenticated;
GRANT ALL ON public.founding_upgrades TO service_role;

-- 1. The tier a user pays for (the old user_tier body, minus super admin and pause), in one environment.
CREATE OR REPLACE FUNCTION public.paid_tier(_uid uuid, _env text DEFAULT NULL)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH env AS (
    SELECT coalesce(_env, (SELECT content->>'environment' FROM site_settings WHERE id = 'payments' AND content->>'environment' IN ('live', 'sandbox'))) AS e
  ), active AS (
    SELECT s.price_id FROM subscriptions s
    WHERE s.user_id = _uid
      AND ((SELECT e FROM env) IS NULL OR s.environment = (SELECT e FROM env))
      AND (
        (s.status IN ('active', 'trialing', 'past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR (s.status = 'canceled' AND s.current_period_end > now())
      )
  )
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM active WHERE price_id = 'catalog_management_yearly') THEN 'management'
    WHEN EXISTS (SELECT 1 FROM active WHERE price_id = 'catalog_collaborate_yearly') THEN 'collaborate'
    WHEN EXISTS (SELECT 1 FROM active WHERE price_id = 'catalog_plus_yearly') THEN 'plus'
    ELSE 'free'
  END
$$;
REVOKE ALL ON FUNCTION public.paid_tier(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.paid_tier(uuid, text) TO service_role;

-- 2. user_tier: a founding seat for the tier they pay for lifts them one tier. Every lock already calls this.
CREATE OR REPLACE FUNCTION public.user_tier(_uid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH env AS (
    SELECT content->>'environment' AS e FROM site_settings WHERE id = 'payments' AND content->>'environment' IN ('live', 'sandbox')
  ), paid AS (
    SELECT public.paid_tier(_uid) AS t
  )
  SELECT CASE
    WHEN public.has_role(_uid, 'super_admin') THEN 'management'
    WHEN public.is_paused(_uid) THEN 'free'
    ELSE coalesce((
      SELECT f.granted_tier FROM founding_upgrades f
      WHERE f.user_id = _uid AND f.ended_at IS NULL AND f.paid_tier = (SELECT t FROM paid)
        AND (NOT EXISTS (SELECT 1 FROM env) OR f.environment = (SELECT e FROM env))
      LIMIT 1
    ), (SELECT t FROM paid))
  END
$$;
REVOKE ALL ON FUNCTION public.user_tier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_tier(uuid) TO authenticated, service_role;

-- 3. On every subscription write: end seats after a gap, then claim a seat for a newly paid tier.
--    Only real Stripe payments count (not collaborator trials or launch gifts, which have no Stripe id).
CREATE OR REPLACE FUNCTION public.founding_seat_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _paid text := public.paid_tier(NEW.user_id, NEW.environment);
  _grant text;
  _next int;
BEGIN
  IF _paid = 'free' THEN
    UPDATE founding_upgrades SET ended_at = now()
    WHERE user_id = NEW.user_id AND environment = NEW.environment AND ended_at IS NULL;
    RETURN NEW;
  END IF;
  IF NEW.stripe_subscription_id IS NULL OR NEW.status <> 'active' OR _paid NOT IN ('plus', 'collaborate') THEN
    RETURN NEW;
  END IF;
  -- Someone who already had a gap never gets a seat again.
  IF EXISTS (SELECT 1 FROM founding_upgrades WHERE user_id = NEW.user_id AND environment = NEW.environment AND ended_at IS NOT NULL) THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM founding_upgrades WHERE user_id = NEW.user_id AND environment = NEW.environment AND paid_tier = _paid) THEN
    RETURN NEW;
  END IF;
  _grant := CASE _paid WHEN 'plus' THEN 'collaborate' ELSE 'management' END;
  -- One payment at a time per tier, so two people paying together can't both be #100.
  PERFORM pg_advisory_xact_lock(hashtext('founding_' || NEW.environment || '_' || _paid));
  SELECT count(*) + 1 INTO _next FROM founding_upgrades WHERE environment = NEW.environment AND paid_tier = _paid;
  IF _next <= 100 THEN
    INSERT INTO founding_upgrades (user_id, environment, paid_tier, granted_tier, seat)
    VALUES (NEW.user_id, NEW.environment, _paid, _grant, _next)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.founding_seat_sync() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS founding_seat_sync ON public.subscriptions;
CREATE TRIGGER founding_seat_sync AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW WHEN (NEW.user_id IS NOT NULL) EXECUTE FUNCTION public.founding_seat_sync();

-- 4. Spots left, for the Plans page (anyone) and Admin → Purchases.
CREATE OR REPLACE FUNCTION public.founding_spots(_env text)
RETURNS TABLE (paid_tier text, taken int, spots_left int) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.tier, count(f.id)::int, greatest(0, 100 - count(f.id))::int
  FROM (VALUES ('plus'), ('collaborate')) AS t(tier)
  LEFT JOIN founding_upgrades f ON f.paid_tier = t.tier AND f.environment = _env
  GROUP BY t.tier
$$;
REVOKE ALL ON FUNCTION public.founding_spots(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.founding_spots(text) TO anon, authenticated, service_role;
