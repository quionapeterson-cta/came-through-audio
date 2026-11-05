-- Offboarding (founder, 2026-11-05): an employee who leaves inside their first 90 days loses account access the day it
-- happens and has 30 days to download their assets before the account is deleted.
--
-- This table is the record and the schedule. Nothing is deleted from the app by a trigger: the daily job reads only rows
-- that are due, still uncancelled, and whose person no longer holds a staff role, then deletes the account once and
-- writes deleted_at. A super admin can cancel a row (rehire, or a leaver who was recorded by mistake).

create table if not exists public.staff_departures (
  id uuid primary key default gen_random_uuid(),
  -- Kept through the deletion (set null) so the record survives it; the email stays as the audit trail.
  user_id uuid references auth.users(id) on delete set null,
  member_email text not null,
  first_day timestamptz not null,
  last_day timestamptz not null,
  within_probation boolean not null,
  access_ended_at timestamptz not null,
  delete_on timestamptz,
  reminders text[] not null default '{}',
  cancelled_at timestamptz,
  deleted_at timestamptz,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.staff_departures enable row level security;

-- The leaver can see their own row; writing is server-only, behind the staff-manager check.
drop policy if exists "Read your own departure" on public.staff_departures;
create policy "Read your own departure" on public.staff_departures for select to authenticated
  using (user_id = auth.uid());

revoke all on public.staff_departures from anon, authenticated;
grant select on public.staff_departures to authenticated;
grant all on public.staff_departures to service_role;

create index if not exists staff_departures_due on public.staff_departures (delete_on) where deleted_at is null and cancelled_at is null;
create index if not exists staff_departures_user on public.staff_departures (user_id);

-- Someone whose departure is recorded and not cancelled is off the team for access purposes, even if a role row was left
-- behind by mistake. user_tier uses this so a stale role can never keep a management account open after a leaver.
create or replace function public.staff_offboarded(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff_departures d
    where d.user_id = _uid
      and d.cancelled_at is null
      and d.deleted_at is null
      and d.access_ended_at <= now()
  )
$$;
revoke all on function public.staff_offboarded(uuid) from public, anon;
grant execute on function public.staff_offboarded(uuid) to authenticated, service_role;
