-- Personal Admin calendar feed (founder spec, 2026-11-19).
--
-- Each staff member's feed URL carries one secret token. The token is generated in the browser, so this table never
-- sees a server secret, and the row belongs to exactly the person who made it. The public feed route reads with the
-- service role (a calendar app cannot sign in), which is why the token itself is the credential: it is 48 lowercase hex
-- characters, it only ever grants a read of what that person can already see, and "New link" replaces it in place.
--
-- RLS keeps a member's link their own: only the owner reads, creates, replaces or removes their row. The service role
-- is what the feed route uses to resolve a token back to its owner and stamp last_read_at.

CREATE TABLE IF NOT EXISTS public.calendar_feed_tokens (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE CHECK (token ~ '^[a-f0-9]{48}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz
);

ALTER TABLE public.calendar_feed_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read your own calendar feed link" ON public.calendar_feed_tokens;
CREATE POLICY "Read your own calendar feed link" ON public.calendar_feed_tokens FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Create your own calendar feed link" ON public.calendar_feed_tokens;
CREATE POLICY "Create your own calendar feed link" ON public.calendar_feed_tokens FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Replace your own calendar feed link" ON public.calendar_feed_tokens;
CREATE POLICY "Replace your own calendar feed link" ON public.calendar_feed_tokens FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Remove your own calendar feed link" ON public.calendar_feed_tokens;
CREATE POLICY "Remove your own calendar feed link" ON public.calendar_feed_tokens FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_feed_tokens TO authenticated;
GRANT ALL ON public.calendar_feed_tokens TO service_role;

COMMENT ON TABLE public.calendar_feed_tokens IS
  'One secret token per staff member for the personal Admin calendar .ics feed. The token is the credential for a read-only feed of what that person can already see.';
