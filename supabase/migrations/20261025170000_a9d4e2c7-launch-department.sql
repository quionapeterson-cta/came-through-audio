-- Pre-launch milestones (Phase 4 item 1, approved 2026-10-25): Task Bank tasks in a "launch" department. No staff are
-- ever placed in it (it stays out of user_roles), so only super admins, who see every department, see these tasks.
-- Only the task bank's allowed departments change. Safe to run more than once.
ALTER TABLE public.department_tasks DROP CONSTRAINT IF EXISTS department_tasks_department_check;
ALTER TABLE public.department_tasks ADD CONSTRAINT department_tasks_department_check CHECK (
  department IN ('registration','royalty_accounts','finance','branding','marketing_sales','support','hr','ai','marketing','software','security','launch')
);
