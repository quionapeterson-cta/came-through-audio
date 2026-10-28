-- Several Branding Kits per person (founder, 2026-10-27: $13.99 per kit per year), each with a contract style and a
-- term header color, and contracts that remember which kit they use. Every existing kit is kept as that person's first
-- kit. Who may USE a kit is still decided by the server (brand-kit.functions), so saving a kit unlocks nothing.
-- Additive; safe to run again.

ALTER TABLE public.brand_kits ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.brand_kits ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
-- Existing kits count as the oldest, so they stay the one in use.
UPDATE public.brand_kits SET created_at = updated_at WHERE created_at > updated_at;

-- One row per kit instead of one per person: the key moves from user_id to id (rows are kept as they are).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.brand_kits'::regclass AND contype = 'p' AND pg_get_constraintdef(oid) LIKE '%(user_id)%'
  ) THEN
    ALTER TABLE public.brand_kits DROP CONSTRAINT brand_kits_pkey;
    ALTER TABLE public.brand_kits ADD PRIMARY KEY (id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS brand_kits_user ON public.brand_kits (user_id, created_at);

-- Contract style and the color of contract section titles (blank = Primary Black #0b0b0b).
ALTER TABLE public.brand_kits ADD COLUMN IF NOT EXISTS style text NOT NULL DEFAULT 'classic';
ALTER TABLE public.brand_kits DROP CONSTRAINT IF EXISTS brand_kits_style_check;
ALTER TABLE public.brand_kits ADD CONSTRAINT brand_kits_style_check CHECK (style IN ('classic', 'sidebar', 'banner', 'minimal'));
ALTER TABLE public.brand_kits ADD COLUMN IF NOT EXISTS header_color text;
ALTER TABLE public.brand_kits DROP CONSTRAINT IF EXISTS brand_kits_header_color_check;
ALTER TABLE public.brand_kits ADD CONSTRAINT brand_kits_header_color_check CHECK (header_color IS NULL OR header_color ~ '^#[0-9A-Fa-f]{6}$');

-- At most 20 kits per person (a cap against abuse; how many can be used is checked when a document is made).
CREATE OR REPLACE FUNCTION public.brand_kits_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.brand_kits WHERE user_id = NEW.user_id) >= 20 THEN
    RAISE EXCEPTION 'You can have up to 20 Branding Kits.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.brand_kits_limit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS brand_kits_limit ON public.brand_kits;
CREATE TRIGGER brand_kits_limit BEFORE INSERT ON public.brand_kits FOR EACH ROW EXECUTE FUNCTION public.brand_kits_limit();

-- Which kit a contract uses (blank = the person's first kit).
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS brand_kit_id uuid REFERENCES public.brand_kits(id) ON DELETE SET NULL;
