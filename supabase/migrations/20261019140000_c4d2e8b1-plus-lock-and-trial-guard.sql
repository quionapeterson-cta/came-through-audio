-- 1) Embedding and My Catalog start at Catalog Plus. Free accounts use the Quick Check with their own song
--    details, so saving new catalog songs and uploading masters/artwork needs Plus. Existing rows are untouched.
DROP POLICY IF EXISTS "Catalog songs need Catalog Plus" ON public.catalogs;
CREATE POLICY "Catalog songs need Catalog Plus" ON public.catalogs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_tier(auth.uid(), 'plus'));

DROP POLICY IF EXISTS "Catalog files need Catalog Plus" ON storage.objects;
CREATE POLICY "Catalog files need Catalog Plus" ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'catalog-files' OR public.has_tier(auth.uid(), 'plus'));

-- 2) Free-trial fraud guard. Every collaborator trial (from a split sheet or contract invite) is logged here, so
--    the server can cap trials per inviter and per network, and require a paying inviter. Server-only table:
--    RLS on with no policies, so only the service role (server functions) can read or write it.
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
