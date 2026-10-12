ALTER TABLE public.ai_protection_certificates
  ADD COLUMN IF NOT EXISTS track_title text,
  ADD COLUMN IF NOT EXISTS artist_name text,
  ADD COLUMN IF NOT EXISTS legal_credits jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS isrc text,
  ADD COLUMN IF NOT EXISTS upc text,
  ADD COLUMN IF NOT EXISTS iswc text,
  ADD COLUMN IF NOT EXISTS session_hash text,
  ADD COLUMN IF NOT EXISTS notes_hash text,
  ADD COLUMN IF NOT EXISTS chain_strength text,
  ADD COLUMN IF NOT EXISTS attested boolean NOT NULL DEFAULT false;
ALTER TABLE public.ai_protection_certificates ALTER COLUMN session_video_url SET DEFAULT '';
ALTER TABLE public.ai_protection_certificates ALTER COLUMN notes_proof_url SET DEFAULT '';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_protection_certificates TO authenticated;
GRANT ALL ON public.ai_protection_certificates TO service_role;
ALTER TABLE public.ai_protection_certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own certificates" ON public.ai_protection_certificates;
CREATE POLICY "Users manage own certificates" ON public.ai_protection_certificates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);