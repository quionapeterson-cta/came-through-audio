-- Saved PDFs (founder, 2026-11-15): every staff member can save a PDF they filled or signed into a folder, and read
-- the team's saved files from Admin → PDF Tools. Files live in a private bucket and are read through signed links.
-- Additive: nothing existing is touched.
CREATE TABLE IF NOT EXISTS public.pdf_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdf_folders_name CHECK (char_length(btrim(name)) BETWEEN 1 AND 60)
);

-- Two folders may not share a name, whatever the capitals.
CREATE UNIQUE INDEX IF NOT EXISTS pdf_folders_name_key ON public.pdf_folders (lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.saved_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.pdf_folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  size_bytes bigint NOT NULL,
  saved_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_pdfs_name CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  -- The ceiling the server enforces (25 MB); a bigger file never becomes a row.
  CONSTRAINT saved_pdfs_size CHECK (size_bytes > 0 AND size_bytes <= 26214400)
);

CREATE INDEX IF NOT EXISTS saved_pdfs_folder_idx ON public.saved_pdfs (folder_id, created_at DESC);
CREATE INDEX IF NOT EXISTS saved_pdfs_created_idx ON public.saved_pdfs (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_folders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_pdfs TO authenticated;
GRANT ALL ON public.pdf_folders TO service_role;
GRANT ALL ON public.saved_pdfs TO service_role;

ALTER TABLE public.pdf_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_pdfs ENABLE ROW LEVEL SECURITY;

-- The shelf is shared: every staff member reads every folder and file.
DROP POLICY IF EXISTS "Staff read pdf folders" ON public.pdf_folders;
CREATE POLICY "Staff read pdf folders" ON public.pdf_folders FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff create pdf folders" ON public.pdf_folders;
CREATE POLICY "Staff create pdf folders" ON public.pdf_folders FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Staff read saved pdfs" ON public.saved_pdfs;
CREATE POLICY "Staff read saved pdfs" ON public.saved_pdfs FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff save pdfs" ON public.saved_pdfs;
CREATE POLICY "Staff save pdfs" ON public.saved_pdfs FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND saved_by = auth.uid());

DROP POLICY IF EXISTS "Staff delete saved pdfs" ON public.saved_pdfs;
CREATE POLICY "Staff delete saved pdfs" ON public.saved_pdfs FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

-- Private bucket: only staff can upload, read or remove, so a link has to be signed by the server for a staff member.
INSERT INTO storage.buckets (id, name, public) VALUES ('saved-pdfs', 'saved-pdfs', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Staff read saved pdf files" ON storage.objects;
CREATE POLICY "Staff read saved pdf files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'saved-pdfs' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff upload saved pdf files" ON storage.objects;
CREATE POLICY "Staff upload saved pdf files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'saved-pdfs' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff delete saved pdf files" ON storage.objects;
CREATE POLICY "Staff delete saved pdf files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'saved-pdfs' AND public.is_staff(auth.uid()));
