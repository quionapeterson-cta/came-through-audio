-- Contributor Library remembers a writer's usual role and split (founder, 2026-10-27), so a saved writer fills in a
-- song in one go. Adds two optional columns; every existing row is kept exactly as it is.
ALTER TABLE public.contributors ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE public.contributors ADD COLUMN IF NOT EXISTS share text;
