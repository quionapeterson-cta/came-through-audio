-- Signature packets: a super admin works them, HR sends and reads what came back (founder, 2026-11-22).
--
-- 20261115230000 gave every staff member read, insert and update on pdf_packets, because any staff member could work
-- Sent & Inbox then. Building a packet, setting the reply inbox and counter-signing are now the super admin's alone,
-- while sending and reading the sent/completed lists stay open to HR as well (the 2026-11-19 sending rule). HR never
-- updates a packet: that is building and counter-signing.
--
-- The public signing page is untouched: it still reads and submits one packet by its unguessable id through the
-- SECURITY DEFINER functions `pdf_packet_signing` / `pdf_packet_submit`, which do not depend on these policies.

DROP POLICY IF EXISTS "Staff read pdf packets" ON public.pdf_packets;
-- An earlier draft of this migration opened read and update to HR; drop its names too, so the split below is what holds.
DROP POLICY IF EXISTS "Super admins and HR read pdf packets" ON public.pdf_packets;
CREATE POLICY "Super admins and HR read pdf packets" ON public.pdf_packets FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.in_department(auth.uid(), 'hr')
  );

DROP POLICY IF EXISTS "Staff send pdf packets" ON public.pdf_packets;
CREATE POLICY "Super admins and HR send pdf packets" ON public.pdf_packets FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.has_role(auth.uid(), 'super_admin')
      OR public.in_department(auth.uid(), 'hr')
    )
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Staff update pdf packets" ON public.pdf_packets;
DROP POLICY IF EXISTS "Super admins and HR update pdf packets" ON public.pdf_packets;
CREATE POLICY "Super admins update pdf packets" ON public.pdf_packets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- HR sends but does not set the reply inbox, so the draft policy that let them write that one setting goes.
DROP POLICY IF EXISTS "HR writes the packet inbox setting" ON public.site_settings;
