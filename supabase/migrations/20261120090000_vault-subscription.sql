-- The Vault fee is a monthly subscription (founder, 2026-11-20, replacing the 2026-10-21 one-time charge).
-- Run AFTER 20261024090000 (account pauses). Additive: nothing existing is changed or deleted. Safe to run again.

-- The pause's own $1.99-a-month Stripe subscription, so a retried webhook can never start a second pause or bill twice.
ALTER TABLE public.account_pauses
  ADD COLUMN IF NOT EXISTS vault_subscription_id text;

COMMENT ON COLUMN public.account_pauses.vault_subscription_id IS
  'The recurring monthly $1.99 Vault subscription behind this pause. Cancelled at the pause end, on Resume, or when its card cannot be charged.';

-- One pause per Vault subscription. `purchase_id` stays for the pause rows written before this change.
CREATE UNIQUE INDEX IF NOT EXISTS account_pauses_vault_sub
  ON public.account_pauses (vault_subscription_id)
  WHERE vault_subscription_id IS NOT NULL;

-- One LIVE pause per account: a double click or a second tab cannot hold two at once, even when two different Vault
-- subscriptions were created. A retried webhook is already blocked by the subscription id above; this is the backstop
-- for the race the code loses. (Checked before adding: no account holds two live pauses today.)
CREATE UNIQUE INDEX IF NOT EXISTS account_pauses_one_live
  ON public.account_pauses (user_id, environment)
  WHERE kind = 'pause' AND ended_at IS NULL;
