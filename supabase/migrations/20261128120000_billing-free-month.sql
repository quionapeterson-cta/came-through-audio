-- The free month is Support's to give (founder, 2026-11-28).
--
-- "Need more time" in the app is the $1.99 pause now, so the free month has no member-facing button. Staff give it from
-- Admin → Billing, and that grant is written to `billing_actions` with `action = 'free_month'` so the log names who gave
-- it, to whom and until when. The grant itself runs the same code path the old button used, so the once-every-12-months
-- record and the "your plan is extended" email still apply.
--
-- Additive, idempotent, and the existing actions keep their exact meaning.

ALTER TABLE public.billing_actions DROP CONSTRAINT IF EXISTS billing_actions_action;
ALTER TABLE public.billing_actions ADD CONSTRAINT billing_actions_action
  CHECK (action IN ('refund', 'cancel_plan', 'resume_plan', 'pause_alert', 'free_month'));

COMMENT ON COLUMN public.billing_actions.action IS
  'refund, cancel_plan, resume_plan, pause_alert (Stripe refused to stop a pause''s Vault subscription; the pause was left open), or free_month (staff gave 30 days free from Admin → Billing).';
