-- Personal Branding (PLAN-master-notes 3.6): each user's brand kit (name, tagline, colors, font, logo, footer switch).
-- Catalog Management includes it on contracts and split sheets; the $14.99 add-on (purchases kind 'branding', lookup key
-- branding_yearly) covers split sheets for 12 months. Who may USE the kit is decided by the server (brand-kit.functions),
-- never by this row, so saving a kit unlocks nothing. Additive; no existing data is touched. Safe to run again.
CREATE TABLE IF NOT EXISTS public.brand_kits (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '' CHECK (char_length(name) <= 80),
  tagline text NOT NULL DEFAULT '' CHECK (char_length(tagline) <= 80),
  -- As many colors as they like (a high cap only stops abuse), each #RRGGBB.
  colors text[] NOT NULL DEFAULT '{}' CHECK (cardinality(colors) <= 100 AND (cardinality(colors) = 0 OR array_to_string(colors, ',') ~ '^#[0-9A-Fa-f]{6}(,#[0-9A-Fa-f]{6})*$')),
  -- One of the picker's fonts (src/lib/brand-fonts.ts); an unknown name falls back to Poppins when drawn.
  font text NOT NULL DEFAULT 'Poppins',
  logo_path text,
  show_footer boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Any font from the picker (an earlier draft of this file allowed only four).
ALTER TABLE public.brand_kits DROP CONSTRAINT IF EXISTS brand_kits_font_check;
ALTER TABLE public.brand_kits ADD CONSTRAINT brand_kits_font_check CHECK (char_length(font) <= 60);

ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own brand kit" ON public.brand_kits;
CREATE POLICY "Users read own brand kit" ON public.brand_kits FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users add own brand kit" ON public.brand_kits;
CREATE POLICY "Users add own brand kit" ON public.brand_kits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own brand kit" ON public.brand_kits;
CREATE POLICY "Users update own brand kit" ON public.brand_kits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users delete own brand kit" ON public.brand_kits;
CREATE POLICY "Users delete own brand kit" ON public.brand_kits FOR DELETE TO authenticated USING (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_kits TO authenticated;
GRANT ALL ON public.brand_kits TO service_role;

-- Logos: private, one folder per user (<user_id>/logo.png). The server reads them to draw shared PDFs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('brand-logos', 'brand-logos', false, 2097152, ARRAY['image/png', 'image/jpeg'])
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Users read own brand logo" ON storage.objects;
CREATE POLICY "Users read own brand logo" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users upload own brand logo" ON storage.objects;
CREATE POLICY "Users upload own brand logo" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users update own brand logo" ON storage.objects;
CREATE POLICY "Users update own brand logo" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users delete own brand logo" ON storage.objects;
CREATE POLICY "Users delete own brand logo" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
