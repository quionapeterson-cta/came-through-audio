-- Billing console (founder, 2026-11-05): Finance and super admins issue refunds and cancel plans from Admin → Billing,
-- so routine billing never needs a Stripe dashboard login. Every action is logged. Additive.
CREATE TABLE IF NOT EXISTS public.billing_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid NOT NULL,
  actor_email text NOT NULL DEFAULT '',
  target_user_id uuid,
  target_email text NOT NULL DEFAULT '',
  action text NOT NULL,
  target text NOT NULL DEFAULT '',
  stripe_object text,
  amount_cents integer,
  currency text,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'done',
  error text,
  environment text NOT NULL DEFAULT 'sandbox',
  request_id text,
  CONSTRAINT billing_actions_action CHECK (action IN ('refund', 'cancel_plan', 'resume_plan')),
  CONSTRAINT billing_actions_status CHECK (status IN ('done', 'failed')),
  CONSTRAINT billing_actions_amount CHECK (amount_cents IS NULL OR amount_cents > 0)
);

CREATE INDEX IF NOT EXISTS billing_actions_created_idx ON public.billing_actions (created_at DESC);

GRANT SELECT ON public.billing_actions TO authenticated;
GRANT ALL ON public.billing_actions TO service_role;

ALTER TABLE public.billing_actions ENABLE ROW LEVEL SECURITY;

-- Who may read the log: the Finance team and super admins. Writes only ever come from the server.
CREATE OR REPLACE FUNCTION public.can_see_billing(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND (role = 'super_admin' OR 'finance' = ANY (departments))
  );
$$;
REVOKE ALL ON FUNCTION public.can_see_billing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_billing(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Billing team reads the log" ON public.billing_actions;
CREATE POLICY "Billing team reads the log" ON public.billing_actions FOR SELECT TO authenticated
  USING (public.can_see_billing(auth.uid()));

-- Email → account, for the console's search box. Service role only: a browser can never call it.
CREATE OR REPLACE FUNCTION public.billing_find_user(_email text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(btrim(_email)) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.billing_find_user(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_find_user(text) TO service_role;
