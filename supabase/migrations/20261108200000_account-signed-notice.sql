-- The signed paperwork window (founder, 2026-11-08). An account that signed in during the two-year notice keeps its
-- account but loses its files and catalog on its date; the signed split sheets, contracts and certificates on it then get
-- one more, shorter window before they go too.
--
-- cleared_at is when the files and catalog came off, signed_delete_on is the second date, and signed_reminders lists the
-- notices already sent for it. Nothing here deletes anything by itself; the daily job does, once.
ALTER TABLE public.account_inactivity
  ADD COLUMN IF NOT EXISTS cleared_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_delete_on timestamptz,
  ADD COLUMN IF NOT EXISTS signed_reminders text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS account_inactivity_signed_delete_on_idx
  ON public.account_inactivity (signed_delete_on) WHERE signed_delete_on IS NOT NULL;
