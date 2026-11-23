-- Saved PDFs are the HR seat's too (founder, 2026-11-23).
--
-- 20261115120000 gave the shared shelf to every staff member, and its policies ask public.is_staff, which is
-- super_admin, employee and department_lead only. An HR Admin opens Admin → PDF Tools, sends a packet, and the shelf
-- under it reports "Only staff can use Saved PDFs." The shelf is the same team tool as the packet desk, so its table
-- and bucket policies name the HR seat as well.
--
-- Nothing else changes: a folder still records its creator, a save is still the saver's own row, a delete is still the
-- team's, and the bucket stays private. Policy names are unchanged, so every earlier check keeps meaning what it
-- meant; only the predicate widens, and the migration is safe to run more than once.

DROP POLICY IF EXISTS "Staff read pdf folders" ON public.pdf_folders;
CREATE POLICY "Staff read pdf folders" ON public.pdf_folders FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR public.in_department(auth.uid(), 'hr')
  );

DROP POLICY IF EXISTS "Staff create pdf folders" ON public.pdf_folders;
CREATE POLICY "Staff create pdf folders" ON public.pdf_folders FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.is_staff(auth.uid())
      OR public.in_department(auth.uid(), 'hr')
    )
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Staff read saved pdfs" ON public.saved_pdfs;
CREATE POLICY "Staff read saved pdfs" ON public.saved_pdfs FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR public.in_department(auth.uid(), 'hr')
  );

DROP POLICY IF EXISTS "Staff save pdfs" ON public.saved_pdfs;
CREATE POLICY "Staff save pdfs" ON public.saved_pdfs FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.is_staff(auth.uid())
      OR public.in_department(auth.uid(), 'hr')
    )
    AND saved_by = auth.uid()
  );

DROP POLICY IF EXISTS "Staff delete saved pdfs" ON public.saved_pdfs;
CREATE POLICY "Staff delete saved pdfs" ON public.saved_pdfs FOR DELETE TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR public.in_department(auth.uid(), 'hr')
  );

-- The private bucket: the signed link a shelf row renders, and the upload or removal behind it, follow the same seat.
DROP POLICY IF EXISTS "Staff read saved pdf files" ON storage.objects;
CREATE POLICY "Staff read saved pdf files" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'saved-pdfs'
    AND (public.is_staff(auth.uid()) OR public.in_department(auth.uid(), 'hr'))
  );

DROP POLICY IF EXISTS "Staff upload saved pdf files" ON storage.objects;
CREATE POLICY "Staff upload saved pdf files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'saved-pdfs'
    AND (public.is_staff(auth.uid()) OR public.in_department(auth.uid(), 'hr'))
  );

DROP POLICY IF EXISTS "Staff delete saved pdf files" ON storage.objects;
CREATE POLICY "Staff delete saved pdf files" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'saved-pdfs'
    AND (public.is_staff(auth.uid()) OR public.in_department(auth.uid(), 'hr'))
  );
