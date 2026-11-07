-- Several versions of one logo per kit (founder, 2026-11-06): a member can switch the version a kit prints without
-- rebuilding the kit. logo_path stays the version in use, so nothing that reads a kit needs to change; logo_paths is the
-- gallery it can switch between. Existing kits keep their one logo, which kitFromRow reads as the first version.

alter table public.brand_kits
  add column if not exists logo_paths text[] not null default '{}';

comment on column public.brand_kits.logo_paths is
  'Every logo version uploaded for this kit (brand-logos storage paths). logo_path is the one currently in use.';
