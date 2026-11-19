-- info@ joins the Support queue, a thread can be escalated, and the inbox grows four company mailboxes
-- (founder, 2026-11-19).
--
-- Everything here is additive: the support@ path, its policies and its rows are untouched, the two inbox check
-- constraints are widened in place, and no existing row is rewritten (channel defaults to 'support', which is what every
-- row written before today is). Safe to run more than once.

-- 1. The channel. A ticket opened on the site is `support`; a message that arrived at info@ is `info`, and the channel
--    decides which address answers it (outboundFor in src/lib/support-replies.ts).
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'support';
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_channel_check;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_channel_check
  CHECK (channel IN ('support', 'info'));

-- One ticket per mail: a Cloudflare retry of the same message is the ticket that already exists.
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS source_message_id text;
CREATE UNIQUE INDEX IF NOT EXISTS support_tickets_source_message_idx
  ON public.support_tickets (source_message_id) WHERE source_message_id IS NOT NULL;

-- 2. Escalation. The flags are what the queue filters and the Marketing/Founder views read; the log keeps who handed it
--    over, why, and whether the receiving team has opened it.
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS escalated_marketing boolean NOT NULL DEFAULT false;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS escalated_founder boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.support_ticket_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  -- Who was handed the thread: the marketing team, or the founder.
  tag text NOT NULL CHECK (tag IN ('marketing', 'founder')),
  -- The internal handoff note: staff-only copy, kept with the escalation as well as on the thread.
  note text NOT NULL DEFAULT '',
  by_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  -- The in-app notification: unread until the receiving team opens the thread.
  read_at timestamptz,
  read_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS support_ticket_escalations_ticket_idx
  ON public.support_ticket_escalations (ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_ticket_escalations_inbox_idx
  ON public.support_ticket_escalations (tag, read_at);

GRANT SELECT, INSERT, UPDATE ON public.support_ticket_escalations TO authenticated;
GRANT ALL ON public.support_ticket_escalations TO service_role;
ALTER TABLE public.support_ticket_escalations ENABLE ROW LEVEL SECURITY;

-- 3. Who is reading a thread right now, so two agents don't answer the same message.
CREATE TABLE IF NOT EXISTS public.support_ticket_viewers (
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.support_ticket_viewers TO authenticated;
GRANT ALL ON public.support_ticket_viewers TO service_role;
ALTER TABLE public.support_ticket_viewers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Support staff read viewers" ON public.support_ticket_viewers FOR SELECT TO authenticated
  USING (public.in_department(auth.uid(), 'support') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Support staff mark themselves viewing" ON public.support_ticket_viewers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (public.in_department(auth.uid(), 'support') OR public.has_role(auth.uid(), 'super_admin')));
CREATE POLICY "Support staff keep their own viewer row fresh" ON public.support_ticket_viewers FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 4. The escalation log: the desk that handed it over writes it; the team it was handed to reads it.
CREATE POLICY "Support staff read escalations" ON public.support_ticket_escalations FOR SELECT TO authenticated
  USING (public.in_department(auth.uid(), 'support') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Marketing reads its escalations" ON public.support_ticket_escalations FOR SELECT TO authenticated
  USING (tag = 'marketing' AND public.in_department(auth.uid(), 'marketing'));
CREATE POLICY "Support staff escalate" ON public.support_ticket_escalations FOR INSERT TO authenticated
  WITH CHECK (
    by_id = auth.uid()
    AND (public.in_department(auth.uid(), 'support') OR public.in_department(auth.uid(), 'marketing') OR public.has_role(auth.uid(), 'super_admin'))
  );
CREATE POLICY "Receiving team marks an escalation read" ON public.support_ticket_escalations FOR UPDATE TO authenticated
  USING (tag = 'marketing' AND public.in_department(auth.uid(), 'marketing'))
  WITH CHECK (tag = 'marketing' AND public.in_department(auth.uid(), 'marketing'));

-- 5. The escalated thread itself has to open for the team it was handed to, and for the founder.
DROP POLICY IF EXISTS "Marketing reads tickets escalated to it" ON public.support_tickets;
CREATE POLICY "Marketing reads tickets escalated to it" ON public.support_tickets FOR SELECT TO authenticated
  USING (escalated_marketing AND public.in_department(auth.uid(), 'marketing'));

DROP POLICY IF EXISTS "Founder reads every ticket" ON public.support_tickets;
CREATE POLICY "Founder reads every ticket" ON public.support_tickets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Marketing reads escalated threads" ON public.support_ticket_messages;
CREATE POLICY "Marketing reads escalated threads" ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id AND t.escalated_marketing AND public.in_department(auth.uid(), 'marketing')
  ));

DROP POLICY IF EXISTS "Founder reads every thread" ON public.support_ticket_messages;
CREATE POLICY "Founder reads every thread" ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 6. The inbox stores nine mailboxes now: security@, legal@ and billing@ join it, and info@ deliberately does not,
--    because an info@ message becomes a Support ticket instead.
ALTER TABLE public.admin_inbox_threads DROP CONSTRAINT IF EXISTS admin_inbox_threads_mailbox;
ALTER TABLE public.admin_inbox_threads
  ADD CONSTRAINT admin_inbox_threads_mailbox
  CHECK (mailbox IN ('admin', 'contracts', 'security', 'legal', 'billing', 'registrations', 'marketing', 'partners', 'collaborate'));

ALTER TABLE public.admin_inbox_messages DROP CONSTRAINT IF EXISTS admin_inbox_messages_mailbox;
ALTER TABLE public.admin_inbox_messages
  ADD CONSTRAINT admin_inbox_messages_mailbox
  CHECK (mailbox IN ('admin', 'contracts', 'security', 'legal', 'billing', 'registrations', 'marketing', 'partners', 'collaborate'));

-- 7. The billing team answers billing@, and a super admin beside them. The other new mailboxes stay the super admin's.
DROP POLICY IF EXISTS "Billing reads its mailbox" ON public.admin_inbox_threads;
CREATE POLICY "Billing reads its mailbox" ON public.admin_inbox_threads FOR SELECT TO authenticated
  USING (mailbox = 'billing' AND public.in_department(auth.uid(), 'billing'));

DROP POLICY IF EXISTS "Billing reads its mailbox messages" ON public.admin_inbox_messages;
CREATE POLICY "Billing reads its mailbox messages" ON public.admin_inbox_messages FOR SELECT TO authenticated
  USING (mailbox = 'billing' AND public.in_department(auth.uid(), 'billing'));

DROP POLICY IF EXISTS "Billing replies from its mailbox" ON public.admin_inbox_messages;
CREATE POLICY "Billing replies from its mailbox" ON public.admin_inbox_messages FOR INSERT TO authenticated
  WITH CHECK (mailbox = 'billing' AND public.in_department(auth.uid(), 'billing') AND created_by = auth.uid());
