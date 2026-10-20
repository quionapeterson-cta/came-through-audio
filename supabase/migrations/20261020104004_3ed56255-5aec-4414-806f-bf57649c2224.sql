CREATE OR REPLACE FUNCTION public.can_issue_ai_certificate(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*) FROM public.purchases WHERE user_id = _user_id AND kind = 'ai')
       > (SELECT count(*) FROM public.ai_protection_certificates WHERE user_id = _user_id);
$$;
REVOKE EXECUTE ON FUNCTION public.can_issue_ai_certificate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_issue_ai_certificate(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users manage own certificates" ON public.ai_protection_certificates;
CREATE POLICY "Users read own certificates" ON public.ai_protection_certificates
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Paid users issue own certificates" ON public.ai_protection_certificates
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND coalesce(is_verified, false) = false AND public.can_issue_ai_certificate(auth.uid()));
CREATE POLICY "Users delete own certificates" ON public.ai_protection_certificates
  FOR DELETE TO authenticated USING (auth.uid() = user_id);