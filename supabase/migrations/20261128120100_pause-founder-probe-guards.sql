-- Pause and founder checks stop answering for other people's accounts (founder, 2026-11-28).
--
-- `is_paused(user_id)` and `is_founder(user_id)` take any user id, so anyone signed in could ask whether another
-- account was paused or a founder. The real checks move into `_paused_raw` / `_founder_raw`, which only the owner and
-- service_role may run. The public names stay exactly as they were — every policy keeps calling them — but they now go
-- through `_may_probe` first, which allows the server (no `auth.uid()`), the caller's own id, and super admins.
-- `user_tier` and `catalog_lapse_candidates` call the private helpers directly, since they already run as the owner.
--
-- `get_artist_seat_invite` is re-created unchanged in shape: an invite is readable only while it is invited or active,
-- or a cancelled one whose paid period has not ended yet.
--
-- Re-runnable: every statement replaces what is already there, and the rewrite loop is a no-op the second time.

CREATE OR REPLACE FUNCTION public._paused_raw(_uid uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public._founder_raw(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT EXISTS (SELECT 1 FROM public.founder_access WHERE user_id = _user_id); $function$;

REVOKE EXECUTE ON FUNCTION public._paused_raw(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._founder_raw(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._paused_raw(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._founder_raw(uuid) TO service_role;

DO $$
DECLARE f record; src text;
BEGIN
  FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname IN ('user_tier', 'catalog_lapse_candidates')
  LOOP
    src := pg_get_functiondef(f.oid);
    src := replace(src, 'is_paused(', '_paused_raw(');
    src := replace(src, 'is_founder(', '_founder_raw(');
    EXECUTE src;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.is_paused(_uid uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT public._may_probe(_uid) AND public._paused_raw(_uid) $function$;

CREATE OR REPLACE FUNCTION public.is_founder(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT public._may_probe(_user_id) AND public._founder_raw(_user_id) $function$;

CREATE OR REPLACE FUNCTION public.get_artist_seat_invite(_seat_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  s public.artist_seats;
  _inviter text;
BEGIN
  SELECT * INTO s FROM public.artist_seats WHERE id = _seat_id;
  IF NOT FOUND OR s.invite_email IS NULL THEN RETURN NULL; END IF;
  IF s.status NOT IN ('invited', 'active', 'canceled') THEN RETURN NULL; END IF;
  IF s.status = 'canceled' AND (s.current_period_end IS NULL OR s.current_period_end <= now()) THEN RETURN NULL; END IF;
  SELECT coalesce(p.stage_name, p.legal_name) INTO _inviter FROM public.profiles p WHERE p.id = s.owner_id;
  RETURN jsonb_build_object(
    'artist_name', s.artist_name, 'tier', s.tier, 'inviter', _inviter, 'email', s.invite_email,
    'claimed', s.member_user_id IS NOT NULL, 'ends_on', s.current_period_end
  );
END $function$;
