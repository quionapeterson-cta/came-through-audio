-- The template library is read by every staff member and changed by the leads (founder, 2026-11-15).
--
-- 20261115200000 let any staff member create, update and delete a template. Sending a packet still needs the library on
-- every staff login, so the SELECT policy stays exactly as it is; only the three write policies narrow to a super admin,
-- HR admin, project manager or department lead. The server functions check the same roles first, so this is the second
-- line of defence rather than the only one. No row, column or grant changes here.

DROP POLICY IF EXISTS "Staff create pdf templates" ON public.pdf_templates;
CREATE POLICY "Leads create pdf templates" ON public.pdf_templates FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid())
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = auth.uid()
        AND r.role IN ('super_admin', 'hr_admin', 'project_manager', 'department_lead')
    )
  );

DROP POLICY IF EXISTS "Staff update pdf templates" ON public.pdf_templates;
CREATE POLICY "Leads update pdf templates" ON public.pdf_templates FOR UPDATE TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = auth.uid()
        AND r.role IN ('super_admin', 'hr_admin', 'project_manager', 'department_lead')
    )
  )
  WITH CHECK (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = auth.uid()
        AND r.role IN ('super_admin', 'hr_admin', 'project_manager', 'department_lead')
    )
  );

DROP POLICY IF EXISTS "Staff delete pdf templates" ON public.pdf_templates;
CREATE POLICY "Leads delete pdf templates" ON public.pdf_templates FOR DELETE TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = auth.uid()
        AND r.role IN ('super_admin', 'hr_admin', 'project_manager', 'department_lead')
    )
  );
