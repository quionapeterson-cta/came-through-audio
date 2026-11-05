-- Staff Idea Box (founder, 2026-11-05): any staff member can send an idea, paperwork, a video, music, a photo or a
-- project to a super admin. Files land in a private bucket and are read only through a signed link. Additive.
CREATE TABLE IF NOT EXISTS public.staff_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_by uuid NOT NULL,
  kind text NOT NULL DEFAULT 'idea',
  title text NOT NULL,
  details text NOT NULL DEFAULT '',
  link text,
  file_path text,
  file_name text,
  file_size bigint,
  file_mime text,
  status text NOT NULL DEFAULT 'new',
  note text NOT NULL DEFAULT '',
  decided_by uuid,
  decided_at timestamptz,
  CONSTRAINT staff_submissions_kind CHECK (kind IN ('idea', 'paperwork', 'video', 'music', 'photo', 'project', 'other')),
  CONSTRAINT staff_submissions_status CHECK (status IN ('new', 'in_review', 'done', 'declined')),
  -- The ceiling the form enforces (50 MB, Supabase's own project limit); a bigger file never becomes a row.
  CONSTRAINT staff_submissions_size CHECK (file_size IS NULL OR file_size <= 52428800),
  CONSTRAINT staff_submissions_link CHECK (link IS NULL OR link ~* '^https?://')
);

CREATE INDEX IF NOT EXISTS staff_submissions_created_idx ON public.staff_submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS staff_submissions_submitter_idx ON public.staff_submissions (submitted_by, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.staff_submissions TO authenticated;
GRANT ALL ON public.staff_submissions TO service_role;

ALTER TABLE public.staff_submissions ENABLE ROW LEVEL SECURITY;

-- Every staff member sends their own; nobody sends as someone else.
DROP POLICY IF EXISTS "Staff send submissions" ON public.staff_submissions;
CREATE POLICY "Staff send submissions" ON public.staff_submissions FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND submitted_by = auth.uid());

-- You read what you sent; a super admin reads everything.
DROP POLICY IF EXISTS "Staff read own submissions" ON public.staff_submissions;
CREATE POLICY "Staff read own submissions" ON public.staff_submissions FOR SELECT TO authenticated
  USING (submitted_by = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

-- Only a super admin moves a submission along.
DROP POLICY IF EXISTS "Super admins handle submissions" ON public.staff_submissions;
CREATE POLICY "Super admins handle submissions" ON public.staff_submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Private bucket: uploads go through a signed URL the server issues to a signed-in staff member.
INSERT INTO storage.buckets (id, name, public) VALUES ('staff-submissions', 'staff-submissions', false)
  ON CONFLICT (id) DO NOTHING;
