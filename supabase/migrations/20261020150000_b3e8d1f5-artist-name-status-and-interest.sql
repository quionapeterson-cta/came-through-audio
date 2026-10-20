-- Artist-name pop-up and "Add another artist: notify me". Nothing existing is deleted or rewritten.
--
-- 1. artist_name_status() also returns frees_up_at: when the oldest of the last 12 months' changes stops counting,
--    so the app can say "1 change frees up on Mar 3, 2027". Same rules, same signature; read-only.
-- 2. feature_interest: features a user asked to hear about (for now "artist_seats"). Owner-only; staff can read it.

CREATE OR REPLACE FUNCTION public.artist_name_status(uid uuid DEFAULT auth.uid())
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  grace_until timestamptz;
  last_change timestamptz;
  recent int;
  third timestamptz;
  oldest timestamptz;
  next_at timestamptz;
BEGIN
  IF uid IS NULL OR (auth.uid() IS NOT NULL AND auth.uid() <> uid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT u.created_at + interval '72 hours' INTO grace_until FROM auth.users u WHERE u.id = uid;
  SELECT max(changed_at) INTO last_change FROM public.artist_name_changes WHERE user_id = uid AND counted;
  SELECT count(*) INTO recent FROM public.artist_name_changes WHERE user_id = uid AND counted AND changed_at > now() - interval '12 months';
  SELECT changed_at INTO third FROM public.artist_name_changes WHERE user_id = uid AND counted AND changed_at > now() - interval '12 months'
    ORDER BY changed_at DESC OFFSET 2 LIMIT 1;
  SELECT min(changed_at) INTO oldest FROM public.artist_name_changes WHERE user_id = uid AND counted AND changed_at > now() - interval '12 months';
  next_at := greatest(last_change + interval '7 days', CASE WHEN recent >= 3 THEN third + interval '12 months' END);
  IF grace_until > now() OR next_at <= now() THEN next_at := NULL; END IF;
  RETURN jsonb_build_object(
    'in_grace', coalesce(grace_until > now(), false),
    'grace_until', grace_until,
    'changes_left', greatest(0, 3 - coalesce(recent, 0)),
    'next_change_at', next_at,
    'frees_up_at', oldest + interval '12 months'
  );
END $$;
REVOKE ALL ON FUNCTION public.artist_name_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.artist_name_status(uuid) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.feature_interest (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  feature text NOT NULL CHECK (feature IN ('artist_seats')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature)
);
GRANT SELECT, INSERT, DELETE ON public.feature_interest TO authenticated;
GRANT ALL ON public.feature_interest TO service_role;
ALTER TABLE public.feature_interest ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own feature interest" ON public.feature_interest;
CREATE POLICY "Users manage own feature interest" ON public.feature_interest FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Staff read feature interest" ON public.feature_interest;
CREATE POLICY "Staff read feature interest" ON public.feature_interest FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
