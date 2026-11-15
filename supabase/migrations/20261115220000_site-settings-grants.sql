-- site_settings had lost its table privileges: anon, authenticated and service_role held only
-- TRUNCATE/REFERENCES/TRIGGER/MAINTAIN, so a read came back as permission denied (and the editor quietly fell back to the
-- seed cards) and every save failed. RLS still decides which rows a caller may see or write; these grants only let the
-- request reach it, matching every other table in public.
grant select, insert, update, delete on table public.site_settings to authenticated;
grant select, insert, update, delete on table public.site_settings to service_role;

-- Marketing and Branding own the homepage cards and the shared photo filter (founder, 2026-10-25), so they can write
-- those two rows through their own session. Every other setting stays super-admin only.
drop policy if exists "Homepage editors write their settings" on public.site_settings;
create policy "Homepage editors write their settings" on public.site_settings
  for all to authenticated
  using (
    id in ('testimonials', 'testimonial_filter')
    and (public.in_department(auth.uid(), 'marketing') or public.in_department(auth.uid(), 'branding'))
  )
  with check (
    id in ('testimonials', 'testimonial_filter')
    and (public.in_department(auth.uid(), 'marketing') or public.in_department(auth.uid(), 'branding'))
  );
