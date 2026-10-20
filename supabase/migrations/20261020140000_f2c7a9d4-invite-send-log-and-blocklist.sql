-- Split-invite email limits. Two new tables, written only by the server (service role). No existing tables or rows change.
--
-- 1. invite_sends: one row per invite email actually sent. The send limits count these rows, so re-sending
--    the same split row can't get around them (the old count used split_sheets.invited_at, which re-sends overwrite).
-- 2. invite_blocklist: emails whose owners clicked "Don't send me invites" in an invite's footer.
-- Staff can read both and remove a blocklist entry on request; nobody else can see or edit them.

CREATE TABLE IF NOT EXISTS public.invite_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  split_row_id uuid,
  recipient_email text NOT NULL CHECK (recipient_email = lower(recipient_email)),
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invite_sends_sender ON public.invite_sends (sender_id, sent_at);
CREATE INDEX IF NOT EXISTS invite_sends_row ON public.invite_sends (split_row_id, sent_at);
CREATE INDEX IF NOT EXISTS invite_sends_recipient ON public.invite_sends (recipient_email, sent_at);
GRANT ALL ON public.invite_sends TO service_role;
GRANT SELECT ON public.invite_sends TO authenticated;
ALTER TABLE public.invite_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read invite sends" ON public.invite_sends;
CREATE POLICY "Staff read invite sends" ON public.invite_sends FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.invite_blocklist (
  email text PRIMARY KEY CHECK (email = lower(email)),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.invite_blocklist TO service_role;
GRANT SELECT, DELETE ON public.invite_blocklist TO authenticated;
ALTER TABLE public.invite_blocklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read the invite blocklist" ON public.invite_blocklist;
CREATE POLICY "Staff read the invite blocklist" ON public.invite_blocklist FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff remove invite blocklist entries" ON public.invite_blocklist;
CREATE POLICY "Staff remove invite blocklist entries" ON public.invite_blocklist FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));
