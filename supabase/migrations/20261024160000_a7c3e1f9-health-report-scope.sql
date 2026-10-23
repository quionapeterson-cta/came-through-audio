-- Royalty Health Hub (PLAN-health-hub-reports): a report covers what the user chose to check, a song, a release, the
-- whole catalog or a song outside it, so My reports can say which and "Run it again" can check the same songs.
-- Adds columns only; every saved report is kept and counts as a whole-catalog report.
ALTER TABLE public.royalty_health_reports
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'catalog',
  ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS song_refs text[] NOT NULL DEFAULT '{}';
DO $$ BEGIN
  ALTER TABLE public.royalty_health_reports ADD CONSTRAINT royalty_health_reports_scope_check
    CHECK (scope IN ('catalog', 'release', 'song', 'outside') AND char_length(label) <= 200 AND cardinality(song_refs) <= 2000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
