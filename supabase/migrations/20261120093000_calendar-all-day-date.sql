-- All-day entries keep the date that was picked (founder, 2026-11-20).
--
-- `starts_at` is an instant. The browser saved local midnight, which is 22:00Z the day before for a member in UTC+2, so
-- another member reading the same all-day entry in a different time zone saw it on the wrong day. An all-day entry is a
-- calendar date, not an instant, so the date that was picked is stored here as a plain date. The calendar screen and the
-- .ics feed both read this column for all-day entries; timed entries leave it NULL and keep using `starts_at`.
--
-- Additive and safe to run again. An older client that cannot send `all_day_on` still saves (the constraint only stops a
-- timed entry carrying a date), and the screens fall back to the old reading until that entry is saved once more.

ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS all_day_on date;

-- Rows written before this column are local midnight of the day that was picked, so the UTC clock says which side of
-- midnight they fell on: 10:00Z or later can only be the previous evening of a positive offset (UTC+1 · 23:00Z, UTC+14 ·
-- 10:00Z), while anything earlier is midnight on the same UTC date for zero or a negative offset. That recovers the
-- picked day without knowing the zone each member was in; a row with no time (never written by the screen) is left as
-- the UTC date.
UPDATE public.calendar_events
SET all_day_on = (starts_at AT TIME ZONE 'UTC')::date
  + CASE WHEN (starts_at AT TIME ZONE 'UTC')::time >= TIME '10:00' THEN 1 ELSE 0 END
WHERE all_day AND all_day_on IS NULL;

ALTER TABLE public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_all_day_on_only;
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_all_day_on_only
  CHECK (all_day OR all_day_on IS NULL);

COMMENT ON COLUMN public.calendar_events.all_day_on IS
  'The calendar date a member picked for an all-day entry. Every viewer reads this date, so the entry lands on the same day in any time zone. NULL for timed entries.';
