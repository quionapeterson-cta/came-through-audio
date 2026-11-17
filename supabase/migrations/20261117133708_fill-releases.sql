-- Releases typed by hand in the fill dialog, kept with the account (founder, 2026-11-16): a title the member names once is offered
-- back on every device, not just the browser that typed it. One row per account, kind and title; the account comes from auth.uid(),
-- so no client can write a row for someone else. Adds a table, changes no existing data.
CREATE TABLE IF NOT EXISTS public.fill_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('Single', 'EP', 'Album', 'Instrumental', 'Unreleased')),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One entry per release, however the title was capitalised or spaced the second time.
CREATE UNIQUE INDEX IF NOT EXISTS fill_releases_one_entry
  ON public.fill_releases (user_id, kind, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS fill_releases_recent ON public.fill_releases (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fill_releases TO authenticated;
GRANT ALL ON public.fill_releases TO service_role;

ALTER TABLE public.fill_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own fill releases" ON public.fill_releases;
CREATE POLICY "Users read their own fill releases" ON public.fill_releases FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users add their own fill releases" ON public.fill_releases;
CREATE POLICY "Users add their own fill releases" ON public.fill_releases FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users rename their own fill releases" ON public.fill_releases;
CREATE POLICY "Users rename their own fill releases" ON public.fill_releases FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users forget their own fill releases" ON public.fill_releases;
CREATE POLICY "Users forget their own fill releases" ON public.fill_releases FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
