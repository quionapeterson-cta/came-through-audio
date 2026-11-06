-- Notes and due dates per checklist item (founder, 2026-11-06): a blueprint becomes a small project plan. The column is
-- keyed by the checklist item's own wording, so a tick that no longer matches the guide is simply not read.
-- Nothing existing is rewritten.

alter table public.workbench_items
  add column if not exists item_meta jsonb not null default '{}'::jsonb;

comment on column public.workbench_items.item_meta is
  'Per checklist item: {"<item>": {"note": "…", "due": "YYYY-MM-DD"}}. Empty for rows that only carry ticks.';

-- The table already has its own RLS policies; no new grants are needed for a column on an existing table.
