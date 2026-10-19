-- Song Health Checklist and the artist-name change limit.
--
-- 1. health_songs: songs entered in the Royalty Inspector (free and paid). Owner-only, capped at 500 per account.
-- 2. health_song_status: per-song checklist state for catalog songs and Royalty Inspector songs alike
--    (which list it's in, a "waiting on" note, an optional reminder date, and the steps the user ticked).
-- 3. artist_name_changes + a trigger on profiles.stage_name: unlimited edits for 72 hours after signup (typos),
--    then one change per 7 days and at most 3 changes in any 12 months. artist_name_status() tells the app when
--    the next change is allowed. Nothing existing is deleted or rewritten.

-- 1. Royalty Inspector songs -------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  artist text NOT NULL DEFAULT '' CHECK (char_length(artist) <= 200),
  -- Same shape as catalog metadata (src/lib/metadata.ts), limited to what the Royalty Inspector collects.
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS health_songs_user_id ON public.health_songs (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_songs TO authenticated;
GRANT ALL ON public.health_songs TO service_role;
ALTER TABLE public.health_songs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own health songs" ON public.health_songs;
CREATE POLICY "Users manage own health songs" ON public.health_songs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.health_songs_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND (SELECT count(*) FROM public.health_songs WHERE user_id = NEW.user_id) >= 500 THEN
    RAISE EXCEPTION 'You can save up to 500 songs in the Royalty Inspector. Remove some to add more.';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS health_songs_guard ON public.health_songs;
CREATE TRIGGER health_songs_guard BEFORE INSERT OR UPDATE ON public.health_songs
  FOR EACH ROW EXECUTE FUNCTION public.health_songs_guard();

-- 2. Checklist state ---------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_song_status (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  -- A catalog song's id, or "h:" + a health_songs id.
  song_ref text NOT NULL CHECK (char_length(song_ref) BETWEEN 1 AND 80),
  list text NOT NULL DEFAULT 'active' CHECK (list IN ('active', 'later')),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 300),
  remind_on date,
  -- Steps the user ticked: { "registered:bmi": "2026-10-20T…", "found:mlc": "…" }.
  steps jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, song_ref)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_song_status TO authenticated;
GRANT ALL ON public.health_song_status TO service_role;
ALTER TABLE public.health_song_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own health status" ON public.health_song_status;
CREATE POLICY "Users manage own health status" ON public.health_song_status FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Artist-name change limit ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.artist_name_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_name text,
  new_name text NOT NULL,
  -- Changes inside the 72-hour typo window are logged but don't count toward the limit.
  counted boolean NOT NULL DEFAULT true,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS artist_name_changes_user ON public.artist_name_changes (user_id, changed_at DESC);
GRANT SELECT ON public.artist_name_changes TO authenticated;
GRANT ALL ON public.artist_name_changes TO service_role;
ALTER TABLE public.artist_name_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own artist name changes" ON public.artist_name_changes;
CREATE POLICY "Users read own artist name changes" ON public.artist_name_changes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.norm_artist_name(v text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lower(regexp_replace(btrim(coalesce(v, '')), '\s+', ' ', 'g')) $$;

/** When the account may next change its artist name. */
CREATE OR REPLACE FUNCTION public.artist_name_status(uid uuid DEFAULT auth.uid())
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  grace_until timestamptz;
  last_change timestamptz;
  recent int;
  third timestamptz;
  next_at timestamptz;
BEGIN
  IF uid IS NULL OR (auth.uid() IS NOT NULL AND auth.uid() <> uid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT u.created_at + interval '72 hours' INTO grace_until FROM auth.users u WHERE u.id = uid;
  SELECT max(changed_at) INTO last_change FROM public.artist_name_changes WHERE user_id = uid AND counted;
  SELECT count(*) INTO recent FROM public.artist_name_changes WHERE user_id = uid AND counted AND changed_at > now() - interval '12 months';
  SELECT changed_at INTO third FROM public.artist_name_changes WHERE user_id = uid AND counted AND changed_at > now() - interval '12 months'
    ORDER BY changed_at DESC OFFSET 2 LIMIT 1;
  next_at := greatest(last_change + interval '7 days', CASE WHEN recent >= 3 THEN third + interval '12 months' END);
  IF grace_until > now() OR next_at <= now() THEN next_at := NULL; END IF;
  RETURN jsonb_build_object(
    'in_grace', coalesce(grace_until > now(), false),
    'grace_until', grace_until,
    'changes_left', greatest(0, 3 - coalesce(recent, 0)),
    'next_change_at', next_at
  );
END $$;
REVOKE ALL ON FUNCTION public.artist_name_status(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.artist_name_status(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_artist_name()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s jsonb;
  last_name text;
BEGIN
  -- Staff and server jobs (no signed-in user, or someone else's row) aren't limited.
  IF auth.uid() IS NULL OR auth.uid() <> NEW.id THEN RETURN NEW; END IF;
  -- First name, or the same name re-saved: not a change.
  IF public.norm_artist_name(OLD.stage_name) = '' OR public.norm_artist_name(OLD.stage_name) = public.norm_artist_name(NEW.stage_name) THEN RETURN NEW; END IF;
  -- Clearing the name isn't allowed once set; it would reset the limit.
  IF public.norm_artist_name(NEW.stage_name) = '' THEN NEW.stage_name := OLD.stage_name; RETURN NEW; END IF;
  -- Switching back to the name just logged (e.g. a second save of the same edit) isn't another change.
  SELECT new_name INTO last_name FROM public.artist_name_changes WHERE user_id = NEW.id ORDER BY changed_at DESC LIMIT 1;
  IF last_name IS NOT NULL AND public.norm_artist_name(last_name) = public.norm_artist_name(NEW.stage_name) THEN RETURN NEW; END IF;

  s := public.artist_name_status(NEW.id);
  IF (s->>'in_grace')::boolean THEN
    INSERT INTO public.artist_name_changes (user_id, old_name, new_name, counted) VALUES (NEW.id, OLD.stage_name, NEW.stage_name, false);
    RETURN NEW;
  END IF;
  IF s->>'next_change_at' IS NOT NULL THEN
    RAISE EXCEPTION 'ARTIST_NAME_LOCKED: You can change your artist name again on %.', to_char((s->>'next_change_at')::timestamptz, 'FMMonth FMDD, YYYY')
      USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.artist_name_changes (user_id, old_name, new_name) VALUES (NEW.id, OLD.stage_name, NEW.stage_name);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_artist_name ON public.profiles;
CREATE TRIGGER guard_artist_name BEFORE UPDATE OF stage_name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_artist_name();
