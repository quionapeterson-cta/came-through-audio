# PLAN — Homepage testimonials editor · v1

Status: **BUILT 2026-10-25 (founder master notes 2.2).** Stored as site_settings "testimonials" (no new table); photos in the public site-media bucket (migration 20261025110000); Admin → Homepage editor with character limits, release date required to publish, live preview with the shared filter, tap-to-focus and zoom, order, undo.

Marketing & Social Media and Branding update the homepage testimonials themselves, without a code change.

## What they can change
- Name, role line, location, service, quote and photo.
- The photo's focus point (tap the face on a live preview) and zoom.
- Order on the homepage, and show or hide.

## What stays locked
- **One shared photo filter**: black-and-white, cobalt tint and dark fade are applied to every photo automatically.
  Since 2026-10-20 the filter is adjustable in Admin → Homepage (brightness, contrast, tint strength, fade height,
  each kept inside a brand-safe range), but only as one setting for all cards. There is no per-photo filter.
- **Quotes stay in the client's own words.** Trimming with … is allowed; rewording isn't. The editor shows this rule
  beside the quote box.
- **Signed release required.** A testimonial can't be published until its Photo, Video & Testimonial Release is marked
  signed (with the date, and the signed file attached).

## How it works
- New `testimonials` table (name, title, location, service, quote, photo path, focus, zoom, order, published,
  release signed date, updated by/at). The current entries in `src/lib/testimonials.ts` are copied in, so nothing on the
  homepage changes on day one. The homepage reads published rows and falls back to the file if the table is empty.
- Photos go to a storage bucket that anyone can view once published; only Marketing, Branding and super admins can
  upload, through a staff-verified server function.
- Every change records who made it and when.
- Admin → **Homepage** tab, visible to Marketing & Social Media, Branding and super admins.

## Files (when approved)
New migration · `src/lib/testimonials.functions.ts` · `src/components/TestimonialsEditor.tsx` ·
`src/routes/index.tsx` (read from the table) · `src/lib/departments.ts` (new tab) · tests.
