-- Royalty Health Report history (PLAN-royalty-health-report §2): each checkup's summary, so the next report can say
-- what healed and what's new, and Past reports can list them. Summaries hold scores, organ states and finding counts
-- only (no song titles or writer details). Owner-only; adds a table, changes no existing data.
CREATE TABLE IF NOT EXISTS public.royalty_health_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  score smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
  -- CheckupSummary in src/lib/royalty-checkup.ts.
  summary jsonb NOT NULL CHECK (pg_column_size(summary) < 20000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS royalty_health_reports_user_created ON public.royalty_health_reports (user_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.royalty_health_reports TO authenticated;
GRANT ALL ON public.royalty_health_reports TO service_role;
ALTER TABLE public.royalty_health_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own health reports" ON public.royalty_health_reports;
CREATE POLICY "Users manage own health reports" ON public.royalty_health_reports FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Keep the latest 100 per account.
CREATE OR REPLACE FUNCTION public.royalty_health_reports_trim()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.royalty_health_reports WHERE user_id = NEW.user_id AND id IN (
    SELECT id FROM public.royalty_health_reports WHERE user_id = NEW.user_id ORDER BY created_at DESC OFFSET 100);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.royalty_health_reports_trim() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS royalty_health_reports_trim ON public.royalty_health_reports;
CREATE TRIGGER royalty_health_reports_trim AFTER INSERT ON public.royalty_health_reports
  FOR EACH ROW EXECUTE FUNCTION public.royalty_health_reports_trim();
