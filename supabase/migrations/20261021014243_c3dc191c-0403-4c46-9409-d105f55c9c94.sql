alter table public.subscriptions alter column paddle_subscription_id drop not null;
alter table public.subscriptions alter column paddle_customer_id drop not null;
alter table public.subscriptions add column if not exists stripe_subscription_id text;
alter table public.subscriptions add column if not exists stripe_customer_id text;
create unique index if not exists idx_subscriptions_stripe_id on public.subscriptions(stripe_subscription_id);

alter table public.purchases alter column paddle_transaction_id drop not null;
alter table public.purchases add column if not exists stripe_session_id text;
create unique index if not exists idx_purchases_stripe_session on public.purchases(stripe_session_id);