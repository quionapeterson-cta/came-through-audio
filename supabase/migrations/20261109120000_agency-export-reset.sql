-- An agency export can be started over. A member who downloaded the wrong scope (or the wrong file) clears that
-- agency's bookmark, so the songs are offered again instead of being hidden behind "only songs not exported yet".
-- Users delete their own rows only; no one else's export history is reachable, and nothing else changes.
DROP POLICY IF EXISTS "Users clear their own exports" ON public.agency_exports;
CREATE POLICY "Users clear their own exports" ON public.agency_exports FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
GRANT DELETE ON public.agency_exports TO authenticated;
