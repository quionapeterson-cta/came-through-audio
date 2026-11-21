-- A pause lasts as long as the member needs (founder, 2026-11-21), replacing the 1–3 month pause of 2026-10-21/2026-11-20.
--
-- What changes:
--   • `account_pauses.ends_at` may be null: null means the pause runs until the member resumes. Pauses sold with a date
--     before this migration keep their date and still end on it.
--   • `is_paused()` stops comparing against the end date, so an open-ended pause is one with no end until it is ended.
--   • `user_tier()` keeps an artist seat working while the member's own plan is paused: a seat is a separate subscription
--     someone else pays for, and the founder chose to leave it on. Everything the paused plan itself granted (embedding,
--     uploads, new catalog entries, split sheets, contracts, exports, branding, AI packages) drops to Free, because the
--     paused plan's tier is not counted any more.
--
-- Additive and safe to run more than once. Every existing pause keeps exactly the behaviour it was sold with.

ALTER TABLE public.account_pauses ALTER COLUMN ends_at DROP NOT NULL;

COMMENT ON COLUMN public.account_pauses.ends_at IS
  'Null while the pause is open-ended: it runs until the member resumes (founder, 2026-11-21). A pause sold with a length before then keeps its end date.';
COMMENT ON COLUMN public.account_pauses.months IS
  'Null on an open-ended pause. The 1-3 month length is only recorded on pauses sold before 2026-11-21.';
COMMENT ON COLUMN public.account_pauses.vault_subscription_id IS
  'The recurring monthly $1.99 Vault subscription behind this pause. Cancelled on Resume, or when its card cannot be charged.';

-- 1. A live pause is one that has started and has not been ended. A dated (legacy) pause still ends on its date.
CREATE OR REPLACE FUNCTION public.is_paused(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM account_pauses p
    WHERE p.user_id = _uid AND p.kind = 'pause' AND p.ended_at IS NULL
      AND now() >= p.starts_at AND (p.ends_at IS NULL OR now() < p.ends_at)
  )
$$;
REVOKE ALL ON FUNCTION public.is_paused(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_paused(uuid) TO authenticated, service_role;

-- 2. While paused, the plan's own tier is not counted; a live seat still is.
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
    WHEN public.is_staff(_uid) THEN 'management'
    WHEN public.staff_plan_active(_uid) THEN 'management'
    -- Paused: the plan's own tier waits, a seat someone else pays for keeps working (founder, 2026-11-21).
    WHEN public.is_paused(_uid) THEN (ARRAY['free', 'plus', 'collaborate', 'management'])[greatest(1, (SELECT seat_rank FROM tiers))]
    ELSE (ARRAY['free', 'plus', 'collaborate', 'management'])[greatest((SELECT paid_rank FROM tiers), (SELECT seat_rank FROM tiers))]
  END
$$;
REVOKE ALL ON FUNCTION public.user_tier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_tier(uuid) TO authenticated, service_role;
