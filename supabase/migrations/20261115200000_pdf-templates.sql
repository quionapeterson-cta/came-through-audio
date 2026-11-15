-- PDF Template Studio library (founder, 2026-11-15): templates an admin builds or converts are saved here as blocks and
-- read by every staff member, so the team starts from the same documents. Additive: nothing existing is touched.
CREATE TABLE IF NOT EXISTS public.pdf_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tier text NOT NULL DEFAULT 'standard',
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'built',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdf_templates_name CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT pdf_templates_tier CHECK (tier IN ('standard', 'gold', 'platinum')),
  CONSTRAINT pdf_templates_source CHECK (source IN ('built', 'converted'))
);

CREATE INDEX IF NOT EXISTS pdf_templates_updated_idx ON public.pdf_templates (updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_templates TO authenticated;
GRANT ALL ON public.pdf_templates TO service_role;

ALTER TABLE public.pdf_templates ENABLE ROW LEVEL SECURITY;

-- The library is shared: every staff member reads and edits it, and every write records who touched it.
DROP POLICY IF EXISTS "Staff read pdf templates" ON public.pdf_templates;
CREATE POLICY "Staff read pdf templates" ON public.pdf_templates FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff create pdf templates" ON public.pdf_templates;
CREATE POLICY "Staff create pdf templates" ON public.pdf_templates FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Staff update pdf templates" ON public.pdf_templates;
CREATE POLICY "Staff update pdf templates" ON public.pdf_templates FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff delete pdf templates" ON public.pdf_templates;
CREATE POLICY "Staff delete pdf templates" ON public.pdf_templates FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));
