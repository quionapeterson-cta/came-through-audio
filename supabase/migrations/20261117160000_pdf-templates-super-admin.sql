-- The template library is read by every staff member and changed by a super admin alone (founder, 2026-11-17).
--
-- 20261116130000 let a super admin, HR admin, project manager or department lead create, update and delete a template.
-- The founder narrowed that back to a super admin. Sending a packet still needs the library on every staff login, so the
-- SELECT policy is untouched; only the three write policies narrow. The server functions check the same role first, so
-- this is the second line of defence rather than the only one. No row, column or grant changes here.

DROP POLICY IF EXISTS "Leads create pdf templates" ON public.pdf_templates;
CREATE POLICY "Super admins create pdf templates" ON public.pdf_templates FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid())
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = auth.uid()
        AND r.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Leads update pdf templates" ON public.pdf_templates;
CREATE POLICY "Super admins update pdf templates" ON public.pdf_templates FOR UPDATE TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = auth.uid()
        AND r.role = 'super_admin'
    )
  )
  WITH CHECK (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = auth.uid()
        AND r.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Leads delete pdf templates" ON public.pdf_templates;
CREATE POLICY "Super admins delete pdf templates" ON public.pdf_templates FOR DELETE TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = auth.uid()
        AND r.role = 'super_admin'
    )
  );
