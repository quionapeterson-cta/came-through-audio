# PLAN — Catalog organization, Royalty Health bar, split sheet and contract fixes · v1

Status: **awaiting approval.**
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
