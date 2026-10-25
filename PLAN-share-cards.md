# PLAN — Social share image cards that actually show · v1

Status: **approved 2026-10-25** (ready for launch even if not shared before then).
Source: founder testing notes, 2026-10-21.

---

## How other sites do it
Social apps (Instagram DMs, X, Facebook, iMessage, Discord) don't take an attached image from a website. They read the shared **link**, visit it, and display the image named in the page's `og:image` tag.

## What we have
- Every shared card already gets a public page (`/share/<owner>/<card>`) with `og:image` pointing at the card image (`src/routes/share.$owner.$card.tsx`).

## Likely reasons it doesn't show
1. **The site is private before launch** (passcode gate / `noindex`): when Facebook's or X's bot visits the share link, it may be sent to the gate instead of the card page, so it finds no image.
2. The card image URL must be public, `https`, and load without signing in.
3. Previews are cached: a link shared once while broken stays broken until refreshed (Facebook Sharing Debugger, X Card Validator).
4. Instagram never shows link previews in posts; there the right path is **downloading the image** and posting it (we already offer a download; make that button the first choice for Instagram/TikTok).

## Fix
- Let `/share/*` pages and card images through the pre-launch gate (they show only the card the user chose to share).
- Check the tags with each platform's validator; add `og:url` and `twitter:card = summary_large_image` if missing.
- Share menu: **Download image** (Instagram, TikTok) · **Copy link** (X, Facebook, iMessage, Discord) · native phone share sheet with the image file attached where the phone supports it (this is how most sites "attach" images on mobile).

Files: `src/routes/share.$owner.$card.tsx`, the gate in `src/routes/__root.tsx`, `src/lib/share-cards.ts`, share menu component.
