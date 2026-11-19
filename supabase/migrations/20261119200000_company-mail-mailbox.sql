-- Every company letter records the mailbox it went out from, beside who sent it, when and to whom (founder, 2026-11-19).
--
-- The sending rule is a super admin's or the owning department lead's, and the sent log is read by department. The address
-- was already stored in from_email; this keeps the mailbox key itself, so the department filter and the audit trail never
-- have to parse a header. Additive and safe to run more than once.

ALTER TABLE public.outreach_emails ADD COLUMN IF NOT EXISTS mailbox text NOT NULL DEFAULT '';

-- Older letters: the mailbox is the local part of the address in from_email ("Came Through Audio <support@…>").
UPDATE public.outreach_emails
SET mailbox = substring(from_email from '<([a-z0-9._-]+)@')
WHERE kind = 'company'
  AND mailbox = ''
  AND substring(from_email from '<([a-z0-9._-]+)@') IN (
    'admin', 'contracts', 'marketing', 'partners', 'info', 'collaborate',
    'support', 'legal', 'billing', 'partnerships', 'registrations'
  );

ALTER TABLE public.outreach_emails DROP CONSTRAINT IF EXISTS outreach_emails_mailbox_check;
ALTER TABLE public.outreach_emails ADD CONSTRAINT outreach_emails_mailbox_check
  CHECK (mailbox = '' OR mailbox IN (
    'admin', 'contracts', 'marketing', 'partners', 'info', 'collaborate',
    'support', 'legal', 'billing', 'partnerships', 'registrations'
  ));

-- The department-scoped history reads by mailbox, and the per-sender cap counts by sender.
CREATE INDEX IF NOT EXISTS outreach_emails_mailbox_idx ON public.outreach_emails (mailbox, sent_at DESC);
CREATE INDEX IF NOT EXISTS outreach_emails_sent_by_idx ON public.outreach_emails (sent_by, sent_at DESC);
