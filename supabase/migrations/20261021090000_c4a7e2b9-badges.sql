-- Badge & award system (PLAN-badges-roles-app.md). New tables only; nothing existing is changed.
--
-- 1. user_badges: badges a user has earned. Users can read their own and mark them seen, nothing else.
--    Rows are written only by the check-badges server function (service role) after it re-counts the user's real
--    data, so nobody can hand themselves a badge (sponsored badges will unlock perks). Earned badges are never removed.
-- 2. badge_events: actions that leave no other record (agency export, master download, blueprint guide read).
--    Users log their own; these badges never carry sponsor perks.
-- 3. badge_settings: staff switch a badge off for new unlocks. Missing row = on.
-- 4. can_manage_badges(): super admins and the Branding, Marketing & Sales and Support departments see and control
--    badges (Admin → Badges). badge_earned_counts() gives them how many users hold each badge, never who.
-- Safe to run more than once.

CREATE OR REPLACE FUNCTION public.can_manage_badges(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.in_department(_user_id, 'branding') OR public.in_department(_user_id, 'marketing_sales') OR public.in_department(_user_id, 'support')
$$;
REVOKE ALL ON FUNCTION public.can_manage_badges(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_badges(uuid) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id text NOT NULL CHECK (char_length(badge_id) BETWEEN 1 AND 80),
  times int NOT NULL DEFAULT 1 CHECK (times >= 1),
  earned_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz,
  PRIMARY KEY (user_id, badge_id)
);
GRANT SELECT ON public.user_badges TO authenticated;
GRANT UPDATE (seen_at) ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own badges" ON public.user_badges;
CREATE POLICY "Users read own badges" ON public.user_badges FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users mark own badges seen" ON public.user_badges;
CREATE POLICY "Users mark own badges seen" ON public.user_badges FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.badge_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('agency_export', 'master_download', 'blueprint_read')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS badge_events_user_kind ON public.badge_events (user_id, kind);
GRANT SELECT, INSERT ON public.badge_events TO authenticated;
GRANT ALL ON public.badge_events TO service_role;
ALTER TABLE public.badge_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users log own badge events" ON public.badge_events;
CREATE POLICY "Users log own badge events" ON public.badge_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users read own badge events" ON public.badge_events;
CREATE POLICY "Users read own badge events" ON public.badge_events FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.badge_settings (
  badge_id text PRIMARY KEY CHECK (char_length(badge_id) BETWEEN 1 AND 80),
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.badge_settings TO authenticated;
GRANT ALL ON public.badge_settings TO service_role;
ALTER TABLE public.badge_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone signed in reads badge settings" ON public.badge_settings;
CREATE POLICY "Anyone signed in reads badge settings" ON public.badge_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Badge staff add badge settings" ON public.badge_settings;
CREATE POLICY "Badge staff add badge settings" ON public.badge_settings FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_badges(auth.uid()));
DROP POLICY IF EXISTS "Badge staff change badge settings" ON public.badge_settings;
CREATE POLICY "Badge staff change badge settings" ON public.badge_settings FOR UPDATE TO authenticated
  USING (public.can_manage_badges(auth.uid())) WITH CHECK (public.can_manage_badges(auth.uid()));

CREATE OR REPLACE FUNCTION public.badge_earned_counts()
RETURNS TABLE (badge_id text, users bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_manage_badges(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN QUERY SELECT b.badge_id, count(*) FROM public.user_badges b GROUP BY b.badge_id;
END $$;
REVOKE ALL ON FUNCTION public.badge_earned_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.badge_earned_counts() TO authenticated, service_role;
