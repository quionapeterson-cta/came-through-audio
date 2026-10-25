-- Contract Generator, $3.99 per contract on any plan (founder, 2026-10-25). A paid draft becomes one contract the buyer
-- can edit, send for signature and keep, even without Catalog Management. Only the payment webhook (service role) sets
-- paid_purchase_id; signed-in users have no grant on that column, so nobody can mark a contract paid themselves.
-- Additive; existing contracts and their rules are unchanged. Safe to run again.
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS paid_purchase_id uuid;
-- The generated draft (blueprint, filled fields, names; never the user's description), turned into a contract once paid.
ALTER TABLE public.contract_generations ADD COLUMN IF NOT EXISTS draft jsonb;
ALTER TABLE public.contract_generations ADD COLUMN IF NOT EXISTS purchase_id uuid;
ALTER TABLE public.contract_generations ADD COLUMN IF NOT EXISTS contract_id uuid;

-- Adding parties: Catalog Management, or the owner of a paid contract.
DROP POLICY IF EXISTS "Contract parties need Catalog Management" ON public.contract_parties;
CREATE POLICY "Contract parties need Catalog Management" ON public.contract_parties AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_tier(auth.uid(), 'management') OR EXISTS (SELECT 1 FROM public.contracts k WHERE k.id = contract_id AND k.user_id = auth.uid() AND k.paid_purchase_id IS NOT NULL));

-- Sending for signature: Catalog Management, or a paid contract.
CREATE OR REPLACE FUNCTION public.send_contract(_contract_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k record; n int; bad int; h text;
BEGIN
  SELECT * INTO k FROM contracts WHERE id = _contract_id AND user_id = auth.uid();
  IF k IS NULL THEN RAISE EXCEPTION 'Contract not found.'; END IF;
  IF NOT public.has_tier(auth.uid(), 'management') AND k.paid_purchase_id IS NULL THEN RAISE EXCEPTION 'Sending contracts for signature is included with Catalog Management, or with a $3.99 generated contract.'; END IF;
  IF k.status <> 'draft' THEN RETURN k.body_hash; END IF;
  IF char_length(trim(k.body)) = 0 THEN RAISE EXCEPTION 'Add the contract text first.'; END IF;
  SELECT count(*), count(*) FILTER (WHERE trim(legal_name) = '' OR email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') INTO n, bad FROM contract_parties WHERE contract_id = k.id;
  IF n < 2 THEN RAISE EXCEPTION 'Add at least two parties.'; END IF;
  IF bad > 0 THEN RAISE EXCEPTION 'Every party needs a legal name and a valid email.'; END IF;
  h := encode(extensions.digest(k.body, 'sha256'), 'hex');
  UPDATE contracts SET status = 'sent', body_hash = h, sent_at = now(), updated_at = now() WHERE id = k.id;
  RETURN h;
END $$;
REVOKE ALL ON FUNCTION public.send_contract(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_contract(uuid) TO authenticated;
