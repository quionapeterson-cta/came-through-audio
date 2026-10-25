-- One free Catalog & Collaborate trial per email per rolling year (PLAN-master-notes 3.5, approved 2026-10-25).
-- Each grant keeps a salted fingerprint of the normalized email (never the email itself), and the grant now outlives
-- a deleted account (user_id becomes empty instead of the row being deleted), so deleting and re-creating an account
-- doesn't earn a second trial. Additive: existing grants are kept as they are.
ALTER TABLE public.trial_grants ADD COLUMN IF NOT EXISTS email_hash text;
ALTER TABLE public.trial_grants ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.trial_grants DROP CONSTRAINT IF EXISTS trial_grants_user_id_fkey;
ALTER TABLE public.trial_grants ADD CONSTRAINT trial_grants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS trial_grants_email ON public.trial_grants (email_hash, created_at);
