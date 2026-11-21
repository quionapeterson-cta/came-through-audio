-- A paused account stays on Free, seats included (founder, 2026-11-21, superseding the seat exception in
-- 20261121150000_pause-open-ended.sql).
--
-- The pause stops the plan; a seat someone else pays for does not keep a paid tier running through it. Everything the
-- account can still do is Free, and the workspace stays readable and downloadable: catalog rows and files are read by
-- the owner (the catalog bucket's own policies, unchanged), so masters, artwork, PDFs and release ZIPs still come down
-- while embedding, uploads, new or edited songs, split sheets, contracts, exports, branding and AI packages wait until
-- the member resumes.
--
-- Staff access is unchanged: a staff role or a live staff plan still returns its tier, because that is not the paused
-- member's own plan. Additive and safe to run more than once.

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
    -- Paused is Free, seats included (founder, 2026-11-21). Downloads stay available; paid tools wait for Resume.
    WHEN public.is_paused(_uid) THEN 'free'
    ELSE (ARRAY['free', 'plus', 'collaborate', 'management'])[greatest((SELECT paid_rank FROM tiers), (SELECT seat_rank FROM tiers))]
  END
$$;
REVOKE ALL ON FUNCTION public.user_tier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_tier(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.user_tier(uuid) IS
  'The tier an account works at. Paused accounts are Free with no exception, seats included (founder, 2026-11-21); staff roles and staff plans still count.';
