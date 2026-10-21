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
