-- Employees' work queue (Phase 4 item 10, approved 2026-10-25): what each staff member is working on now, what they
-- paused (with a note on where they left off) and what they finished, across registrations, support tickets and their
-- Task Bank tasks. Each person sees only their own rows. Additive and safe to run again.
CREATE TABLE IF NOT EXISTS public.work_queue (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  item_ref text NOT NULL CHECK (char_length(item_ref) <= 120),
  kind text NOT NULL CHECK (kind IN ('registration', 'ticket', 'task')),
  title text NOT NULL DEFAULT '' CHECK (char_length(title) <= 300),
  state text NOT NULL CHECK (state IN ('working', 'paused', 'done')),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_ref)
);
ALTER TABLE public.work_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff manage their own queue" ON public.work_queue;
CREATE POLICY "Staff manage their own queue" ON public.work_queue FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_queue TO authenticated;
GRANT ALL ON public.work_queue TO service_role;
