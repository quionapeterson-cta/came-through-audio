CREATE TABLE IF NOT EXISTS public.repertoire_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.catalogs(id) ON DELETE CASCADE,
  society text NOT NULL CHECK (char_length(society) BETWEEN 1 AND 40),
  status text NOT NULL CHECK (status IN ('found', 'not_listed')),
  source text NOT NULL DEFAULT 'self' CHECK (source IN ('self', 'auto')),
  work_id text CHECK (char_length(work_id) <= 80),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (track_id, society)
);
CREATE INDEX IF NOT EXISTS repertoire_checks_user_id ON public.repertoire_checks (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repertoire_checks TO authenticated;
GRANT ALL ON public.repertoire_checks TO service_role;
ALTER TABLE public.repertoire_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own repertoire checks" ON public.repertoire_checks;
CREATE POLICY "Users manage own repertoire checks" ON public.repertoire_checks FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.catalogs c WHERE c.id = track_id AND c.user_id = auth.uid()));