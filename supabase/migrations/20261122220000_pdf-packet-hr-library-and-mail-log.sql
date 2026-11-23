-- HR can send a packet, so the two tables a send touches include the HR seat (founder, 2026-11-22).
--
-- 20261122200000 gave the packet seat to a super admin or HR, and the server functions ask that seat. These two paths
-- still asked public.is_staff, which is super_admin, employee and department_lead only — an HR Admin (the role the HR
-- department is usually held through) opens Sent & Inbox and the send form, then the library comes back empty and no
-- send is logged. Nothing here changes who may write a template: that stays a super admin's.
--
--   • pdf_templates is read to pick the document being sent;
--   • pdf_email_sends is read for the delivery state of a send, and written once per send as the audit row, still only
--     for the sender's own row.
--
-- Policy names stay the same so every earlier check in db-check.sql keeps meaning what it meant; only the predicate
-- widens, and nothing is dropped, rewritten or deleted. Safe to run more than once.

DROP POLICY IF EXISTS "Staff read pdf templates" ON public.pdf_templates;
CREATE POLICY "Staff read pdf templates" ON public.pdf_templates FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR public.in_department(auth.uid(), 'hr')
  );

DROP POLICY IF EXISTS "Staff read pdf email sends" ON public.pdf_email_sends;
CREATE POLICY "Staff read pdf email sends" ON public.pdf_email_sends FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR public.in_department(auth.uid(), 'hr')
  );

DROP POLICY IF EXISTS "Staff record pdf email sends" ON public.pdf_email_sends;
CREATE POLICY "Staff record pdf email sends" ON public.pdf_email_sends FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.is_staff(auth.uid())
      OR public.in_department(auth.uid(), 'hr')
    )
    AND sent_by = auth.uid()
  );
