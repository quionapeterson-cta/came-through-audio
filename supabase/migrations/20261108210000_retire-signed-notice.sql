-- The 30-day signed paperwork window is retired (founder, 2026-11-08): everything that is not storage stays with a Free
-- account for as long as it exists, and only deleting the account itself removes its paperwork. Proof videos are storage
-- and are cleared on the earlier date with the masters. The three columns the window needed go with it.
DROP INDEX IF EXISTS public.account_inactivity_signed_delete_on_idx;

ALTER TABLE public.account_inactivity
  DROP COLUMN IF EXISTS cleared_at,
  DROP COLUMN IF EXISTS signed_delete_on,
  DROP COLUMN IF EXISTS signed_reminders;
