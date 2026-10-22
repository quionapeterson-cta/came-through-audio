-- Fixes "permission denied for table contracts": the contracts tables were created without table grants, and this
-- project doesn't grant new tables to signed-in users automatically. Adds the grants only; no data is changed.
-- Row level security still limits every user to their own contracts, and inserts/updates stay limited to the
-- editable columns granted in 20261019120000 (status, hashes and signatures only change through the functions).
GRANT SELECT, DELETE ON public.contracts, public.contract_parties TO authenticated;
GRANT INSERT (blueprint, title, catalog_id, fields, body) ON public.contracts TO authenticated;
GRANT UPDATE (blueprint, title, catalog_id, fields, body, updated_at) ON public.contracts TO authenticated;
GRANT INSERT (contract_id, role, legal_name, email, is_owner, position) ON public.contract_parties TO authenticated;
GRANT UPDATE (role, legal_name, email, position, invited_at) ON public.contract_parties TO authenticated;
GRANT ALL ON public.contracts, public.contract_parties TO service_role;

-- Company contracts (20261022170000): only super admins may set is_company, enforced by its restrictive policy.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'is_company') THEN
    GRANT INSERT (is_company) ON public.contracts TO authenticated;
  END IF;
END $$;
