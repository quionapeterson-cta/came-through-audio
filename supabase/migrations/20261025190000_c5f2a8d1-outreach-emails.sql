-- Company outreach emails (Phase 4 item 5, approved 2026-10-25): a log of each email sent from Admin → Company Contracts
-- → Outreach, for follow-ups and the daily limit. Written and read only by the server for super admins (no grant to
-- signed-in users). Additive and safe to run again.
CREATE TABLE IF NOT EXISTS public.outreach_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('cold', 'followup', 'demo')),
  to_email text NOT NULL CHECK (char_length(to_email) <= 320),
  to_name text NOT NULL DEFAULT '' CHECK (char_length(to_name) <= 200),
  company text NOT NULL DEFAULT '' CHECK (char_length(company) <= 200),
  subject text NOT NULL CHECK (char_length(subject) <= 300),
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outreach_emails_sent_at ON public.outreach_emails (sent_at DESC);
ALTER TABLE public.outreach_emails ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.outreach_emails TO service_role;
