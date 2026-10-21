# PLAN — Badges round 3: "My next badge" card, genre-matched badges, pop-up fix, profile dropdowns · v1

Status: **awaiting approval.**
Source: founder testing notes, 2026-10-21.

---

## 1. "My next badge" card

- Label "Badge" → **"My next badge"**.
- Clicking it **no longer goes to Profile** (only the small "See all badges" link does).
- **Same position on every page** (top right of the content area, under the header), so it never jumps around.
- **Glowing cobalt ring** around the card (primary token, soft animated glow; still for users who turn off motion).
- **Action-word descriptions** for every badge, e.g.:
  - "15 Hip Hop tracks" → **Submit 15 Hip Hop tracks**
  - → **Get 1 split sheet signed by all collaborators**
  - → **Catalog 5 songs between 9 PM and midnight**
  - I'll write the full list for every badge for your approval before changing them.
- **Tease of the badge after next:** yes, but small. One faded line under the card: "Then: 🔒 Submit 25 Hip Hop tracks." Recommended: it adds a reason to keep going without clutter.

## 2. Only show badges that match the artist

- Genre badges appear only after the artist has cataloged **3 songs in that genre**. A hip hop artist never sees classical badges, and the other way around.
- General badges (catalog milestones, split sheets, time-of-day, AI Protection) show for everyone.
- Applies to the next-badge card, the profile badge list and the badge pop-ups.

## 3. Badge pop-up fix

- Today some pop-ups show a **white box** and the top of the badge gets cut off.
- Fix: one large badge on a transparent background, centered and sized to fit the screen (whole badge visible on phones), with the dim layer behind it. Same pop-up for every badge.

## 4. Limitless badges

- Catalogs can reach hundreds of songs, so badges keep going instead of stopping at a cap:
  - Count badges repeat at set steps (e.g. every 25 songs after 100) with the ×N count.
  - Genre badges continue (25, 50, 100, 250, 500…).
  - I'll mark which badges become repeatable in the badge list for approval.

## 5. Profile badges section

- The whole Badges section collapses into one dropdown.
- Inside it, each group (Catalog, Genres, Split Sheets, Time of day, AI Protection, Staff…) has its own dropdown with an "earned / total" count.

## 6. Party poppers on the split-sheet bonus

- In "You've been asked to sign a split sheet," add the party poppers badge art right before the word **Bonus**. (Uses the existing badge art file if there is one; otherwise this needs art from you.)

Files: `src/lib/badges.ts`, NextBadgeHint component, badge pop-up component, `src/routes/profile.tsx`, `src/routes/sign.$rowId.tsx`, page layouts using the card.
