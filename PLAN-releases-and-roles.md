# PLAN — One answer per release, fair pre-release health, and roles at onboarding · v1

Status: **v1, for approval. Nothing built.**
Source: founder notes, 2026-11-09 (unreleased singles/EPs/albums, instrumental beats with no ISRC or cover, songwriters with a PRO but no ISRC, roles at onboarding).
Builds on: PLAN-pre-distribution (built 2026-10-25), PLAN-catalog-organization, PLAN-badges-roles-app.

## The problem in one line
A song that isn't out yet is read against the pre-release checklist in some places and against released-song rules in
others, it has to be marked one song at a time, and two of the pre-release items (ISRC, artwork) can be impossible to
fill honestly — so unreleased work still pulls the scores down.

---

## 1. What is already true (keep it, don't rebuild it)

| Already built | Where |
| --- | --- |
| "Not released yet" = future release date, or the box with no date | `isUnreleased` in `src/lib/release-checklist.ts` |
| Release checklist (writers, splits, split sheet, PRO/IPI, ISRC, UPC, master, artwork, + optional AI) | `releaseItems` in `release-checklist.ts` |
| Per-song pre-release reading, ring that says "to release", PRE-RELEASE chip | `health-checklist.ts`, `HealthChecklist.tsx`, `RoyaltyReport.tsx` |
| SoundExchange waits for the release date | `songChecklist` (digital step is `optional`) |
| Catalog meter keeps unreleased songs out and shows "N songs getting ready" | `catalogHealth`, `HealthMeter` |
| Instrumental already skips author + lyrics | `registrationReadiness`, `releaseItems` |

So the shape of the answer is right. Three things are inconsistent with it.

---

## 2. Findings (why this plan, and what is actually broken)

1. **The Royalty Health Hub still scores unreleased songs.** `healthReport` counts every song's details and every
   song × society cell; `agencyScores` treats a song as unreleased only when `releaseDate > today`, ignoring the
   "isn't released yet" box. A song with no date and the box ticked therefore drags the Hub's data score, registered
   score, `missing`, `unchecked` and `needsAction` — the exact penalty the pre-release work was meant to remove.
   (`src/lib/health.ts`.)
2. **`todoList` tells the member to register and confirm unreleased songs**, with no pre-release filter.
3. **A release group's percentage mixes two scales.** `releaseGroups` averages each song's `pct`, which for
   unreleased songs is "ready to distribute" and for released songs is "ready to register". One album can read 80%
   while nothing is comparable.
4. **Two pre-release items can never be honestly finished:**
   - ISRC: The MLC treats it as a hard block (`registrationCheck`), so a songwriter with a PRO registration and no
     distributor sits below 100% with no way out. UPC already has the honest escape ("my distributor will assign it");
     ISRC does not.
   - Artwork: required for every pre-release song, including a producer's beat with no cover and no artist yet.
5. **The SoundExchange step still lists its missing ISRC/UPC for an unreleased song** as a detail to fix, even though
   the step itself is marked optional. It reads as a warning where the design says "wait".
6. **Release state is per song.** An album of twelve needs twelve answers, and the "Singles" group lumps unrelated
   singles into one list, so "this release" has no single place to answer for.
7. **Onboarding asks nothing about what the member does.** Badge collections already want that answer
   (`PLAN-badges-roles-app` §1), and the three cases in the founder's note want it too.

---

## 3. Proposal

### 3.1 One release, one answer
A **Release** panel in My Catalog, on the release group header for an Album or EP, and on the song for a Single:

```
Release   [ Album ▾ ]  [ Release title ]  [ Release date ]
Status    ( ) Not released yet   (•) Scheduled for 2027-03-01   ( ) Released 2027-02-14
```

- Answering writes the same three fields to **every song in that release** through the existing per-song save path.
  No new table, no migration: the group already exists (`releaseType` + album title, `releaseGroups`).
- The group header shows the status ("Not released yet · 0 of 12 out"), so the whole release reads at a glance.
- Editing one song alone stays possible (a late addition, a fixed date). The panel is the easy path, never the only one.
- Each Single is its own release of one, so "each single, EP or album" is answered in all three cases.
- Resolution stays exactly as today: past date = released, future date = scheduled, no date + box = not released. The
  box becomes a status choice instead of a lone checkbox, but the stored fields and the rule do not change.

### 3.2 One rule scores both meters
`isUnreleased` is the only test, used everywhere: the Hub, the catalog meter, the group percentages, the todo list.

- **Hub score**: released songs only, in the numerator *and* the denominator. Unreleased songs get the pre-distribution
  section that already exists in the report — count, average and their own items — plus one line in the meter
  ("3 songs getting ready: 70% ready to distribute"), which the catalog already does.
- `needsAction`, `missing`, `unchecked`, `todoList`: released only. Pre-release work appears as "before release"
  items, not as missing registrations.
- Registered score and "N left to register" exclude pre-release cells, so the Hub stops implying a song should already
  be registered somewhere it cannot be yet.
- Nothing is hidden: every unreleased song is still listed, with its own checklist and its own %.

### 3.3 "Not yet" answers, so nothing impossible counts
Only while a song is unreleased, and only for the two things a member cannot know yet:

| Item | Answer | What it means |
| --- | --- | --- |
| ISRC | "My distributor will assign it" (new tick, same pattern as UPC) | No code exists yet. The item is answered; on release day the checklist asks for the real one. |
| Artwork | "No artwork yet" (new tick) | A beat with no cover, or artwork coming with the release. |

- A producer's unsold instrumental is then legitimately **100% ready to distribute**: Instrumental (no lyrics, no
  author needed) + Not released + ISRC and UPC assigned at distribution + no artwork yet. Nothing invented, nothing
  scored, and the song waits in the pre-release line.
- A songwriter registered with a PRO but not distributed: the composition work (splits, PRO + IPI, MLC) stays and
  counts; ISRC no longer blocks anything; the song stays pre-release until a release date says otherwise.
- Once released, both ticks stop applying and the real ISRC/artwork become requirements again. The release-day note
  names them, so nobody is surprised.

**Answering the founder's question directly:** Instrumental + "not released" is *almost* enough. It removes lyrics and
the author requirement and takes the song out of the score, but artwork and ISRC would still sit unfinished. With the
two "not yet" answers above, those two cases are handled honestly instead of being faked or penalised.

### 3.4 Songs filled from an agency list land in a release
An agency list names works, not the release a work came out on, so every song added by "Fill my catalog" used to start
as a Single and sit in Singles even when it belongs to an album.

- The fill dialog asks once, under the tick list: **Each one is its own single** (the default) or **They all belong to one
  release**, with the release type (Single / EP / Album / Compilation) and its title. It writes `releaseType` and `album`
  with every ticked song through the existing save path, so My Catalog's release groups file them under that EP or Album
  immediately, with no second edit.
- The Add button waits for a release type, so a "one release" answer can never be half-applied, and the toast says where
  the songs were filed.
- The answer is per fill, because one list can hold songs from several releases. Songs from another release are changed
  in My Catalog today, and the Release panel in 3.1 is where moving songs between releases becomes one action.
- Filled songs then follow 3.1 and 3.2: an EP marked "Not released yet" keeps its whole track list out of both scores and
  in the ready-to-distribute line, so a list filled with unreleased works never lowers a number.

### 3.5 Roles at onboarding
One skippable question right after the welcome: **"What do you do? Pick all that apply."**
Songwriter · Recording artist · Producer · Label · Artist manager · Session musician.

- Stored in the account's onboarding JSON (`profiles.onboarding`, already synced) — **no migration**. The existing
  `profiles.role` stays the account/staff role and is not reused for this.
- Editable in Profile → Edit profile.
- New shared module `src/lib/roles.ts` returns a **role plan**: defaults, which society steps apply, and what to show
  first. It never removes a requirement for something the member does have.

| Role | Tailored behaviour |
| --- | --- |
| Songwriter | Composition path first: writers, splits, PRO + IPI, MLC, ISWC, lyrics. A master isn't assumed, so SoundExchange appears only once a master exists; ISRC is "waiting on distribution", not a block. |
| Recording artist | Today's full path, unchanged: master, artwork, ISRC/UPC, PRO/MLC, SoundExchange after release. |
| Producer | Instrumental on by default; artwork/ISRC "not yet" offered; split sheet with the artist and a production agreement surfaced; no PRO/MLC demand for a beat they didn't write. |
| Label | Release-level view and roster first; distribution readiness over embedding prompts. |
| Artist manager | Roster reports and health across artists; fewer per-song embed prompts. |
| Session musician | Credits and neighbouring rights first; no PRO/MLC requirement (they aren't the writer). |

- No roles picked = today's behaviour exactly. This is additive, and every existing account is untouched.
- The same answer feeds the badge collections the badges plan already wanted, so the question is asked once.

---

## 4. What changes, and in what order

Each step ships on its own.

1. **Fairness fix** (no new UI, smallest): both meters and the todo list use `isUnreleased`; group % becomes honest
   (released-only, with a "getting ready" count). This alone fixes the founder's "my unreleased songs count against
   me".
2. **Release panel** for single / EP / album with one status, writing through the existing save path.
3. **"Not yet" answers** for ISRC and artwork on unreleased songs, plus demoting the SoundExchange preview step from
   "fix this" to "waits for release".
4. **Roles** at onboarding, the role plan, and the role-aware ordering/defaults.

Files (no database migration): `AgencyLists.tsx` (the fill dialog's release choice), `release-checklist.ts` (status + not-yet answers + role-aware items), `health.ts`,
`health-checklist.ts` (both meters, todos, group %), new `roles.ts`, `artist-profile.ts` (roles field on `Onboarding`),
`ArtistOnboarding.tsx`, `MetadataUploader.tsx` (release panel, ticks), `HealthChecklist.tsx`, `RoyaltyReport.tsx`,
`HealthMeter.tsx`, tests alongside each.

Pricing stays as it is: health checks and pre-release readiness are free; saving and embedding remain the paid step.
Nothing here adds a paywall or a promise about numbers.

## 5. Open questions

1. Release panel writes to every song in the group (recommended, no migration), or a real releases table?
2. Keep single-song editing beside the panel? *(Recommended: yes.)*
3. Approve the two "not yet" answers, and their wording: "My distributor will assign it" and "No artwork yet"?
4. Roles: these six, multi-select, skippable? *(Recommended: yes, and never required.)*
5. Roles change order, defaults and which society steps apply — never a gap that exists. Confirm that line.
