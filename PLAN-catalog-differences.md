# Plan — catalog truth: duplicates, versions, differences and retired releases

Founder, 2026-11-12. Four things came out of one sitting, and three of them are the same problem seen from
different angles: **the catalog and the registries disagree, and nothing in the app keeps that disagreement on
screen long enough to act on.**

Status: **proposal**. Nothing here is built, and nothing here carries a number, price or promise the founder has
not approved.

---

## 0. What the founder's own catalog shows (read from the database, no guessing)

`public.catalogs` for the account `e82a0a17…`, read on 2026-11-12:

| What | What's actually stored |
|---|---|
| `Wav vs War` | **3 rows for each of 5 songs**, every copy carrying the *same* ISRC (e.g. `Hood Shit` ×3, all `QZNMY2291719`) |
| `AM PM` | **2 rows with the same title and different ISRCs** (`QT6HX2656773`, `QT6HX2656774`) — real versions, presented as lookalikes |
| `BAM` | `Big Booty Bouncing feat. OG PI` ×2, same ISRC |
| `Quit Playing With Me Deluxe` | 4 tracks, each its own version with its own ISRC (Instrumental / Dirty / Acapella) — correct, and it is the shape the other two should have |
| Artwork on that EP | 2 of 4 tracks have a cover, 2 have none (the copy bug fixed in `9d40ecd`) |

So the founder is not imagining either half of it: there are genuine duplicate rows, and there are genuine
versions that look like duplicates. The app currently cannot tell the difference, which is why both read as
"differences".

---

## A. "Already there" after a delete — the pull's duplicate guard

**What happens.** Deleting catalog rows and pulling the same artist again ends in
`Nothing changed: every track here is already in your catalog.` and
`N songs were already there with the same ISRC and left exactly as it is.`

**Why.** `prefillPlan` (`src/lib/fast-track-prefill.ts`) calls `alreadyInCatalog`, which skips any pulled
recording whose ISRC appears on **any** existing row:

```ts
export function alreadyInCatalog(song, existing) {
  const isrc = isrcKey(song.isrc);
  return !!isrc && existing.some((e) => isrcKey(e.isrc) === isrc);
}
```

That rule is right for "don't overwrite a song I already have". It goes wrong in three situations that all
exist in this account:

1. **Duplicates make it look deletes failed.** With 3 rows per song, deleting one copy still leaves two, so the
   pull is told the song is present — correctly, by its own rule, and uselessly for the member.
2. **A row survives the member's understanding of it.** A row created by an earlier pull with no ISRC (or with a
   placeholder) can be the *same* song. The guard only looks at ISRC, so title-and-artist twins are handled by
   the conflict prompt instead — and the conflict prompt's default is "keep", which quietly keeps the old entry.
3. **The message names a count, never the songs.** `N songs were already there` gives the member nothing to check
   against, so a stale row is indistinguishable from a failed delete.

**The fix, in three additive steps.**

1. `prefillPlan` returns `existingRows: { id, title, album, isrc }[]` alongside `existingCount`, and the panel
   lists them under the result ("Left alone, already in My Catalog: …") with a link that opens the song. Word
   for word, the count stays; this is an addition, not a rewrite.
2. The pull also reports **duplicates it found**, not just matches: two or more existing rows sharing one ISRC
   (`duplicateIsrcs(existing)` in the same module). They show as a line on the pull result and as a card in My
   Catalog ("2 songs share one ISRC — keep one"), because a duplicate row is what made the delete look ignored.
3. **A delete asks the same question the pull does.** `deleteTrack` today removes one row. A "Remove all copies of
   this recording" action on the song (and on a release's row) deletes every row sharing that ISRC, after naming
   them and confirming. Without it the member has no way to get back to a clean slate except by hunting.

**Tests.** `src/lib/fast-track-prefill.test.ts`: an existing row with the same ISRC is still skipped; the skipped
rows are returned by name; two rows sharing an ISRC are reported. A new `src/lib/catalog-delete.test.ts` (same
mocked-Supabase pattern as `src/lib/release-cover.test.ts`, because `src/lib/catalog.ts` has no test file of its own
today): removing a recording removes every row with that ISRC and only those.

**Not doing:** no automatic de-duplication. Two rows merging themselves is a deletion the founder has not
approved, and a wrong merge would take lyrics and splits with it.

---

## B. The embed tab's artwork reverting to an older cover

**What happens.** The cover chosen in **Embed Metadata** comes back as a cover embedded earlier, not the last
one chosen in the app.

**Why — two causes, both in `src/components/MetadataUploader.tsx`.**

1. **The chosen artwork is never kept; the audio file's baked-in picture is.** `selectAudio` does this:

   ```ts
   const { picture, ...found } = readMetadata(buf);
   if (picture && !artwork) { putArtwork(new File([picture])); makeThumb(art)… }
   ```

   Pick an MP3 that was already embedded (which is exactly what a member re-embedding does), and its **old** ID3
   picture becomes the form's artwork. The art that was chosen in the app lives only in React state (`artwork`),
   so a tab switch, a reload or the end of the sitting loses it — and the next audio selection puts the file's
   old cover back. That is the "reverted" behaviour, exactly.
2. **Nothing about the artwork survives the sitting.** `writeIntake(userId, "embed-session", { done, waiting })`
   keeps only the queue's names. Art, unlike the queue, dies with the tab.

**The fix.**

1. **The member's choice wins over the file's picture.** When a picture is found in the audio and one is already
   chosen, keep the chosen one and say so quietly ("The file's own artwork was ignored — your cover is used.").
   When none is chosen, still pre-fill from the file, as today.
2. **Remember the last artwork for the account**, in the same device-scoped store the intake already uses
   (`readIntake`/`writeIntake`, `cta-intake:*`, 12-hour TTL — `src/lib/intake-session.ts`). Reopening the tab
   restores the cover the member last chose rather than the one inside the file. Never uploaded twice: the stored
   value is a data URL, the same shape as `coverThumb`.
3. **Say where a restored cover came from** under the field: "Your last cover (today)" with a Change button, so a
   remembered picture is never mistaken for a file's.

**Tests.** `MetadataUploader` has no test file today; this adds one for the pure rule, extracted as
`preferChosenArt(chosen, fromFile)` in a small module (the rule, not the component), plus a `readMetadata`
fixture with a picture.

---

## C. Same title, different ISRC = a version, not a difference

The founder's rule, as I understand it: two rows with one title and two ISRCs are usually **the same song in two
versions**, and a version is a fact about the recording, not a mistake to "fix" by overwriting an ISRC.

**What exists already.** `Metadata.version` (Radio edit, Clean, Instrumental, Acapella, Sped up, Chopped and
Screwed) and `duplicateTrack` in `src/lib/catalog.ts`, which names a copy `<title> (<version>)` and clears the
ISRC. That is the machinery; nothing routes the member to it.

**The plan.**

1. **A version signal, computed not stored.** `versionGroups(tracks)` in `src/lib/release-routing.ts`: rows that
   share a title key (`titleKey` from `fast-track-prefill.ts`, which already keeps version suffixes apart) with
   two or more distinct ISRCs. It returns `{ title, rows: [{ id, isrc, version }], needsVersion: rows without a
   version tag }`.
2. **It shows where differences show.** A card above the differences chart (§D) reading "Same title, different
   ISRCs — these are separate recordings", listing the rows with their ISRCs and one action per row: **Add a
   version** (opens the existing Duplicate/version flow, prefilled with that row's title), or **Same recording,
   one ISRC is wrong** (the existing credit check).
3. **The comparisons learn it.** `compareList` (`src/lib/agency-lists.ts`) and `compareFacts`
   (`src/lib/process-check.ts`) match by ISRC first, so two versions already resolve to two works. The gap is the
   *report*: a work the agency holds under one ISRC and the catalog holds under the other is filed as a spelling
   mismatch today, because the title matches. `matchWork` gets `isrcConflict: true` for that case, and the
   treatment in §D says "add the version" instead of "fix the title".

**Copy in the member's words (proposal):** "Two recordings, one title. The app can't tell a version from a
mistake, so tag it: `Therapy (Instrumental)` is its own recording and gets its own ISRC."

---

## D. Differences that stay on screen: the comparison chart

**Today.** The full comparison exists for one sitting, in one place:

- `AgencyLists.tsx` computes `compareList(...)` and keeps the whole `ListResult` in `readIntake` — **per device,
  12 hours, one file per society** (`src/lib/intake-session.ts`).
- What reaches the account is only a count: `SavedListSummary { at, file, works, matched, differences, notListed }`
  stored as `list:<society>` in the song's Hub state, and a per-song note of issue strings (`SavedListNote`).
- The credit check (`process-check.ts`) already produces the three-way, structured comparison:
  `Fact { catalog, agency, release, state, field }` and `CheckFinding { title, detail, values }`.

So the detail exists twice and is kept nowhere the member can browse across songs. That is why it "shows fully
once".

**What to add — one new surface, no new table.**

`DifferencesPanel` (new component, `src/components/DifferencesPanel.tsx`) in **Royalties and Registrations**,
below the agency cards and beside the report:

| Column | Where it comes from |
|---|---|
| Song | the catalog row, linked to its song |
| What disagrees | `Fact.label` (title, ISRC, ISWC, writer legal name, IPI, share, UPC, release date) |
| Your catalog | `Fact.catalog` |
| The agency | `Fact.agency` |
| The release | `Fact.release` |
| Exact treatment | `treatmentFor(kind)` — a fixed list, below |
| Status | open · fixed here · fixed at the agency · not ours to fix |

Filters: one per society (BMI, ASCAP, SESAC, GMR, The MLC, SoundExchange) and one for "everywhere"; "open only" by
default, because the chart opens on what needs work.

**The treatments, written once** (`src/lib/differences.ts`, with the tests, never inline in the component):

| Case | Treatment shown |
|---|---|
| The value disagrees | "Check your distributor: is the catalog or the agency right? Fix the copy that is wrong and re-run the check." |
| Same title, different ISRC | "Same song, two versions: add the version to the title on one of them." |
| The agency holds an ISRC from an earlier release of the same recording | "Both recordings are real: register both ISRCs (SoundExchange), and mark the old release Retired so it stops being compared." |
| An absent value | "Waiting for the release" (never "a difference" — the rule `workIssues` already learned for a song the member didn't record) |
| A typed reading, never verified | "A claim, not a lookup" |
| The member can't change it (an agency-side spelling) | "Fix this in {society}'s portal" with the download-steps link |

**Where the data comes from.** Two sources, merged, no new table:

1. `compareFacts` findings, already per song and stored with the song's Hub state — that is the catalog/agency/release
   three-way.
2. `ListResult` rows that only exist in the sitting. Rather than trust a 12-hour device store, the chart reads the
   **saved per-song notes** (`list:<society>`) for the list-level issues and the credit-check facts for the field-level
   ones, so it survives a reload, another device and a cleared browser.

**One decision this forces (undecided).** Storing the full comparison per song per society is a data-shape change
(the Hub state grows). The alternative is to recompute on open from the saved notes, accepting that a fixed issue
only disappears when the check is next run. My recommendation is **recompute on open, plus "checked 14 Aug · 2
differences fixed, 1 open" from the existing summary** — it needs no migration and cannot go stale. Founder's call.

---

## E. Previously released / retired releases

**Today** a release is one of three things (`releaseStatus` in `src/lib/release-panel.ts`): unreleased, scheduled,
released. A recording that came out in 2016 and again on a 2026 deluxe is "released" twice with nothing recording
which is which, which is what makes the old ISRC look like an error.

**The plan.**

1. **A fourth mark, not a fourth state.** `Metadata.retired: boolean` (default `false`, `emptyMetadata()`), set on
   the *release* through the existing Release dialog: "This release has been retired (pulled, replaced or
   re-released)". It never changes `releaseStatus`, never touches a date, and never hides a song from the catalog.
2. **A section of its own in My Catalog**, after Released: **Previously released · retired**, same row markup,
   folded shut by default. Whole releases move there; a single retired track stays with its release and carries a
   small "retired" chip.
3. **What retired changes** — additive only:
   - the differences chart stops comparing it unless the member asks (a toggle: "Include retired releases"), because
     an old ISRC is not a mistake;
   - the Release checklist stops pushing it (it is not about to be distributed);
   - `releaseGroups`, ZIPs and health scoring keep treating it as a normal release unless the founder decides
     otherwise. **Undecided:** whether a retired release counts toward the catalog score and badges. Recommendation:
     it counts for nothing it isn't, and keeps its badges — going back and un-earning a badge is a deletion of
     something already given.
4. **Retiring is reversible** in one click, and says so.

**Schema.** One migration adds `retired` inside the existing `details` JSONB? No — `details` is the metadata blob,
so the field needs no migration at all: `Metadata` is zod-parsed from `details` (`src/lib/metadata.ts`), and an
absent key reads as `false`. **No database change, no backfill, nothing to break for existing rows.**

---

## F. Order of work

| # | Work | Why first | Files |
|---|---|---|---|
| 1 | §B embed artwork (choice wins, remembered, labelled) | smallest, purely wrong today, one sitting to fix | `MetadataUploader.tsx`, new `src/lib/embed-artwork.ts` + test |
| 2 | §A pull names the rows it skipped, reports duplicate ISRCs, "remove all copies" | stops the loop the founder is stuck in right now | `fast-track-prefill.ts`, `StreamingFastTrack.tsx`, `catalog.ts` + tests |
| 3 | §C versions signal + `matchWork` ISRC conflict | feeds the chart, and stops "different ISRC" reading as an error | `release-routing.ts`, `agency-lists.ts` + tests |
| 4 | §D `DifferencesPanel` + `treatmentFor` | the surface the founder asked for | new `differences.ts`, `DifferencesPanel.tsx`, `RoyaltyHealthCheck.tsx` |
| 5 | §E retired releases | depends on 3 and 4 to be worth having | `metadata.ts`, `release-panel.ts`, `MetadataUploader.tsx` |

Each step ships on its own and keeps everything that already exists. Nothing in the list removes a surface, a
column or a message; §D adds a view beside the agency cards rather than replacing the sitting's comparison, and §E
adds a section rather than moving a released song out of its group.

## G. Open decisions for the founder

1. **§D data** — recompute the chart on open from saved notes (my recommendation, no migration), or store the full
   comparison per song per society?
2. **§E scoring** — does a retired release count toward the catalog score, the health percentage and badges?
   Recommendation: kept as it is, no re-scoring, badges stay.
3. **§A "remove all copies"** — one action on a song, or a catalog-wide "Find duplicate recordings" sweep that
   offers them all at once? Recommendation: the song action first; the sweep second, once the shape is proven.
4. **§C wording** — "Add a version" as the button label, or "This is a version"?
