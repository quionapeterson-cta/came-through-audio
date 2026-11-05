-- Staff plan (founder, 2026-11-05): an employee's own account is Catalog Management while they work here, with the
-- brand kit and the contract generator included. A paying member finishes the year they paid for first; the free grant
-- then begins and is measured from that cycle's start, so nobody is refunded mid-term and nobody loses paid time.
--
-- Two ways in:
--   1. Any account with a staff role (public.is_staff) is management, which is how a staff login works.
--   2. An existing member account a staff member reports is granted the same tier for the same year, so their artist
--      account does not have to be abandoned or paid for twice.

create table if not exists public.staff_plan_grants (
  id uuid primary key default gen_random_uuid(),
  -- The account that gets the plan: the member account the staff member reported.
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Who reported it, so the account holder can see it and a super admin can trace it.
  reported_by uuid references auth.users(id) on delete set null,
  member_email text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'declined')),
  starts_at timestamptz,
  ends_at timestamptz,
  ended_at timestamptz,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.staff_plan_grants enable row level security;

-- The person on the account reads it, and the staff member who reported it reads it. Only the server writes: it checks
-- who is staff and who is a super admin first.
drop policy if exists "Read your own staff plan" on public.staff_plan_grants;
create policy "Read your own staff plan" on public.staff_plan_grants for select to authenticated
  using (user_id = auth.uid() or reported_by = auth.uid());

revoke all on public.staff_plan_grants from anon, authenticated;
grant select on public.staff_plan_grants to authenticated;
grant all on public.staff_plan_grants to service_role;

create index if not exists staff_plan_grants_user on public.staff_plan_grants (user_id);

-- Live grant: approved, not ended, and inside its window.
create or replace function public.staff_plan_active(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff_plan_grants g
    where g.user_id = _uid
      and g.status = 'active'
      and g.ended_at is null
      and g.starts_at is not null and g.ends_at is not null
      and g.starts_at <= now() and g.ends_at > now()
  )
$$;
revoke all on function public.staff_plan_active(uuid) from public, anon;
grant execute on function public.staff_plan_active(uuid) to authenticated, service_role;

-- user_tier: same body as 20261104120000, with the two staff branches added. An employee is management; a grant lifts a
-- reported member account to management while it lasts, and never lowers a plan they already pay for (management is the
-- top tier, so there is nothing to lower).
create or replace function public.user_tier(_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  WITH env AS (
    SELECT content->>'environment' AS e FROM site_settings WHERE id = 'payments' AND content->>'environment' IN ('live', 'sandbox')
  ), tiers AS (
    SELECT array_position(ARRAY['free', 'plus', 'collaborate', 'management'], coalesce((
      SELECT f.granted_tier FROM founding_upgrades f
      WHERE f.user_id = _uid AND f.ended_at IS NULL AND f.paid_tier = public.paid_tier(_uid)
        AND (NOT EXISTS (SELECT 1 FROM env) OR f.environment = (SELECT e FROM env))
      LIMIT 1
    ), public.paid_tier(_uid), 'free')) AS paid_rank,
    array_position(ARRAY['free', 'plus', 'collaborate', 'management'], coalesce((
      SELECT s.tier FROM artist_seats s
      WHERE s.member_user_id = _uid AND s.status IN ('active', 'canceled')
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
        AND (NOT EXISTS (SELECT 1 FROM env) OR s.environment = (SELECT e FROM env))
      ORDER BY array_position(ARRAY['plus', 'collaborate', 'management'], s.tier) DESC
      LIMIT 1
    ), 'free')) AS seat_rank
  )
  SELECT CASE
    WHEN public.has_role(_uid, 'super_admin') THEN 'management'
    WHEN public.is_staff(_uid) THEN 'management'
    WHEN public.staff_plan_active(_uid) THEN 'management'
    WHEN public.is_paused(_uid) THEN 'free'
    ELSE (ARRAY['free', 'plus', 'collaborate', 'management'])[greatest((SELECT paid_rank FROM tiers), (SELECT seat_rank FROM tiers))]
  END
$$;
revoke all on function public.user_tier(uuid) from public, anon;
grant execute on function public.user_tier(uuid) to authenticated, service_role;
