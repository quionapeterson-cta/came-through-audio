ALTER TABLE public.split_sheets ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS invited_at timestamptz;

CREATE TABLE public.contributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'Writer',
  email text,
  pro text,
  ipi text,
  publisher text,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contributors TO authenticated;
GRANT ALL ON public.contributors TO service_role;
ALTER TABLE public.contributors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own contributors" ON public.contributors FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);