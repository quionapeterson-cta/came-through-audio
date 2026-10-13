DROP POLICY IF EXISTS "Public reads site settings" ON public.site_settings;
CREATE POLICY "Staff read site settings" ON public.site_settings
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));