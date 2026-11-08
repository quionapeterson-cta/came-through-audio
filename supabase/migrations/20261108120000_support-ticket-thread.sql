-- Native ticket replies (founder, 2026-11-08). A ticket becomes a conversation the app owns: the reply is written in
-- Admin → Support Tickets (or the member's own Support tab), stored here, and emailed with a link straight back to the
-- message box. Additive and safe to run more than once: nothing is dropped except the status check, which is replaced
-- with the same three values plus `waiting` (waiting on the member).

-- 1. The thread. One row per message; the ticket's own opening message stays on support_tickets.
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_kind text NOT NULL CHECK (author_kind IN ('staff','member','system')),
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- The name shown in the thread, kept on the message so a departed employee's replies still read correctly.
  author_name text NOT NULL CHECK (char_length(author_name) BETWEEN 1 AND 100),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
  -- Staff-only: never emailed, never shown to the member, not even through a signed link.
  internal boolean NOT NULL DEFAULT false,
  emailed_at timestamptz,
  -- A retry or a double click reuses this, so one reply is never sent twice.
  request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS support_ticket_messages_request_idx
  ON public.support_ticket_messages (ticket_id, request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS support_ticket_messages_thread_idx
  ON public.support_ticket_messages (ticket_id, created_at);

GRANT SELECT, INSERT ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- 2. Who reads a thread. The same split as the queue (ticketScope / 20261105170000_support-ticket-routing.sql):
-- Support reads every ticket, Billing only tickets in the billing area, a member only their own, and a member never
-- reads an internal note.
DROP POLICY IF EXISTS "Support staff read messages" ON public.support_ticket_messages;
CREATE POLICY "Support staff read messages" ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id AND public.in_department(auth.uid(), 'support')
  ));

DROP POLICY IF EXISTS "Billing staff read their messages" ON public.support_ticket_messages;
CREATE POLICY "Billing staff read their messages" ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id
      AND public.in_department(auth.uid(), 'billing')
      AND t.category LIKE 'Account & billing%'
  );

DROP POLICY IF EXISTS "Support staff write messages" ON public.support_ticket_messages;
CREATE POLICY "Support staff write messages" ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (author_kind = 'staff' AND author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id AND public.in_department(auth.uid(), 'support')
  ));

DROP POLICY IF EXISTS "Billing staff write their messages" ON public.support_ticket_messages;
CREATE POLICY "Billing staff write their messages" ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (author_kind = 'staff' AND author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id
      AND public.in_department(auth.uid(), 'billing')
      AND t.category LIKE 'Account & billing%'
  ));

DROP POLICY IF EXISTS "Members read their own thread" ON public.support_ticket_messages;
CREATE POLICY "Members read their own thread" ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (internal = false AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id AND t.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Members write their own replies" ON public.support_ticket_messages;
CREATE POLICY "Members write their own replies" ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (author_kind = 'member' AND internal = false AND author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id AND t.user_id = auth.uid() AND t.status <> 'resolved'
  ));

-- 3. Two facts the queue and the member's tab need: when we first answered, and when the member last read it.
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS first_reply_at timestamptz;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS member_read_at timestamptz;

-- 4. `waiting` joins the three statuses (founder, 2026-11-08): a reply can park a ticket on the member without it
-- pretending to be open or resolved. `resolved` is the closed state the member sees.
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN ('open','in_progress','waiting','resolved'));

-- 5. The queue reads newest activity first and the member's tab reads their own: both are served by one index.
CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON public.support_tickets (user_id, created_at DESC);
