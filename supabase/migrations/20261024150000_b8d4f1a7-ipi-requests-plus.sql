-- Co-writer PRO / IPI requests open to Catalog Plus and up (founder, 2026-10-23); invitees get a 30-day Catalog Plus
-- trial (set in the app). Replaces only the guard function from 20261024140000; no data is changed.
CREATE OR REPLACE FUNCTION public.ipi_requests_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.has_tier(NEW.owner_id, 'plus') THEN RAISE EXCEPTION 'Co-writer requests are included with Catalog Plus and up.'; END IF;
    IF (SELECT count(*) FROM public.ipi_requests WHERE owner_id = NEW.owner_id AND created_at > now() - interval '1 day') >= 50 THEN
      RAISE EXCEPTION 'You''ve made a lot of requests today. Try again tomorrow.';
    END IF;
    NEW.status := 'pending'; NEW.answer := NULL; NEW.answered_at := NULL; NEW.sent_at := NULL;
    NEW.expires_at := now() + interval '30 days';
  ELSIF TG_OP = 'UPDATE' AND current_setting('cta.ipi_answer', true) IS DISTINCT FROM 'on' AND coalesce(auth.role(), '') <> 'service_role' THEN
    IF NOT ((OLD.status = 'answered' AND NEW.status IN ('applied', 'dismissed')) OR (OLD.status = 'pending' AND NEW.status = 'dismissed')) THEN
      RAISE EXCEPTION 'This request can''t be changed that way.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ipi_requests_guard() FROM PUBLIC, anon, authenticated;
