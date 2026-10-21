-- Company contracts: Came Through Audio, LLC's own agreements (testimonial releases first), sent from Admin.
-- Adds one column, default false, so every existing contract stays a regular customer contract.
-- Same signing engine as customer contracts (frozen text, SHA-256, signer logs in with the invited email).
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS is_company boolean NOT NULL DEFAULT false;

-- Only super admins can create company contracts. The flag can be set at insert only, never changed after.
GRANT INSERT (is_company) ON public.contracts TO authenticated;
DROP POLICY IF EXISTS "Only super admins create company contracts" ON public.contracts;
CREATE POLICY "Only super admins create company contracts" ON public.contracts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT is_company OR public.has_role(auth.uid(), 'super_admin'));

