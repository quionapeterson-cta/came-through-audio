-- Company plans (founder, 2026-10-20): the full planning documents, readable in Admin → Plans by super admins only.
-- The table holds no content in git. Plan text is loaded by pasting plans-load.sql (generated locally from the
-- PLAN-*.md files, never committed) into the SQL editor, so plans stay out of the code repository.
-- Also queues the homepage testimonial editor in the Marketing and Branding Task Banks.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.company_plans (
  slug text PRIMARY KEY CHECK (char_length(slug) BETWEEN 1 AND 80),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  status text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_plans TO authenticated;
GRANT ALL ON public.company_plans TO service_role;
ALTER TABLE public.company_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super admins read plans" ON public.company_plans;
CREATE POLICY "Super admins read plans" ON public.company_plans FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.department_tasks (department, title, status, created_by, body)
SELECT v.department, v.title, 'planned', NULL, v.body
FROM (VALUES
  ('marketing', 'Homepage testimonials editor (with Branding)', $t$
Marketing and Branding update homepage testimonials from Admin: name, title, location, service, quote and photo.
- The brand photo filter (black-and-white, cobalt tint, dark fade) is applied automatically and can't be changed or turned off.
- Quotes stay in the client's own words; only trims marked with … are allowed.
- A signed Photo, Video & Testimonial Release is required before a testimonial can be published.
Full plan: Admin → Plans → Homepage testimonials editor.
$t$),
  ('branding', 'Homepage testimonials editor (with Marketing)', $t$
Branding checks each new testimonial photo's crop and focus point. The brand filter is applied automatically and locked.
Full plan: Admin → Plans → Homepage testimonials editor.
$t$)
) AS v(department, title, body)
WHERE NOT EXISTS (SELECT 1 FROM public.department_tasks t WHERE t.title = v.title);
