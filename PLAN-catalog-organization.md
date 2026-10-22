# PLAN — Catalog organization, Royalty Health bar, split sheet and contract fixes · v1

Status: **§0 approved and added to BRANDING.md §3 ("organized by titles"); §1 approved and BUILT 2026-10-21 (song form sections + 5 registration fields). Innovative ideas and §2–4 still awaiting approval.**
Source: founder testing notes, 2026-10-21.

---

## 0. Global rule: consolidate with dropdowns

Proposed addition to BRANDING.md §3 (needs your OK):
> - **Consolidate every page into collapsible sections.** Each section gets its own dropdown with a one-line summary when closed (e.g. "Writers · 3 · ✓ complete"), so pages stay short and users open only what they need.

## 1. Catalog song form

- **Each section becomes a dropdown** with a summary line when closed: Song info, Release, Writers, Composers, Producers, Publishers, Lyrics, Files.
- Section titles become plural: **Writers, Composers, Producers** (and Publishers).
- **Publisher moves above Lyrics.**
- Sections with something missing open automatically and show ⚠️ in the summary; complete ones stay closed with ✓.

### Layout preview with the new registration fields (v2, 2026-10-21; for approval before building)

Founder asked to organize the catalog with the 5 new fields approved in PLAN-registration-intake §5. Every section is a dropdown; the closed summary shows ✓ or ⚠️ (⚠️ sections open on their own). Order follows the workflow: what the song is → who made it → who owns it → identifiers → lyrics → save.

```
▸ Song info            ✓  Title, Alternate titles (NEW), Artist, Featured artists,
                          Duration, Explicit, Primary/Secondary genre
▸ Release              ✓  Release type, Album / release title, Track 1 of 12,
                          Release date, Record label
▸ Writers · 3          ⚠️ Writer rows (legal name, role, PRO, IPI, share),
                          Instrumental, readiness panel
▸ Composers (earlier entries)   only when old entries exist
▸ Producers · 1        ✓  Produced by
▸ Performers & recording ✓ Session players / vocalists, Recorded in, Year recorded
▸ Song origins (NEW)   ⚠️ Uses a sample or based on another song? No / Yes →
                          original title, original writers, source
                          Written for film, TV, stage or an ad? No / Yes →
                          type + production title
▸ Publishers · 1       ✓  Publisher rows, or ☐ Self-published (no publisher) (NEW)
▸ Master ownership (NEW) ✓ % of the master owned (default 100%),
                          I own it / I'm an authorized collection designee,
                          Rights start: from release / date, end: forever / date
▸ Identifiers          ✓  ISRC, UPC/EAN, ISWC, Pre-Distribution Note
▸ Lyrics               ✓
  [Embed & Download]  [Submit to catalog]
```

- Embed Metadata (the quick embed page) keeps its short form: Song origins and Master ownership show only in My Catalog, like Publishers today.
- New fields are catalog-only (never written into the MP3), optional for saving and embedding, each with a plain-language tooltip.
- ⚠️ readiness links open the right dropdown before jumping to the field.

### Innovative ideas (pick any)
1. **Progress rail:** a slim line of section dots across the top of each song (filled when complete); click a dot to jump there. Pairs with the health bar.
2. **"Fix next" button:** one button that jumps to the next missing field across the whole catalog.
3. **Card / list toggle:** cover-art cards for browsing, compact list for working.
4. **Copy from another song:** fill writers, publishers and producers from a song already cataloged (most releases share the same team).

## 2. Royalty Health bar

- A bar like the badge meter: **"Royalty health: 78%"**, for the whole catalog and for each song.
- Calculated from **the same fields as the Royalty Health check** (shared code, not a second copy of the rules), so the two always agree.
- Clicking it goes to the first song that needs work.

## 3. Split sheets

- **Add a song** button in the Split Sheets section (same as the catalog's), so splits can be started at any point. The song is created in the catalog too, so nothing is entered twice.
- **Resend** button on partially signed sheets in Pending signatures, sending only to collaborators who haven't signed (same send limits as today: 3 per row, 24 h apart).
- **Downloaded split sheet titles are cut off:** long titles wrap onto a second line in the PDF instead of being clipped.

## 4. Contracts and Masterclasses

- Dropdowns by contract type: **Production · Visual · Label** (then Other, if needed), in both Contracts and Masterclasses.

Files: catalog form components, `src/lib/readiness.ts` (read only; health % reuses it), split sheet list + PDF (`src/lib/*split*pdf*`), contracts and masterclasses components, BRANDING.md (rule above, after approval).
Touches writer field layout (order and titles only, no field or data changes); per AGENTS.md this file list is the plan to confirm before editing.

## 5. My Catalog on one page + liquid health meter (v2, 2026-10-22, APPROVED and BUILT)

Founder changes (v2): gold back to the original bright Gold `#FFD700` (Medallion Gold `#B98339` tried, then removed); Platinum `#E5E4E2` for dark mode; song meters thin; master meter tall enough to show the liquid (wave, sloshing front, bubbles, sheen).

Founder request: put the whole catalog on one page, edit right there, and add a liquid master health meter at the top (gold in light mode, platinum in Studio Mode). Replaces the bar in §2 and uses idea 1 (progress) and idea 2 (Fix next).
Preview: https://claude.ai/artifact/Hocb9vXMVMs1R6B8dnVM8w

```
My Catalog                                         [+ Add song]
CATALOG HEALTH  72%  [≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈~    ]  (click = Fix next)
                     0    25    50    75    100
                     1 of 4 songs fully healthy · 3 need work · Fix next: Night Shift →
Albums · EPs · Singles · All
▸ Crown Season          ▬▬▬▬▬ 100%   [Edit]
▾ Night Shift Freestyle ▬▬▁▁▁  45%   [Close]
    Song info ✓ · Writers ⚠️ (open) · … · Lyrics
    [Update in catalog] [Embed & Download]
▸ Gold Rush             ▬▬▬▬▁  80%   [Edit]
```

- **One page:** Edit opens the song form inside its own row in the list (one song open at a time), instead of replacing the page with an "Edit track" screen. Add song opens a new blank card at the top of the list. Close, Update in catalog and Embed & Download stay in the card. ⚠️ fix links (from the Health Check or readiness) open that song's card and jump to the field.
- **Meter:** catalog % = average of each song's Royalty Health % from `songChecklist()` (the same code and saved checks as the Royalty Health Check, so both always agree; no second copy of the rules). Each song row gets a small meter in the same liquid. Clicking the big meter opens the lowest song that isn't 100% (Fix next).
- **Look:** a horizontal glass tube with 25/50/75 ticks, liquid fill with a slow wave and a few bubbles; fills on load and rises after a save; still fill for people who turn off motion. Light mode: gold `#FFD700` liquid in a light glass tube. Studio Mode: platinum `#E5E4E2` liquid in a dark glass tube. The percentage text is black/white, never on the metal. Buttons stay Cobalt.
- **Brand note:** BRANDING §1 reserves Gold and Platinum for badges and awards. Founder asked for this, so add one line there: "Exception: the Catalog health meter uses liquid Gold (light mode) and Platinum (dark mode)."

Files: `src/components/MetadataUploader.tsx` (form placement only; no writer fields, roles or readiness logic change), new `src/components/HealthMeter.tsx`, `src/styles.css` (meter tokens for light and `.dark`), `BRANDING.md` (exception line). `src/lib/health.ts`, `health-checklist.ts`, `readiness.ts` are read only. No database changes.
