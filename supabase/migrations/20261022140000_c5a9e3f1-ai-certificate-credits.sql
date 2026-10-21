-- AI Protection certificates: one per song in each package (Single 1, EP 6, Album 12, Album+ 20), refunded
-- purchases unlock nothing, and a certificate can only point at the issuer's own catalog song.
CREATE OR REPLACE FUNCTION public.can_issue_ai_certificate(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT coalesce(sum(CASE details->>'package' WHEN 'EP' THEN 6 WHEN 'Album' THEN 12 WHEN 'Plus' THEN 20 ELSE 1 END), 0)
            FROM public.purchases WHERE user_id = _user_id AND kind = 'ai' AND NOT (details ? 'refunded_at'))
       > (SELECT count(*) FROM public.ai_protection_certificates WHERE user_id = _user_id);
$$;
REVOKE EXECUTE ON FUNCTION public.can_issue_ai_certificate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_issue_ai_certificate(uuid) TO authenticated;

-- The exact manifest text that was stamped, so the .txt + .ots pair can be downloaded again later.
ALTER TABLE public.ai_protection_certificates ADD COLUMN IF NOT EXISTS manifest text;

DROP POLICY IF EXISTS "Paid users issue own certificates" ON public.ai_protection_certificates;
CREATE POLICY "Paid users issue own certificates" ON public.ai_protection_certificates
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND coalesce(is_verified, false) = false AND public.can_issue_ai_certificate(auth.uid())
    AND (catalog_id IS NULL OR EXISTS (SELECT 1 FROM public.catalogs c WHERE c.id = catalog_id AND c.user_id = auth.uid()))
  );
