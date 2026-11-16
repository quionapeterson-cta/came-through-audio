-- Custom templates in Company Contracts, part 1 of 2 (founder, 2026-11-16).
--
-- A saved template can now carry a one-line card description and a switch that shows it in Admin → Company Contracts.
-- Additive only: both columns are nullable/defaulted, so every template saved before today keeps its exact behaviour and
-- shows nothing new until a lead turns it on. The approval state machine for contracts is a separate migration.

ALTER TABLE public.pdf_templates
  ADD COLUMN IF NOT EXISTS show_in_contracts boolean NOT NULL DEFAULT false;

ALTER TABLE public.pdf_templates
  ADD COLUMN IF NOT EXISTS contract_description text;

ALTER TABLE public.pdf_templates
  DROP CONSTRAINT IF EXISTS pdf_templates_contract_description;
ALTER TABLE public.pdf_templates
  ADD CONSTRAINT pdf_templates_contract_description
  CHECK (contract_description IS NULL OR char_length(contract_description) <= 200);

-- Company Contracts reads only the toggled rows, so the partial index keeps that read tiny as the library grows.
CREATE INDEX IF NOT EXISTS pdf_templates_in_contracts_idx
  ON public.pdf_templates (updated_at DESC)
  WHERE show_in_contracts;
