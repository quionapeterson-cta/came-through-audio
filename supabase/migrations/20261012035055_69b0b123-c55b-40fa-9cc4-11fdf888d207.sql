ALTER TABLE public.ai_protection_certificates
  ADD COLUMN IF NOT EXISTS proof_digest text,
  ADD COLUMN IF NOT EXISTS ots_receipt text,
  ADD COLUMN IF NOT EXISTS ots_calendar text,
  ADD COLUMN IF NOT EXISTS blockchain_status text NOT NULL DEFAULT 'none';