-- Full Royalty Health Reports for the Front Desk (founder, 2026-11-11): a past report can be viewed and downloaded again
-- from Past Royalty Health Reports, and only there. royalty_health_reports keeps its small summary (scores, organ states,
-- finding counts, no song titles) unchanged; the whole report — findings, affected songs and treatment steps — lives in
-- this separate table, one row per report, owner-only, and goes when its report is deleted. Adds a table, changes no
-- existing data. Reports saved before this table existed have no snapshot and stay summary-only.
CREATE TABLE IF NOT EXISTS public.royalty_health_report_snapshots (
  report_id uuid PRIMARY KEY REFERENCES public.royalty_health_reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Checkup in src/lib/royalty-checkup.ts, plus the artist and country the PDF prints.
  checkup jsonb NOT NULL CHECK (pg_column_size(checkup) < 2000000),
  artist text NOT NULL DEFAULT '' CHECK (char_length(artist) <= 300),
  country text NOT NULL DEFAULT '' CHECK (char_length(country) <= 120),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS royalty_health_report_snapshots_user ON public.royalty_health_report_snapshots (user_id);
GRANT SELECT, INSERT, DELETE ON public.royalty_health_report_snapshots TO authenticated;
GRANT ALL ON public.royalty_health_report_snapshots TO service_role;
ALTER TABLE public.royalty_health_report_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own health report snapshots" ON public.royalty_health_report_snapshots;
-- The snapshot must belong to the caller and hang off one of the caller's own reports.
CREATE POLICY "Users manage own health report snapshots" ON public.royalty_health_report_snapshots FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.royalty_health_reports r WHERE r.id = report_id AND r.user_id = auth.uid()));
