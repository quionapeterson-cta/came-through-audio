-- Beta testing (Phase 4 item 3, approved 2026-10-25): each tester's Worked / Didn't work and notes per checklist item
-- (src/lib/beta.ts). Testers read and write only their own rows; super admins read everyone's through a staff-verified
-- server function. Additive and safe to run again.
CREATE TABLE IF NOT EXISTS public.beta_feedback (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id text NOT NULL CHECK (char_length(item_id) <= 60),
  result text CHECK (result IN ('worked', 'broken')),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Testers read own beta feedback" ON public.beta_feedback;
CREATE POLICY "Testers read own beta feedback" ON public.beta_feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Testers add own beta feedback" ON public.beta_feedback;
CREATE POLICY "Testers add own beta feedback" ON public.beta_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Testers update own beta feedback" ON public.beta_feedback;
CREATE POLICY "Testers update own beta feedback" ON public.beta_feedback FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE ON public.beta_feedback TO authenticated;
GRANT ALL ON public.beta_feedback TO service_role;
