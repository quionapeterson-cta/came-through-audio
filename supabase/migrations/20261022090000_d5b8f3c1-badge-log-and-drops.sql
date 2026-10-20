-- Badge round 2 (founder's changes, 2026-10-20). Adds to the badge tables; nothing existing is removed.
--
-- 1. user_badges.log: one entry per time a badge was earned ({"at": timestamp}, plus "pick" for badges where the user
--    chooses the art, like Self-Produced). The profile shows each earning as its own badge with its date.
--    Written only by the server (service role), like the rest of user_badges; users can still only update seen_at.
--    Existing rows get their first earned date, so no earned badge loses its history.
-- 2. badge_drops: Branding's log of new badge releases (holiday, promotion, new collection badge). Admin → Badges
--    reminds the team when six months have passed since the last one.
-- Safe to run more than once.

ALTER TABLE public.user_badges ADD COLUMN IF NOT EXISTS log jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE public.user_badges SET log = jsonb_build_array(jsonb_build_object('at', earned_at)) WHERE log = '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.badge_drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 500),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.badge_drops TO authenticated;
GRANT ALL ON public.badge_drops TO service_role;
ALTER TABLE public.badge_drops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Badge staff read badge drops" ON public.badge_drops;
CREATE POLICY "Badge staff read badge drops" ON public.badge_drops FOR SELECT TO authenticated
  USING (public.can_manage_badges(auth.uid()));
DROP POLICY IF EXISTS "Badge staff log badge drops" ON public.badge_drops;
CREATE POLICY "Badge staff log badge drops" ON public.badge_drops FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_badges(auth.uid()) AND created_by = auth.uid());
