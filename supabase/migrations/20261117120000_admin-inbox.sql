-- Admin Inbox, part 1 (founder, 2026-11-17): mail sent to admin@ (and contracts@) is stored as threads we can answer
-- from Admin instead of only living in someone's Gmail. Two new tables; nothing existing is altered. Additive and safe
-- to run more than once.
--
-- The receiver is src/routes/api/public/email/inbound.ts, posted to by the Cloudflare Email Worker on those two routes
-- only. Every other @camethroughaudio.com address keeps Cloudflare's Email Routing untouched.
--
-- Threading: a reply joins the thread named by its In-Reply-To / References, otherwise the thread with the same
-- mailbox, counterpart address and subject (once Re:/Fwd: are stripped). subject_key is that stripped, folded subject.

CREATE TABLE IF NOT EXISTS public.admin_inbox_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  mailbox text NOT NULL,
  -- The subject as the first message carried it, for display.
  subject text NOT NULL DEFAULT '',
  -- Lowercased, Re:/Fwd:-stripped subject: what a message with no References is matched on.
  subject_key text NOT NULL DEFAULT '',
  counterpart_email text NOT NULL,
  counterpart_name text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  -- There is deliberately no unread counter: unread is counted from the messages themselves, so a badge can
  -- never undercount (see the index below for the query).
  CONSTRAINT admin_inbox_threads_mailbox CHECK (mailbox IN ('admin', 'contracts'))
);

-- One thread per mailbox, correspondent and subject: the receiver can insert blind and let this refuse a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS admin_inbox_threads_key_idx
  ON public.admin_inbox_threads (mailbox, counterpart_email, subject_key);

CREATE INDEX IF NOT EXISTS admin_inbox_threads_recent_idx
  ON public.admin_inbox_threads (mailbox, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  thread_id uuid NOT NULL REFERENCES public.admin_inbox_threads(id) ON DELETE CASCADE,
  mailbox text NOT NULL,
  direction text NOT NULL,
  -- The mail's own Message-ID, angle brackets removed: what a later reply names in In-Reply-To.
  message_id text,
  in_reply_to text,
  from_email text NOT NULL,
  from_name text,
  to_emails text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL DEFAULT '',
  body_text text,
  body_html text,
  -- A reply we send from Admin: Resend's id for it, and whether it was accepted.
  resend_id text,
  send_status text,
  received_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  created_by uuid,
  CONSTRAINT admin_inbox_messages_mailbox CHECK (mailbox IN ('admin', 'contracts')),
  CONSTRAINT admin_inbox_messages_direction CHECK (direction IN ('inbound', 'outbound'))
);

-- The same mail delivered twice (a worker retry) is one row.
CREATE UNIQUE INDEX IF NOT EXISTS admin_inbox_messages_message_idx
  ON public.admin_inbox_messages (mailbox, message_id)
  WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS admin_inbox_messages_thread_idx
  ON public.admin_inbox_messages (thread_id, created_at);

-- Unread is derived, never stored (founder, 2026-11-17): a counter incremented by the route loses an increment when
-- two deliveries land together, and the badge then reads low for good. The one source of truth is the messages:
--   select count(*) from public.admin_inbox_messages
--    where direction = 'inbound' and read_at is null                -- the inbox badge
--    and thread_id = $1                                              -- one thread's unread count
-- This partial index keeps both counts cheap.
CREATE INDEX IF NOT EXISTS admin_inbox_messages_unread_idx
  ON public.admin_inbox_messages (thread_id, received_at)
  WHERE read_at IS NULL AND direction = 'inbound';

GRANT SELECT, INSERT, UPDATE ON public.admin_inbox_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.admin_inbox_messages TO authenticated;
GRANT ALL ON public.admin_inbox_threads TO service_role;
GRANT ALL ON public.admin_inbox_messages TO service_role;

ALTER TABLE public.admin_inbox_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_inbox_messages ENABLE ROW LEVEL SECURITY;

-- Only a super admin reads the company inbox. The receiving route writes as the service role, which bypasses these.
DROP POLICY IF EXISTS "Super admins read admin inbox threads" ON public.admin_inbox_threads;
CREATE POLICY "Super admins read admin inbox threads" ON public.admin_inbox_threads FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins open admin inbox threads" ON public.admin_inbox_threads;
CREATE POLICY "Super admins open admin inbox threads" ON public.admin_inbox_threads FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins update admin inbox threads" ON public.admin_inbox_threads;
CREATE POLICY "Super admins update admin inbox threads" ON public.admin_inbox_threads FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins read admin inbox messages" ON public.admin_inbox_messages;
CREATE POLICY "Super admins read admin inbox messages" ON public.admin_inbox_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- A reply from Admin is written on the signed-in super admin's own session; created_by is never someone else.
DROP POLICY IF EXISTS "Super admins send from the admin inbox" ON public.admin_inbox_messages;
CREATE POLICY "Super admins send from the admin inbox" ON public.admin_inbox_messages FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') AND created_by = auth.uid());

DROP POLICY IF EXISTS "Super admins update admin inbox messages" ON public.admin_inbox_messages;
CREATE POLICY "Super admins update admin inbox messages" ON public.admin_inbox_messages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
