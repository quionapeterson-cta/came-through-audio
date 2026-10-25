-- Admin calendar (Phase 4 item 8, approved 2026-10-25), part 1 of 2: the new Project Manager staff role. A new role
-- value has to be saved on its own before anything uses it, so run this file first, then 20261025210100.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'project_manager';
