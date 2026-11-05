-- The admin hub (founder, 2026-11-05): step checklists a lead can lock, the approval requests those locks produce, the
-- team-wide win feed, and the coordination notices on the Team Board. All writes go through server functions with the
-- service client; RLS stays on as a second line so nothing outside them can read another person's rows.

create table if not exists public.task_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- "task:<uuid>", "ticket:<uuid>" or "reg:<id>": the queue item this step belongs to.
  item_ref text not null,
  title text not null,
  position int not null default 0,
  done_at timestamptz,
  lock_mode text not null default 'open' check (lock_mode in ('open', 'locked', 'approval')),
  created_by uuid references auth.users(id) on delete set null,
  locked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists task_steps_owner on public.task_steps (user_id, item_ref);

create table if not exists public.step_change_requests (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references public.task_steps(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  proposed_title text,
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists step_change_requests_pending on public.step_change_requests (status, created_at desc);

create table if not exists public.staff_wins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_name text not null,
  kind text not null default 'task',
  item_ref text,
  title text not null,
  created_at timestamptz not null default now()
);

create index if not exists staff_wins_recent on public.staff_wins (created_at desc);

create table if not exists public.team_notices (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  department text,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists team_notices_recent on public.team_notices (created_at desc);

alter table public.task_steps enable row level security;
alter table public.step_change_requests enable row level security;
alter table public.staff_wins enable row level security;
alter table public.team_notices enable row level security;

drop policy if exists "Read your own steps" on public.task_steps;
create policy "Read your own steps" on public.task_steps for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Read your own step requests" on public.step_change_requests;
create policy "Read your own step requests" on public.step_change_requests for select to authenticated
  using (requested_by = auth.uid());

drop policy if exists "Staff read the win feed" on public.staff_wins;
create policy "Staff read the win feed" on public.staff_wins for select to authenticated
  using (public.is_staff(auth.uid()));

drop policy if exists "Staff read team notices" on public.team_notices;
create policy "Staff read team notices" on public.team_notices for select to authenticated
  using (public.is_staff(auth.uid()));

revoke all on public.task_steps from anon, authenticated;
revoke all on public.step_change_requests from anon, authenticated;
revoke all on public.staff_wins from anon, authenticated;
revoke all on public.team_notices from anon, authenticated;

grant select on public.task_steps to authenticated;
grant select on public.step_change_requests to authenticated;
grant select on public.staff_wins to authenticated;
grant select on public.team_notices to authenticated;
grant all on public.task_steps to service_role;
grant all on public.step_change_requests to service_role;
grant all on public.staff_wins to service_role;
grant all on public.team_notices to service_role;
