-- A company agreement can be built from a block template (founder, 2026-11-16). The blocks it was made from are copied
-- onto the contract, so the wording it was sent with is the wording it keeps even if the template is edited later; the
-- template id is kept for the record only, never to re-read the text.
--
-- Blocks are wording, so they freeze with everything else: the trigger that stops a sent agreement being edited has to
-- see them, or a locked document could be re-flowed under the signature.

ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS blocks jsonb;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.pdf_templates(id) ON DELETE SET NULL;

GRANT INSERT (blocks, template_id), UPDATE (blocks) ON public.contracts TO authenticated;

CREATE OR REPLACE FUNCTION public.freeze_sent_contract()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status IN ('draft','changes_requested') THEN RETURN NEW; END IF;
  IF OLD.status = 'pending_approval' AND public.has_role(auth.uid(),'super_admin') THEN RETURN NEW; END IF;
  IF NEW.body IS DISTINCT FROM OLD.body OR NEW.blocks IS DISTINCT FROM OLD.blocks
    OR NEW.fields IS DISTINCT FROM OLD.fields
    OR NEW.title IS DISTINCT FROM OLD.title OR NEW.blueprint IS DISTINCT FROM OLD.blueprint
    OR NEW.catalog_id IS DISTINCT FROM OLD.catalog_id THEN
    RAISE EXCEPTION 'This contract was sent for signature and can no longer be edited.';
  END IF;
  RETURN NEW;
END $$;
