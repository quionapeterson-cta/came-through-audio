# Badge art masters (4K)

4096 × 4096 originals of the badge art drawn by `scripts/badge_art/designs.py` (2026-10-25). The site serves the
1600 px copies with the same paths under `public/icons/`; keep these for print, share cards and future edits.
Re-render with `python3 scripts/badge_art/designs.py [name ...]` (needs Pillow + numpy), then resize to 1600 px.

These masters are **not tracked in git** (founder, 2026-11-04). They live in the R2 bucket under `4k/icons/`, mirroring
the web copies' paths without the leading `icons/`; this folder is the local working copy and is ignored. Upload a
re-rendered file to the bucket instead of committing it.
