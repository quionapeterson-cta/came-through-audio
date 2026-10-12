create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  paddle_subscription_id text not null unique,
  paddle_customer_id text not null,
  product_id text not null,
  price_id text not null,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  environment text not null default 'sandbox',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_subscriptions_user_id on public.subscriptions(user_id);
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;
create policy "Users can view own subscription" on public.subscriptions for select to authenticated using (auth.uid() = user_id);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  paddle_transaction_id text not null unique,
  kind text not null,
  price_ids text[] not null default '{}',
  details jsonb not null default '{}'::jsonb,
  environment text not null default 'sandbox',
  created_at timestamptz default now()
);
create index idx_purchases_user_id on public.purchases(user_id);
grant select on public.purchases to authenticated;
grant all on public.purchases to service_role;
alter table public.purchases enable row level security;
create policy "Users can view own purchases" on public.purchases for select to authenticated using (auth.uid() = user_id);

create table public.expert_gateways (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  purchase_id uuid references public.purchases(id) on delete cascade not null unique,
  signature_name text not null,
  agencies text[] not null default '{}',
  signed_at timestamptz not null default now()
);
grant select, insert on public.expert_gateways to authenticated;
grant all on public.expert_gateways to service_role;
alter table public.expert_gateways enable row level security;
create policy "Users view own gateway" on public.expert_gateways for select to authenticated using (auth.uid() = user_id);
create policy "Users sign own gateway" on public.expert_gateways for insert to authenticated with check (
  auth.uid() = user_id and exists (select 1 from public.purchases p where p.id = purchase_id and p.user_id = auth.uid() and p.kind = 'expert')
);

create or replace function public.has_active_subscription(user_uuid uuid, check_env text default 'live')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid and environment = check_env
    and ((status in ('active','trialing','past_due') and (current_period_end is null or current_period_end > now()))
      or (status = 'canceled' and current_period_end > now()))
  );
$$;