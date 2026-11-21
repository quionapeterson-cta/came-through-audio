-- A refused Vault cancellation is its own alert (founder, 2026-11-21), not a generic failed plan cancel.
--
-- When Stripe refuses to stop a pause's $1.99/month Vault subscription, the pause is deliberately left open so the charge
-- stays visible and retryable. The refusal is written to `billing_actions` with `action = 'pause_alert'`, which the
-- Billing console can label plainly instead of showing "stopped a plan renewing" for something that never happened.
--
-- Additive, idempotent, and the three existing actions keep their exact meaning.

ALTER TABLE public.billing_actions DROP CONSTRAINT IF EXISTS billing_actions_action;
ALTER TABLE public.billing_actions ADD CONSTRAINT billing_actions_action
  CHECK (action IN ('refund', 'cancel_plan', 'resume_plan', 'pause_alert'));

COMMENT ON COLUMN public.billing_actions.action IS
  'refund, cancel_plan, resume_plan, or pause_alert (Stripe refused to stop a pause''s Vault subscription; the pause was left open).';
COMMENT ON COLUMN public.billing_actions.reason IS
  'Why the action was taken. pause_alert rows use pause_vault_cancel_refused.';
