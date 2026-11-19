-- The marketing team's four mailboxes join the company inbox (founder, 2026-11-19).
--
-- marketing@, partners@, info@ and collaborate@ now route through the Cloudflare Email Worker instead of straight to a Gmail
-- forward, so their mail is stored beside admin@, contracts@ and registrations@. This widens the two mailbox constraints and
-- lets the marketing department read and answer those four and nothing else.
--
-- Additive: no row is rewritten, the super-admin policies are untouched, the registration desk keeps registrations@ only,
-- and the receiving route still writes as the service role, which bypasses these. Safe to run more than once.

ALTER TABLE public.admin_inbox_threads DROP CONSTRAINT IF EXISTS admin_inbox_threads_mailbox;
ALTER TABLE public.admin_inbox_threads
  ADD CONSTRAINT admin_inbox_threads_mailbox
  CHECK (mailbox IN ('admin', 'contracts', 'registrations', 'marketing', 'partners', 'info', 'collaborate'));

ALTER TABLE public.admin_inbox_messages DROP CONSTRAINT IF EXISTS admin_inbox_messages_mailbox;
ALTER TABLE public.admin_inbox_messages
  ADD CONSTRAINT admin_inbox_messages_mailbox
  CHECK (mailbox IN ('admin', 'contracts', 'registrations', 'marketing', 'partners', 'info', 'collaborate'));

-- The marketing department reads the four addresses it answers as. admin@ and contracts@ stay super-admin only: a
-- marketing row can never widen to them here, because the mailbox list is literal.
DROP POLICY IF EXISTS "Marketing reads its mailboxes" ON public.admin_inbox_threads;
CREATE POLICY "Marketing reads its mailboxes" ON public.admin_inbox_threads FOR SELECT TO authenticated
  USING (
    mailbox IN ('marketing', 'partners', 'info', 'collaborate')
    AND public.in_department(auth.uid(), 'marketing')
  );

DROP POLICY IF EXISTS "Marketing reads its mailbox messages" ON public.admin_inbox_messages;
CREATE POLICY "Marketing reads its mailbox messages" ON public.admin_inbox_messages FOR SELECT TO authenticated
  USING (
    mailbox IN ('marketing', 'partners', 'info', 'collaborate')
    AND public.in_department(auth.uid(), 'marketing')
  );

-- A reply is written on the signed-in staff member's own session, from that mailbox, as themselves.
DROP POLICY IF EXISTS "Marketing replies from its mailboxes" ON public.admin_inbox_messages;
CREATE POLICY "Marketing replies from its mailboxes" ON public.admin_inbox_messages FOR INSERT TO authenticated
  WITH CHECK (
    mailbox IN ('marketing', 'partners', 'info', 'collaborate')
    AND public.in_department(auth.uid(), 'marketing')
    AND created_by = auth.uid()
  );
