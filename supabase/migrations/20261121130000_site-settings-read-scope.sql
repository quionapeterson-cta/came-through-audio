-- site_settings is not one audience (founder, 2026-11-21).
--
-- It held four things behind one "any staff member may read it" policy: the homepage testimonials and their drafts,
-- the shared photo filter, the live/sandbox `payments` row, and the PDF packet inbox. That meant any staff member could
-- read unpublished testimonial cards and the payment mode through PostgREST even though the Homepage tab and the
-- payments banner are narrower. This narrows the read to who actually needs each row:
--
--   • a super admin reads every row (unchanged, and the only writer of the live cards and the drafts);
--   • Marketing and Branding read the three homepage rows, drafts included;
--   • any staff member still reads the PDF packet inbox address their tool needs (`pdf_inbox`);
--   • `payments` is no longer granted to staff. Checkout and the staff banner read it with the service role, through
--     `readCountedPaymentsEnvironment`, so nothing breaks and no session can read the mode directly.
--
-- Nothing on the homepage section is written from a session any more. The cards and their shared photo filter are one
-- version, written by `testimonials.functions.ts` (a server function, after the review rules in
-- `src/lib/testimonial-review.ts`), and only a super admin's approval puts them on the homepage. The write grant
-- Marketing and Branding had for `testimonial_filter` therefore goes: no login can change the section without that
-- approval.
--
-- Additive and safe to run more than once: policies are replaced in place and no row is rewritten.

-- 1. Read.
drop policy if exists "Staff read site settings" on public.site_settings;
drop policy if exists "Super admins read site settings" on public.site_settings;
create policy "Super admins read site settings" on public.site_settings
  for select to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "Homepage editors read their settings" on public.site_settings;
create policy "Homepage editors read their settings" on public.site_settings
  for select to authenticated
  using (
    id in ('testimonials', 'testimonial_drafts', 'testimonial_filter')
    and (public.in_department(auth.uid(), 'marketing') or public.in_department(auth.uid(), 'branding'))
  );

drop policy if exists "Staff read the packet inbox setting" on public.site_settings;
create policy "Staff read the packet inbox setting" on public.site_settings
  for select to authenticated
  using (id = 'pdf_inbox' and public.is_staff(auth.uid()));

-- 2. Write: the whole homepage section is server-written, so the editor policy is removed rather than narrowed.
drop policy if exists "Homepage editors write their settings" on public.site_settings;
