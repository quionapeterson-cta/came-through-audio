-- AI Protection: Singles are bought per song (1–3, saved as details.songs); EP 6, Album 12, Album+ 20 as before.
-- Refunded purchases unlock nothing.
CREATE OR REPLACE FUNCTION public.can_issue_ai_certificate(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT coalesce(sum(CASE details->>'package' WHEN 'EP' THEN 6 WHEN 'Album' THEN 12 WHEN 'Plus' THEN 20
                   ELSE greatest(1, CASE WHEN details->>'songs' ~ '^[0-9]+$' THEN least((details->>'songs')::int, 3) ELSE 1 END) END), 0)
            FROM public.purchases WHERE user_id = _user_id AND kind = 'ai' AND NOT (details ? 'refunded_at'))
       > (SELECT count(*) FROM public.ai_protection_certificates WHERE user_id = _user_id);
$$;
REVOKE EXECUTE ON FUNCTION public.can_issue_ai_certificate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_issue_ai_certificate(uuid) TO authenticated;
