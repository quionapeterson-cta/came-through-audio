-- Working On (founder, 2026-11-06): each member's ticks on a blueprint checklist and the blueprints and contracts
-- they saved to their Working On folder. A member reads and writes only their own rows.

create table if not exists public.workbench_items (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('blueprint', 'contract')),
  -- A blueprint's guide id (src/lib/guides.ts) or a contract's uuid, as text.
  item_id text not null,
  checked text[] not null default '{}',
  pinned boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, item_id)
);

alter table public.workbench_items enable row level security;

drop policy if exists "Read your own Working On" on public.workbench_items;
create policy "Read your own Working On" on public.workbench_items for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Add to your own Working On" on public.workbench_items;
create policy "Add to your own Working On" on public.workbench_items for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Update your own Working On" on public.workbench_items;
create policy "Update your own Working On" on public.workbench_items for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Remove from your own Working On" on public.workbench_items;
create policy "Remove from your own Working On" on public.workbench_items for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.workbench_items from anon;
grant select, insert, update, delete on public.workbench_items to authenticated;
grant all on public.workbench_items to service_role;
