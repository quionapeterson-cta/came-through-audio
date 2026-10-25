-- Demo account for the homepage photos and the software demo video (founder approved, 2026-10-25).
-- Run once in the Supabase SQL Editor. It confirms demo@camethroughaudio.com (signed up 2026-10-25) and gives it
-- Catalog Management for one year in both payment modes, as a server-written plan row (like launch gifts; no Stripe id,
-- so it never takes a Founding 100 seat). To remove later: delete the user in Authentication → Users.
BEGIN;

UPDATE auth.users SET email_confirmed_at = coalesce(email_confirmed_at, now())
WHERE email = 'demo@camethroughaudio.com';

INSERT INTO public.subscriptions (user_id, paddle_subscription_id, paddle_customer_id, product_id, price_id, status,
  cancel_at_period_end, current_period_start, current_period_end, environment)
SELECT u.id, 'demo_account_' || env, 'granted_by_founder', 'demo_account', 'catalog_management_yearly', 'active',
  true, now(), now() + interval '1 year', env
FROM auth.users u CROSS JOIN (VALUES ('sandbox'), ('live')) AS e(env)
WHERE u.email = 'demo@camethroughaudio.com'
  AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.paddle_subscription_id = 'demo_account_' || e.env);

-- Check: should show the demo account as confirmed with Catalog Management.
SELECT u.email, u.email_confirmed_at IS NOT NULL AS confirmed, public.user_tier(u.id) AS tier
FROM auth.users u WHERE u.email = 'demo@camethroughaudio.com';

COMMIT;
