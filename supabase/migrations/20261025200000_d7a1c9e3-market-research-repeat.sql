-- Market Research team (Phase 4 item 7, approved 2026-10-25): a new "research" department, and Task Bank tasks that
-- repeat. When a repeating task is marked done, the next one is created with the next due date (same title, notes,
-- importance and owner). Additive: existing tasks don't repeat unless someone sets it. Safe to run again.
ALTER TABLE public.department_tasks ADD COLUMN IF NOT EXISTS repeat text;
ALTER TABLE public.department_tasks DROP CONSTRAINT IF EXISTS department_tasks_repeat_check;
ALTER TABLE public.department_tasks ADD CONSTRAINT department_tasks_repeat_check CHECK (repeat IS NULL OR repeat IN ('weekly', 'monthly', 'quarterly'));

ALTER TABLE public.department_tasks DROP CONSTRAINT IF EXISTS department_tasks_department_check;
ALTER TABLE public.department_tasks ADD CONSTRAINT department_tasks_department_check CHECK (
  department IN ('registration','royalty_accounts','finance','branding','marketing_sales','support','hr','ai','marketing','software','security','launch','research')
);
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_departments_valid;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_departments_valid CHECK (
  departments <@ ARRAY['registration','royalty_accounts','finance','branding','marketing_sales','support','hr','ai','marketing','software','security','research']::text[]
);

CREATE OR REPLACE FUNCTION public.department_task_repeat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE step interval; next_due timestamptz;
BEGIN
  IF NEW.repeat IS NULL OR NEW.status <> 'done' OR OLD.status = 'done' THEN RETURN NEW; END IF;
  step := CASE NEW.repeat WHEN 'weekly' THEN interval '7 days' WHEN 'monthly' THEN interval '1 month' ELSE interval '3 months' END;
  next_due := coalesce(NEW.due_at, now()) + step;
  IF next_due < now() THEN next_due := now() + step; END IF;
  INSERT INTO department_tasks (department, title, body, status, importance, due_at, owner_id, repeat, created_by)
  VALUES (NEW.department, NEW.title, NEW.body, 'planned', NEW.importance, next_due, NEW.owner_id, NEW.repeat, NEW.created_by);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.department_task_repeat() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS department_task_repeat ON public.department_tasks;
CREATE TRIGGER department_task_repeat AFTER UPDATE ON public.department_tasks
  FOR EACH ROW EXECUTE FUNCTION public.department_task_repeat();
