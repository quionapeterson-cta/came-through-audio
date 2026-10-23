-- Came Through Audio: the three migrations db-check.sql found MISSING on 2026-10-23, combined and safe to run more
-- than once. Copy the WHOLE file into the Supabase SQL editor and Run, then run db-check.sql again.

-- 1) 20261014012445: AI Protection proof videos (storage rules)
DROP POLICY IF EXISTS "Users read own proof videos" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own proof videos" ON storage.objects;
DROP POLICY IF EXISTS "Users update own proof videos" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own proof videos" ON storage.objects;
CREATE POLICY "Users read own proof videos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'proof-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users upload own proof videos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'proof-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own proof videos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'proof-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own proof videos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'proof-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
-- The private proof-videos folder itself, if it doesn't exist yet (an existing one is left as it is).
INSERT INTO storage.buckets (id, name, public) VALUES ('proof-videos', 'proof-videos', false) ON CONFLICT (id) DO NOTHING;

-- 2) 20261019130100: public share cards
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('share-cards', 'share-cards', true, 5242880, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/png'];
DROP POLICY IF EXISTS "Users upload own share cards" ON storage.objects;
CREATE POLICY "Users upload own share cards" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'share-cards' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users replace own share cards" ON storage.objects;
CREATE POLICY "Users replace own share cards" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'share-cards' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users delete own share cards" ON storage.objects;
CREATE POLICY "Users delete own share cards" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'share-cards' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 3) 20261019140000: Catalog Plus lock + free-trial fraud log
DROP POLICY IF EXISTS "Catalog songs need Catalog Plus" ON public.catalogs;
CREATE POLICY "Catalog songs need Catalog Plus" ON public.catalogs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_tier(auth.uid(), 'plus'));
DROP POLICY IF EXISTS "Catalog files need Catalog Plus" ON storage.objects;
CREATE POLICY "Catalog files need Catalog Plus" ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'catalog-files' OR public.has_tier(auth.uid(), 'plus'));
CREATE TABLE IF NOT EXISTS public.trial_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  inviter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('split_sheet', 'contract')),
  ip_hash text,
  email_domain text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trial_grants_inviter ON public.trial_grants (inviter_id, created_at);
CREATE INDEX IF NOT EXISTS trial_grants_ip ON public.trial_grants (ip_hash, created_at);
ALTER TABLE public.trial_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trial_grants FROM anon, authenticated;
