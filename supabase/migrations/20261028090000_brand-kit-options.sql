-- More ways to style a Branding Kit's contracts (founder, 2026-10-28): logo watermark on page 1, a cover page, signature
-- line or box, a second accent color, rounded or square corners. Kept together in one options field; existing kits
-- get the defaults. Additive; safe to run again.
ALTER TABLE public.brand_kits ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '{}'::jsonb;
