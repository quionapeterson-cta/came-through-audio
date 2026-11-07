-- Saved colour palettes for a Branding Kit (founder, 2026-11-07): a member keeps the palettes they use and puts one back
-- in one click. Kept in one jsonb field, the way `options` is; every existing kit starts with none. The shape is
-- [{ name, colors: ["#RRGGBB", …] }], cleaned in src/lib/brand-kit.ts (kitColorSets) before the editor draws it, so a
-- stray value can never break a kit. Additive; no existing data is touched. Safe to run again.
ALTER TABLE public.brand_kits ADD COLUMN IF NOT EXISTS color_sets jsonb NOT NULL DEFAULT '[]'::jsonb;
