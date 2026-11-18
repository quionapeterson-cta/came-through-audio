-- Registration workflow, agency invites and the Super Admin message board (founder, 2026-11-18).
--
-- Four new tables and two columns on an existing one. Nothing is renamed, dropped or rewritten: the Admin Inbox tables
-- and every registration row keep their shape, so the queue that already ships keeps working while these fill up.
--
-- Written by server functions with the service role (the receiver, the registration queue and the board), so the
-- grants below are reads for staff and full access for service_role only. The one exception is admin_board_reads,
-- which a super admin writes for themselves so an unread badge can be counted from the replies themselves rather than
-- from a stored counter that a lost update would leave reading low.

-- 1. Agency invitations. -----------------------------------------------------
-- A representative invitation (or its verification code) from SoundExchange, The MLC or ASCAP, detected by the
-- Cloudflare Email Worker and filed beside the mail that carried it. The mail itself stays in admin_inbox_messages;
-- this row is what Admin → Registrations can surface and track.
CREATE TABLE IF NOT EXISTS public.agency_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- The three agencies that invite a representative. BMI is not here on purpose: it grants access inside the account.
  agency text NOT NULL CHECK (agency IN ('SoundExchange', 'The MLC', 'ASCAP')),
  -- invite: "you have been added" — verification: a code or a confirm link — notice: everything else from the agency.
  kind text NOT NULL DEFAULT 'invite' CHECK (kind IN ('invite', 'verification', 'notice')),
  status text NOT NULL DEFAULT 'invite_received'
    CHECK (status IN ('invite_received', 'representative_accepted', 'action_needed')),
  mailbox text NOT NULL DEFAULT 'admin',
  -- The stored message, so the panel can open the conversation the invite arrived in.
  inbox_message_id uuid REFERENCES public.admin_inbox_messages(id) ON DELETE SET NULL,
  -- The mail's own Message-ID, angle brackets removed: a redelivery is one invite, not two.
  message_id text,
  sender_email text NOT NULL,
  sender_domain text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  -- What the invite says the account is called, and the address inside it that looks like the invited person.
  account_name text,
  user_email text,
  verify_url text,
  received_at timestamptz NOT NULL DEFAULT now(),
  handled_at timestamptz,
  handled_by uuid,
  note text
);

CREATE UNIQUE INDEX IF NOT EXISTS agency_invites_message_idx
  ON public.agency_invites (agency, message_id)
  WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS agency_invites_user_idx ON public.agency_invites (user_email);
CREATE INDEX IF NOT EXISTS agency_invites_open_idx ON public.agency_invites (status, received_at DESC);

-- 2. The board's threads and replies. ----------------------------------------
-- No FK on issue_id: registration_issues points back at a thread, so the constraint is added after both tables exist.
CREATE TABLE IF NOT EXISTS public.admin_board_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL CHECK (category IN (
    'reported_issues',
    'agency_escalations',
    'client_followups',
    'billing_audits',
    'announcements'
  )),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_by uuid,
  created_name text,
  -- The registration case a reported issue came from, so the board can deep-link back to it.
  issue_id uuid,
  purchase_id uuid,
  song_id uuid,
  user_email text,
  user_name text,
  last_reply_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_board_threads_category_idx
  ON public.admin_board_threads (category, last_reply_at DESC);
CREATE INDEX IF NOT EXISTS admin_board_threads_status_idx
  ON public.admin_board_threads (status, priority, last_reply_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_board_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  thread_id uuid NOT NULL REFERENCES public.admin_board_threads(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
  author_id uuid,
  author_name text,
  -- Addresses tagged with @ in the body, so a mention can be highlighted without parsing the text again.
  mentions text[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS admin_board_replies_thread_idx ON public.admin_board_replies (thread_id, created_at);

-- 3. What a super admin has already read. Derived unread, exactly like the inbox.
CREATE TABLE IF NOT EXISTS public.admin_board_reads (
  thread_id uuid NOT NULL REFERENCES public.admin_board_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

-- 4. Per-song issues raised from Admin → Registrations. ----------------------
CREATE TABLE IF NOT EXISTS public.registration_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  song_id uuid NOT NULL REFERENCES public.registration_songs(id) ON DELETE CASCADE,
  purchase_id uuid NOT NULL REFERENCES public.registration_orders(purchase_id) ON DELETE CASCADE,
  user_id uuid,
  agency text NOT NULL,
  detail text NOT NULL CHECK (char_length(detail) BETWEEN 1 AND 4000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  reported_by uuid,
  reported_name text,
  -- The board thread this issue opened, so "Mark Resolved" in one place settles both.
  thread_id uuid REFERENCES public.admin_board_threads(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolved_by uuid
);

-- The four registries an order can be bought for, plus our own metadata work. BMI is here even though it sends no
-- invitation: its songs are registered from the same queue, so its problems are reported from the same button.
ALTER TABLE public.registration_issues DROP CONSTRAINT IF EXISTS registration_issues_agency_check;
ALTER TABLE public.registration_issues
  ADD CONSTRAINT registration_issues_agency_check
  CHECK (agency IN ('SoundExchange', 'The MLC', 'ASCAP', 'BMI', 'Internal/Metadata'));

CREATE INDEX IF NOT EXISTS registration_issues_song_idx ON public.registration_issues (song_id, status);
CREATE INDEX IF NOT EXISTS registration_issues_open_idx ON public.registration_issues (status, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_board_threads_issue_fk'
  ) THEN
    ALTER TABLE public.admin_board_threads
      ADD CONSTRAINT admin_board_threads_issue_fk
      FOREIGN KEY (issue_id) REFERENCES public.registration_issues(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Two columns on the order, for the one-click "All Songs Registered". -----
-- The batch finish is recorded, not inferred: a later unlock for a fix must not make an already-celebrated account look
-- unfinished, and the celebratory email may only be sent once.
ALTER TABLE public.registration_orders
  ADD COLUMN IF NOT EXISTS batch_registered_at timestamptz;
ALTER TABLE public.registration_orders
  ADD COLUMN IF NOT EXISTS batch_registered_by uuid;

-- 6. Permissions. ------------------------------------------------------------
GRANT SELECT ON public.agency_invites TO authenticated;
GRANT SELECT ON public.registration_issues TO authenticated;
GRANT SELECT ON public.admin_board_threads TO authenticated;
GRANT SELECT ON public.admin_board_replies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.admin_board_reads TO authenticated;

GRANT ALL ON public.agency_invites TO service_role;
GRANT ALL ON public.registration_issues TO service_role;
GRANT ALL ON public.admin_board_threads TO service_role;
GRANT ALL ON public.admin_board_replies TO service_role;
GRANT ALL ON public.admin_board_reads TO service_role;

ALTER TABLE public.agency_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_board_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_board_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_board_reads ENABLE ROW LEVEL SECURITY;

-- Agency invites are registration work: any staff member may read them, and only the server writes them.
DROP POLICY IF EXISTS "Staff read agency invites" ON public.agency_invites;
CREATE POLICY "Staff read agency invites" ON public.agency_invites FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff read registration issues" ON public.registration_issues;
CREATE POLICY "Staff read registration issues" ON public.registration_issues FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- The board is the super admin's, plus the threads a staff member opened themselves, so filing an issue shows the
-- answer without exposing every internal note to the whole team.
DROP POLICY IF EXISTS "Board threads for super admins and their authors" ON public.admin_board_threads;
CREATE POLICY "Board threads for super admins and their authors" ON public.admin_board_threads FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR created_by = auth.uid());

DROP POLICY IF EXISTS "Board replies follow their thread" ON public.admin_board_replies;
CREATE POLICY "Board replies follow their thread" ON public.admin_board_replies FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_board_threads t
    WHERE t.id = thread_id
      AND (public.has_role(auth.uid(), 'super_admin') OR t.created_by = auth.uid())
  ));

-- Read marks are the viewer's own rows and nobody else's.
DROP POLICY IF EXISTS "Read your own board marks" ON public.admin_board_reads;
CREATE POLICY "Read your own board marks" ON public.admin_board_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Mark your own board reads" ON public.admin_board_reads;
CREATE POLICY "Mark your own board reads" ON public.admin_board_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Move your own board reads" ON public.admin_board_reads;
CREATE POLICY "Move your own board reads" ON public.admin_board_reads FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
