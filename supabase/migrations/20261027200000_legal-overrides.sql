-- Admin → Legal (founder, 2026-10-27): super admins and the Security department can replace the wording of any section
-- of the Terms, Privacy Policy or Refund Policy. Everyone can read the current wording (the pages are public); every
-- change and removal is kept in legal_override_history. Additive; safe to run again.
CREATE TABLE IF NOT EXISTS public.legal_overrides (
  doc text NOT NULL CHECK (doc IN ('terms', 'privacy', 'refunds')),
  section text NOT NULL CHECK (char_length(section) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 20000),
  updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (doc, section)
);
GRANT SELECT ON public.legal_overrides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.legal_overrides TO authenticated;
GRANT ALL ON public.legal_overrides TO service_role;
ALTER TABLE public.legal_overrides ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_edit_legal(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'super_admin') OR public.in_department(_user_id, 'security')
$$;
REVOKE ALL ON FUNCTION public.can_edit_legal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_legal(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Anyone reads legal wording" ON public.legal_overrides;
CREATE POLICY "Anyone reads legal wording" ON public.legal_overrides FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Legal editors change legal wording" ON public.legal_overrides;
CREATE POLICY "Legal editors change legal wording" ON public.legal_overrides FOR ALL TO authenticated
  USING (public.can_edit_legal(auth.uid())) WITH CHECK (public.can_edit_legal(auth.uid()));

-- Every version that's replaced or removed, with who replaced it and when.
CREATE TABLE IF NOT EXISTS public.legal_override_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc text NOT NULL,
  section text NOT NULL,
  body text NOT NULL,
  written_by uuid,
  written_at timestamptz NOT NULL,
  replaced_by uuid DEFAULT auth.uid(),
  replaced_at timestamptz NOT NULL DEFAULT now(),
  removed boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.legal_override_history TO authenticated;
GRANT ALL ON public.legal_override_history TO service_role;
ALTER TABLE public.legal_override_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Legal editors read history" ON public.legal_override_history;
CREATE POLICY "Legal editors read history" ON public.legal_override_history FOR SELECT TO authenticated USING (public.can_edit_legal(auth.uid()));

CREATE OR REPLACE FUNCTION public.legal_override_keep_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.legal_override_history (doc, section, body, written_by, written_at, replaced_by, removed)
  VALUES (OLD.doc, OLD.section, OLD.body, OLD.updated_by, OLD.updated_at, auth.uid(), TG_OP = 'DELETE');
  RETURN COALESCE(NEW, OLD);
END $$;
REVOKE ALL ON FUNCTION public.legal_override_keep_history() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS legal_override_keep_history ON public.legal_overrides;
CREATE TRIGGER legal_override_keep_history AFTER UPDATE OR DELETE ON public.legal_overrides
  FOR EACH ROW EXECUTE FUNCTION public.legal_override_keep_history();
