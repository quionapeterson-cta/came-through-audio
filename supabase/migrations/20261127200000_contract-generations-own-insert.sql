-- A signed-in person saves their own contract draft (founder, 2026-11-27): the blueprint matcher keeps the draft so the
-- $3.99 checkout can turn it into a contract. The site writes that row with the service-role client where the host holds
-- SUPABASE_SERVICE_ROLE_KEY, and with the person's own session everywhere else (Vercel), so the person needs to be able
-- to insert it. Until now only reading their own rows was allowed, which is why matching failed on a host without the key.
--
-- Only the four columns the generator fills are granted: a draft row can't arrive with a purchase, a contract or a
-- created_at already on it, and nothing already written can be changed through this policy.
ALTER TABLE public.contract_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users save own contract drafts" ON public.contract_generations;
CREATE POLICY "Users save own contract drafts" ON public.contract_generations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

GRANT INSERT (user_id, blueprint_id, company, draft) ON public.contract_generations TO authenticated;
