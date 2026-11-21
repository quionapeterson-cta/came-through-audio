-- A pause belongs to one payments environment, like every other money rule (founder, 2026-11-21).
--
-- `account_pauses` has carried an `environment` since it was created, and `user_tier`, `paid_tier` and `artist_seats`
-- all read the payments environment before counting anything. `is_paused()` did not, so a pause started in sandbox
-- (test mode) read as live on the same account: a paying member would be shown Free and lose every paid tool, and the
-- client, which did filter by environment, disagreed with the database. It now reads the same row.
--
-- Additive, safe to run more than once, and no existing live pause changes behaviour.

CREATE OR REPLACE FUNCTION public.is_paused(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH env AS (
    SELECT content->>'environment' AS e FROM site_settings
    WHERE id = 'payments' AND content->>'environment' IN ('live', 'sandbox')
  )
  SELECT EXISTS (
    SELECT 1 FROM account_pauses p
    WHERE p.user_id = _uid AND p.kind = 'pause' AND p.ended_at IS NULL
      AND now() >= p.starts_at AND (p.ends_at IS NULL OR now() < p.ends_at)
      AND (NOT EXISTS (SELECT 1 FROM env) OR p.environment = (SELECT e FROM env))
  )
$$;
REVOKE ALL ON FUNCTION public.is_paused(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_paused(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.is_paused(uuid) IS
  'True while the account has a live pause in the payments environment. Null ends_at means open-ended (founder, 2026-11-21).';
