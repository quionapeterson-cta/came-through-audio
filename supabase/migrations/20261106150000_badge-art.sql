-- Founder-replaced badge art (founder, 2026-11-06).
--
-- The picture itself still goes into the Cloudflare R2 bucket by the founder's own hand (AGENTS.md, Badge Art Protocol);
-- this row only records which key the app should request for a badge, so a re-drawn badge can be swapped in without a
-- deploy. Nothing is written from the browser: the server function `setBadgeArt` checks `public.is_founder` and then
-- writes with the service role.

CREATE TABLE IF NOT EXISTS public.badge_art (
  badge_id text PRIMARY KEY,
  -- A path inside the art tree, so a replacement can never point somewhere else on the internet.
  src text NOT NULL CHECK (src ~ '^/(icons|art)/[A-Za-z0-9/_.-]+$'),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.badge_art ENABLE ROW LEVEL SECURITY;

-- Every signed-in member reads it: the shelf and the unlock pop-ups need the same art the founder set.
CREATE POLICY "Signed-in members read badge art" ON public.badge_art FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.badge_art TO authenticated;
GRANT ALL ON public.badge_art TO service_role;
