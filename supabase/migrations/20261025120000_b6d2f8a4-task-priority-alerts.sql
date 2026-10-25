-- Task Bank: importance, deadline, owner and completion, for Admin sign-in alerts and celebrations
-- (PLAN-master-notes Phase 4, approved 2026-10-25). Additive: existing tasks become Normal with no deadline or owner.
ALTER TABLE public.department_tasks ADD COLUMN IF NOT EXISTS importance text NOT NULL DEFAULT 'normal';
ALTER TABLE public.department_tasks DROP CONSTRAINT IF EXISTS department_tasks_importance_check;
ALTER TABLE public.department_tasks ADD CONSTRAINT department_tasks_importance_check CHECK (importance IN ('top', 'high', 'normal', 'low'));
ALTER TABLE public.department_tasks ADD COLUMN IF NOT EXISTS due_at timestamptz;
ALTER TABLE public.department_tasks ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.department_tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.department_tasks ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
-- Which deadline emails went out ('24h', '1h'), so the hourly reminder job sends each once.
ALTER TABLE public.department_tasks ADD COLUMN IF NOT EXISTS reminders_sent text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS department_tasks_due ON public.department_tasks (importance, due_at) WHERE completed_at IS NULL;

-- Completion is recorded by the database when a task moves to Done (and cleared if it's reopened), so the
-- "last completed task" celebration always has the right person and time.
CREATE OR REPLACE FUNCTION public.department_task_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'done' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'done') THEN
    NEW.completed_at := now();
    NEW.completed_by := auth.uid();
  ELSIF NEW.status <> 'done' THEN
    NEW.completed_at := NULL;
    NEW.completed_by := NULL;
  END IF;
  -- A new deadline gets fresh reminders.
  IF TG_OP = 'UPDATE' AND NEW.due_at IS DISTINCT FROM OLD.due_at THEN NEW.reminders_sent := '{}'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.department_task_completion() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS department_task_completion ON public.department_tasks;
CREATE TRIGGER department_task_completion BEFORE INSERT OR UPDATE ON public.department_tasks
  FOR EACH ROW EXECUTE FUNCTION public.department_task_completion();
