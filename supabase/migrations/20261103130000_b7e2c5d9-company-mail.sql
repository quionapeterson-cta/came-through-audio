-- Company email (2026-11-03): Admin → Company Contracts → Email sends one-off correspondence from a company mailbox
-- (admin@, info@, support@ …). A letter is logged in outreach_emails so the daily cap and the "did I already answer this
-- thread?" check work the same way, which means the kind check has to admit "company" and the row has to record which
-- mailbox it came from. Additive and safe to run again.
ALTER TABLE public.outreach_emails DROP CONSTRAINT IF EXISTS outreach_emails_kind_check;
ALTER TABLE public.outreach_emails
  ADD CONSTRAINT outreach_emails_kind_check CHECK (kind IN ('cold', 'followup', 'demo', 'company'));
ALTER TABLE public.outreach_emails
  ADD COLUMN IF NOT EXISTS from_email text NOT NULL DEFAULT '' CHECK (char_length(from_email) <= 200);
