-- Badge art and legal wording, tightened (founder, 2026-11-11; run by hand in the SQL Editor the same day, recorded here so
-- the repo matches the database).
--
-- Badge art: the old policy let any signed-in member read every row, including art for badges nobody had earned. Reading is
-- now limited to staff who can manage badges; the art stays readable to everyone else through the badge they own, so no page
-- loses a picture.
--
-- Legal wording: the old policy let anyone read every row. The page only ever prints published wording, so anon and
-- signed-in members now read only rows that have a document and a body, and only the four columns the page displays —
-- any future internal column stays server-side. Writing stays with authenticated (the admin screen), as before.

DROP POLICY IF EXISTS "Signed-in members read badge art" ON public.badge_art;
CREATE POLICY "Badge staff read badge art" ON public.badge_art FOR SELECT TO authenticated USING (public.can_manage_badges(auth.uid()));

DROP POLICY IF EXISTS "Anyone reads legal wording" ON public.legal_overrides;
CREATE POLICY "Anyone reads published legal wording" ON public.legal_overrides FOR SELECT TO anon, authenticated USING (doc IS NOT NULL AND length(body) > 0);
REVOKE SELECT ON public.legal_overrides FROM anon, authenticated;
GRANT SELECT (doc, section, body, updated_at) ON public.legal_overrides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.legal_overrides TO authenticated;
