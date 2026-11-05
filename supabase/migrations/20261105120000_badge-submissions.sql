-- Badge art protocol (founder, 2026-11-05): Branding, Marketing & Social Media and Support submit badge ideas and the
-- art files; a super admin approves or rejects each one; only the founder uploads to the R2 bucket and marks it done.
-- The art sits in a PRIVATE bucket until approval, so a rejected idea never becomes a public picture. Additive.
CREATE TABLE IF NOT EXISTS public.badge_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_by uuid NOT NULL,
  title text NOT NULL,
  collection text NOT NULL,
  tier text NOT NULL DEFAULT 'standard',
  scope text NOT NULL DEFAULT 'playful',
  set_folder text,
  slug text NOT NULL,
  milestone text NOT NULL DEFAULT '',
  action text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  popup text NOT NULL DEFAULT '',
  art_path text,
  art_name text,
  art_mime text,
  status text NOT NULL DEFAULT 'submitted',
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  uploaded_at timestamptz,
  uploaded_by uuid,
  CONSTRAINT badge_submissions_status CHECK (status IN ('submitted', 'approved', 'rejected', 'uploaded')),
  CONSTRAINT badge_submissions_scope CHECK (scope IN ('serious', 'playful')),
  CONSTRAINT badge_submissions_tier CHECK (tier IN ('standard', 'instant', 'mega', 'ultimate')),
  -- The naming conditions live here too: lowercase words joined by single hyphens, 48 characters at most.
  CONSTRAINT badge_submissions_slug CHECK (slug ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' AND length(slug) <= 48),
  CONSTRAINT badge_submissions_set CHECK (set_folder IS NULL OR set_folder ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$')
);

GRANT SELECT, INSERT, UPDATE ON public.badge_submissions TO authenticated;
GRANT ALL ON public.badge_submissions TO service_role;

ALTER TABLE public.badge_submissions ENABLE ROW LEVEL SECURITY;

-- Whoever designs badges (public.can_manage_badges: super admins, Branding, Marketing & Sales and Support) submits,
-- and only as themselves.
DROP POLICY IF EXISTS "Badge staff submit ideas" ON public.badge_submissions;
CREATE POLICY "Badge staff submit ideas" ON public.badge_submissions FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_badges(auth.uid()) AND submitted_by = auth.uid());

-- Teams read the whole queue so nobody re-submits a rejected idea; a former team member still sees their own.
DROP POLICY IF EXISTS "Badge staff read submissions" ON public.badge_submissions;
CREATE POLICY "Badge staff read submissions" ON public.badge_submissions FOR SELECT TO authenticated
  USING (public.can_manage_badges(auth.uid()) OR submitted_by = auth.uid());

-- Approval is the founder's alone, whatever department someone is in.
DROP POLICY IF EXISTS "Super admins decide submissions" ON public.badge_submissions;
CREATE POLICY "Super admins decide submissions" ON public.badge_submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Private bucket: art is uploaded by the server and read only through a signed link a super admin asks for, so a
-- rejected badge never sits on a public address.
INSERT INTO storage.buckets (id, name, public) VALUES ('badge-submissions', 'badge-submissions', false)
  ON CONFLICT (id) DO NOTHING;
