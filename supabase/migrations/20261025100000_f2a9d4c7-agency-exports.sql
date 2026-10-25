-- When each song was last exported to each agency (PLAN-master-notes 1.1), so My Catalog's export box can offer
-- "Not exported yet" (e.g. just the new album after the rest of the catalog is registered). The user's own data only.
CREATE TABLE IF NOT EXISTS public.agency_exports (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.catalogs(id) ON DELETE CASCADE,
  agency text NOT NULL CHECK (agency IN ('mlc', 'soundexchange', 'pro')),
  exported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (track_id, agency)
);
ALTER TABLE public.agency_exports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own exports" ON public.agency_exports;
CREATE POLICY "Users read own exports" ON public.agency_exports FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users record own exports" ON public.agency_exports;
CREATE POLICY "Users record own exports" ON public.agency_exports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.catalogs c WHERE c.id = track_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users update own exports" ON public.agency_exports;
CREATE POLICY "Users update own exports" ON public.agency_exports FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE ON public.agency_exports TO authenticated;
GRANT ALL ON public.agency_exports TO service_role;
