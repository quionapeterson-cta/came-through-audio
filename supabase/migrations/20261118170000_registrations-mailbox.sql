-- registrations@ joins the company inbox (founder, 2026-11-18).
--
-- The Admin Inbox already stored admin@ and contracts@ mail. This adds the registration desk's own mailbox, which a
-- super admin already sees and the registration department may now read and answer — that mailbox only.
--
-- Additive: the two existing constraints are widened in place, no row is rewritten, and every policy for the original
-- two mailboxes is untouched. Safe to run more than once.

ALTER TABLE public.admin_inbox_threads DROP CONSTRAINT IF EXISTS admin_inbox_threads_mailbox;
ALTER TABLE public.admin_inbox_threads
  ADD CONSTRAINT admin_inbox_threads_mailbox CHECK (mailbox IN ('admin', 'contracts', 'registrations'));

ALTER TABLE public.admin_inbox_messages DROP CONSTRAINT IF EXISTS admin_inbox_messages_mailbox;
ALTER TABLE public.admin_inbox_messages
  ADD CONSTRAINT admin_inbox_messages_mailbox CHECK (mailbox IN ('admin', 'contracts', 'registrations'));

-- The registration desk reads registrations@ only. admin@ and contracts@ keep their super-admin-only policies, and the
-- receiving route still writes with the service role, which bypasses these.
DROP POLICY IF EXISTS "Registration desk reads registrations threads" ON public.admin_inbox_threads;
CREATE POLICY "Registration desk reads registrations threads" ON public.admin_inbox_threads FOR SELECT TO authenticated
  USING (mailbox = 'registrations' AND public.in_department(auth.uid(), 'registration'));

DROP POLICY IF EXISTS "Registration desk reads registrations messages" ON public.admin_inbox_messages;
CREATE POLICY "Registration desk reads registrations messages" ON public.admin_inbox_messages FOR SELECT TO authenticated
  USING (mailbox = 'registrations' AND public.in_department(auth.uid(), 'registration'));

-- A reply is written on the signed-in staff member's own session, from that mailbox, as themselves.
DROP POLICY IF EXISTS "Registration desk replies to registrations mail" ON public.admin_inbox_messages;
CREATE POLICY "Registration desk replies to registrations mail" ON public.admin_inbox_messages FOR INSERT TO authenticated
  WITH CHECK (
    mailbox = 'registrations'
    AND public.in_department(auth.uid(), 'registration')
    AND created_by = auth.uid()
  );
