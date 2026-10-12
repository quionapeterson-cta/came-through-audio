ALTER TABLE public.split_sheets
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'Writer',
  ADD COLUMN IF NOT EXISTS signature_name text;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.split_sheets TO authenticated;
GRANT ALL ON public.split_sheets TO service_role;
ALTER TABLE public.split_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage split sheets for own catalog" ON public.split_sheets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.catalogs c WHERE c.id = split_sheets.catalog_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.catalogs c WHERE c.id = split_sheets.catalog_id AND c.user_id = auth.uid()));