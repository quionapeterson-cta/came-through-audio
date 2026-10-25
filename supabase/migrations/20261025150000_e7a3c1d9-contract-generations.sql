-- Contract Generator (founder, 2026-10-25): one row per AI draft, so each person gets a daily limit and the shared free
-- Cloudflare allowance lasts. Only the server writes rows; the description itself is never stored. Additive and safe to
-- run again.
CREATE TABLE IF NOT EXISTS public.contract_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blueprint_id text,
  company boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contract_generations_user_day ON public.contract_generations (user_id, created_at);

ALTER TABLE public.contract_generations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own contract drafts log" ON public.contract_generations;
CREATE POLICY "Users read own contract drafts log" ON public.contract_generations FOR SELECT TO authenticated USING (auth.uid() = user_id);
GRANT SELECT ON public.contract_generations TO authenticated;
GRANT ALL ON public.contract_generations TO service_role;
