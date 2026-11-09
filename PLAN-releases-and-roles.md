# PLAN — One answer per release, fair pre-release health, roles, and the producer and songwriter paths · v4

Status: **v4 — everything planned, nothing built from it yet.**
v1 (2026-11-09) set out the findings; v2 recorded the founder's answers and planned the producer and songwriter paths; v3
approved the help box and made the artist's catalog the floor; v4 adds the sell-beats question, the sold beat and its
linked master, the four destinations for filled songs, the dialog layout fix and a bug check of what is already shipped.
Builds on: PLAN-pre-distribution (built 2026-10-25), PLAN-catalog-organization, PLAN-badges-roles-app.

## 0. Decisions taken (founder, 2026-11-09)

| # | Decision |
| --- | --- |
| 1 | The Release panel writes to every song in that release. No releases table. |
| 2 | Editing one song on its own stays, beside the panel. Where the panel lives: §4.1. |
| 3 | The two "not yet" answers are approved with the wording in §4.3. |
| 4 | **Unreleased music gets its own section**, not just a line under the catalog meter. §4.2. |
| 5 | The producer's **"This beat is unsold"** answer and its help box are approved. §4.5. |
| 6 | Onboarding asks whether the member has released songs, none yet but planning a release, or works registered as a writer while someone else performs them. §4.7. |
| 7 | The producer help-box copy in §4.5 is approved as drafted. |
| 8 | Picking **Recording artist** keeps today's catalog exactly, even when other roles or answers are ticked too. §4.7. |
| 9 | The six roles are confirmed: **Songwriter · Recording artist · Producer · Label · Artist manager · Session musician**. |
| 10 | Producers are asked **whether they sell beats**; the beat answers only appear when they do. §4.5. |
| 11 | A sold beat gets **"This beat is sold"**, a new **master recording** entry, a **link** between the two, and the **deal plus its stream threshold**. §4.5. |
| 12 | In the comparison the two version cards sit under the column each describes: keep-mine under **Your catalog**, use-the-agency's under **The agency**. §4.8. |
| 13 | Filled songs can go to **an existing release**, a **new release**, **each as its own single**, or straight into **Unreleased**. §4.4. |

Still to confirm: the three questions at the end (§9).

---

## 1. What is already true (keep it, don't rebuild it)

| Already built | Where |
| --- | --- |
| "Not released yet" = future release date, or the box with no date | `isUnreleased`, `src/lib/release-checklist.ts` |
| Release checklist (writers, splits, split sheet, PRO/IPI, ISRC, UPC, master, artwork, optional AI) | `releaseItems` |
| Per-song pre-release reading, "to release" ring, PRE-RELEASE chip | `health-checklist.ts`, `HealthChecklist.tsx`, `RoyaltyReport.tsx` |
| SoundExchange waits for the release date | `songChecklist` (digital step optional while unreleased) |
| Catalog meter keeps unreleased songs out, shows "N songs getting ready" | `catalogHealth`, `HealthMeter` |
| Instrumental skips the author and lyrics requirements | `registrationReadiness`, `releaseItems` |
| Filled songs can be filed into an EP or album from the fill dialog | `AgencyLists.tsx` (shipped 4c49a4a) |
| Per-song ticks, live count, differences recomputed from the catalog | `AgencyLists.tsx` (shipped 8dabb25, 484f125, 51929fc) |

The shape of the answer is right. The problem is that only half the app follows it.

---

## 2. Findings (why this plan)

1. **The Royalty Health Hub still scores unreleased songs.** `healthReport` counts every song and every song × society
   cell, and `agencyScores` treats a song as unreleased only when `releaseDate > today` — it ignores the "isn't released
   yet" box. A song with no date and the box ticked drags the data score, the registered score, `missing`, `unchecked`
   and `needsAction`.
2. **`todoList` tells the member to register and confirm unreleased songs**, with no pre-release filter.
3. **A release group's percentage mixes two scales**: "ready to distribute" for unreleased songs and "ready to register"
   for released ones.
4. **Two pre-release items can never be honestly finished**: The MLC blocks on ISRC, and artwork is required even for a
   beat with no cover and no artist yet. UPC already has an honest escape; ISRC and artwork do not.
5. **The SoundExchange step still lists its missing ISRC/UPC** for an unreleased song, reading as a warning where the
   design says "wait".
6. **Release state is per song.** An album of twelve needs twelve answers, and the "Singles" group lumps unrelated
   singles together.
7. **Onboarding asks nothing about where the member is.** A songwriter with no recordings and a producer with unsold
   beats get the same screen as a releasing artist, so both are shown requirements that don't apply to them yet.
8. **A beat and the song made from it look unrelated** even though they are the same composition and one deal. The beat
   keeps asking for an ISRC it will never have, and nothing reminds the producer whose beat was used, on what terms, or
   when the license changes.

---

## 3. The rule everything follows

`isUnreleased` is the only test, used by the Hub, the catalog meter, the release groups and the to-do list:

- **Released**: today's full path, both scores.
- **Scheduled** (a future date): pre-release path, out of both scores.
- **Not released** (no date, box ticked): the same as scheduled.
- **Unreleased**: its own section (§4.2), its own checklist and %, never in the numerator or the denominator of a score.
- Nothing is hidden: every unreleased song is still listed, with its own items and its own readiness.

---

## 4. The design

### 4.1 Where the Release panel lives
My Catalog already groups songs into **Singles**, each **EP** and each **Album** (`releaseGroups`). Each group header
gains a compact release row:

```
Bloom · EP                                  12 songs · Not released yet · Edit
Release date 2027-03-01 · Release type EP · Title Bloom
```

- **Edit** opens one small dialog: release type, release title, release date, and **Status** — *Not released yet /
  Scheduled for {date} / Released*. Saving writes those fields to every song in the group through the existing per-song
  save path. No new table and no migration; the group is derived from the type and title the songs already hold.
- A **Single** is a group of one, so the same row appears on its header — "each single, EP or album" is answered in all
  three cases.
- The song's own **Release** section keeps the single-song fields (decision 2). Changing type or title there moves that
  song into another group, which is how a late addition or a correction is handled.
- Group headers show the status in words, so an album that isn't out yet never looks like a released one.

### 4.2 A separate Unreleased section (decision 4)
My Catalog gets a section of its own, above the released groups:

```
UNRELEASED · 9 songs · 71% ready to distribute
  Bloom · EP · 0 of 5 out · 80% · Not released yet
  Gold Teeth · Single · 45%
  Beat 12 · Single · Instrumental · Sold · master: Gold Teeth
```

- It holds every song that isn't out yet, grouped the same way (Singles / EPs / Albums), sorted by readiness.
- Each entry opens the same song and the same Release checklist as today. Nothing is read-only.
- The released sections list released music only.
- The Royalty Health Hub keeps the pre-distribution reading it already has, and its meter line reads "N getting ready",
  so the two screens agree.
- The section has no score of its own for the whole catalog, only per song and per release readiness; it never adds a
  number to the headline.

**What the chip is, in plain words (§9, question 1).** My Catalog's sections are by release type, so an unreleased song
sits inside "Singles" today (or inside its EP/album group). If unreleased songs move to the section at the top, the
"Singles" section no longer lists them, and a member looking for the song they just added would think it disappeared. The
chip is a small counter in the Singles (EP, Album) header:

```
Singles                        2 unreleased →
```

It says "two of the songs filed under Singles aren't out yet; they're in the Unreleased section", and clicking it jumps
to them there. The alternative is to list those songs in **both** places (the type section and the Unreleased section),
which costs a duplicate row per song and makes the catalog longer but leaves every song where it always was.

### 4.3 The "not yet" answers (decision 3, approved wording)
Offered only while a song is unreleased, only for what cannot be known yet:

| Item | Answer | What happens |
| --- | --- | --- |
| ISRC | **"My distributor will assign it"** | The item is answered, still visible, and never blocks. On release day the tick stops applying and the release-day note asks for the real ISRC. |
| Artwork | **"No artwork yet"** | Same: answered, visible, no penalty. Artwork arrives with the release. |

Once released, both become real requirements again — the checklist asks, the note names them, and no score hides them.

### 4.4 Where filled songs go (decision 13)

An agency list names works, not the release they came out on, and a real catalog is singles, EPs, albums and unreleased
music at once. The dialog keeps one question, with four answers and one default:

| Answer | What is written with each ticked song | Default when |
| --- | --- | --- |
| **Each one is its own single** | `releaseType: "Single"`, album cleared | Recording artist |
| **They belong to one of my releases** | that release's `releaseType` and `album` | — |
| **They belong to a new release** | release type and title, both required | — |
| **Not sure yet — leave them unreleased** | `unreleased: true`, no type, no title | Writer-only |

- **The existing-release list** is built with `releaseGroups` from the member's own catalog, so it can never drift from
  what My Catalog shows. Each choice reads `Bloom · EP · 12 songs · Not released yet`, and an unreleased release is a
  perfectly good target. "Singles" is not offered as a target, because a single is one song.
- **The new-release answer** needs a type *and* a title; Add stays disabled until both exist (§5, finding 3).
- **The Unreleased answer** is the plain fill: the songs are added, they appear in the Unreleased section, and the
  member files them whenever they know where they belong. Nothing is guessed on their behalf.
- **The toast names the destination** ("Filed under Bloom (EP); the list still leaves the release date for you"), and
  the Release panel (§4.1) remains the place to move songs afterwards.
- One destination per fill, as before. A mixed catalog just fills again from the same list.

### 4.5 The producer path (decisions 5, 10, 11)

**Asked once, of producers.** Straight after Producer is ticked, one question:

> **Do you sell beats?**
> - I sell beats, or plan to sell beats
> - I don't sell beats

Stored as `sellBeats` in `profiles.onboarding`, editable in Profile → Edit profile. A producer who doesn't sell beats
sees today's instrumental answer and nothing new. A producer who does sees two statements on every unreleased
instrumental.

**On the beat: two statements, no guessing.**

- **This beat is unsold.** No artist yet, no performer, no release, no ISRC, no artwork. The beat stays in Unreleased, is
  never scored, and its checklist asks only for what a beat can honestly have: the composer credit, the splits, a signed
  split sheet and a signed beat contract.
- **This beat is sold.** The catalog now expects a master recording, its ISRC and the credits as released. The beat
  itself is still not a released song, and saying it was sold never marks it released or invents a code.

**What "sold" does.** A panel on the beat:

> **This beat is sold.** The song made from it is a separate entry in your catalog, and it usually has a different title.
> [Create the master recording] [It's already in my catalog → link it]

Creating it opens a new song prefilled from the beat: artist (the buyer), title blank with the beat's title as a hint,
the beat's composer(s) as writers under their legal names, the splits copied as a starting point, instrumental off, and
ISRC, artwork and release fields blank because the artist's release brings those. Saving writes `beatId` on the new
song. Linking an existing song does the same after a search, and refuses with a plain message when that song is already
linked to another beat.

**What the link buys them.**

- The master's card shows `From Beat 12 · Exclusive · 2026-11-09 · contract`, so the producer knows which beat and which
  deal was used even though the titles differ.
- The beat's card shows `Sold · master: Gold Teeth`, with the same deal strip.
- The beat's checklist becomes: signed split sheet, signed beat contract, a linked master. The master carries the release
  path (ISRC, artwork, release date, PRO/MLC, SoundExchange), so the beat is never marked down for them.
- The link is a pointer by song id, written one way (master → beat) and read back by scanning the catalog, so nothing
  dangles. If the link's target is deleted, the card says so and offers to link again instead of erroring.

**The deal** lives on the master, so it travels with the song that earns:

| Field | Values |
| --- | --- |
| Deal type | Exclusive · Non-exclusive · Lease · Other |
| Deal date | a date |
| Streams at which it changes | optional number (the license's cap or renegotiation point) |
| Contract | optional link to a Contracts & Blueprints document |

**The renegotiation reminder.** Beat licenses often change at a stream count, so the beat and the master both show it
once it matters: *"Your license for Beat 12 renegotiates at 50,000 streams. The master was at 63,200 in your last
checkup (Nov 9). Revisit the beat contract."* The count comes only from a checkup the member ran, with its date, and is
never presented as live. With no checkup it reads: *"Check the master's streams in your distributor report, then revisit
the beat contract."* The same line joins the Royalty Report's to-do list, so it doesn't live only on a page they stopped
visiting.

**The help box under "This beat is unsold"** (approved 2026-11-09, keep the wording):

> **When this beat is sold**
> - The artist's distributor creates the ISRC for that release. You don't need one now, and nothing here is late.
> - The artist registers the song with their PRO and the recording with SoundExchange. The PRO assigns the ISWC when the
>   work is registered.
> - They credit you as the **composer under your legal name**, so your PRO and The MLC can pay you. A stage name on the
>   registration is what stops the money finding you.
> - Your split sheet and a beat contract record what you're owed and what the artist may do with the beat. Fill and sign
>   both, and send the signature requests from **Split Sheets** and **Contracts & Blueprints**.

**The reminder card.** The beat's entry in the Unreleased section carries three actions that open the existing tabs:
*Start a split sheet* (Split Sheets), *Make a beat contract* (Contracts & Blueprints), and *Request signatures* once each
one exists. The card stays until both are signed, because that is the part that protects the producer after the sale.

**Why the composer credit matters.** A producer who wrote the music is the composer. Their PRO pays the writer's share
and their publisher (or Self-published answer) the publisher's share; The MLC pays mechanicals on the same credit. The
performing artist's registration lists them from the catalog, so the legal name has to match the catalog exactly.

**One rule for later sums.** The beat and its master are two recordings of one composition. Once a master exists, the
beat's own splits are a reference, not a second claim: no total, split sheet or export may count the same writer twice
by adding the beat and its master together.

### 4.6 The songwriter path (planned out)

Writer-only is a different path, not a smaller version of the artist's.

- **Defaults.** Catalog defaults keep the composition side (writers, splits, publishing answers, PRO, IPI, lyrics) and
  leave the master, artwork and SoundExchange fields alone. Instrumental stays available for cues and scores.
- **The path, in order:**
  1. Write and catalog the work (title, alternate titles, writers with roles, splits, publisher answers, lyrics).
  2. Fill and sign the split sheet; send the requests from Split Sheets.
  3. Register with the PRO (writer PRO + IPI for every writer). The PRO assigns the ISWC when the work is registered, so
     the ISWC arrives after this step, never before — the catalog says "add it when it's assigned", not "missing".
  4. Register with **The MLC**, especially when the song is placed or released by someone else.
  5. When another artist records or releases it, the recording side belongs to them: their distributor creates the
     ISRC, they register the recording with SoundExchange, and the writer's job is to keep the catalog's writer and
     publisher details right so the PRO and The MLC pay them.
- **Placements.** A placed song is a released song for the artist's recording but not for the writer's own catalog.
  Writer-only songs therefore keep the ISRC answer "My distributor will assign it" until the artist's release exists,
  and the checklist asks the writer to come back and paste the real ISRC once it does. The MLC registration follows the
  recording, so that is the one step that genuinely waits.
- **Health.** A writer-only song is scored on the composition: writers, legal names, roles, splits, PRO, IPI, MLC and
  ISWC-when-assigned. It is never marked down for a missing master, artwork, UPC or SoundExchange step. If the writer
  also owns a master later, the path widens to the artist's.
- **The Hub.** The report's pre-distribution reading stays for an unreleased work; for a placed one the writer sees the
  PRO and MLC items and a line naming the artist's side ("the recording is registered by the artist; ask them for the
  ISRC so your MLC registration matches").

### 4.7 Roles and the onboarding question (decisions 6, 9)

One screen, skippable, right after the welcome, asks where the member is (pick all that apply):

- **I have songs released**
- **I have no released songs yet, but I'm planning a release**
- **I have songs registered as a writer, but I'm not the performing artist**

and then what they do: Songwriter · Recording artist · Producer · Label · Artist manager · Session musician.

- Stored in the account's existing onboarding data (`profiles.onboarding`) — no migration. `profiles.role` stays the
  account/staff role and is never reused for this.
- **Artist is never downgraded** (founder, 2026-11-09): picking **Recording artist** keeps today's catalog exactly as it
  is — master, artwork, ISRC/UPC, PRO/MLC, SoundExchange after release, and the embed prompts — even when Producer,
  Songwriter, Label, Manager or Session musician is ticked alongside it. Another role may add an option (the unsold-beat
  answer, a split-sheet reminder, a roster view); it never removes, hides or reorders anything the artist already has.
  An account with no answers is identical to today.
- Editable in Profile → Edit profile. No answers = today's behaviour exactly.
- What the answers change:

| Answer | Defaults and order |
| --- | --- |
| Songs released | Today's full path: master, artwork, ISRC/UPC, PRO/MLC, SoundExchange after release. |
| No releases yet, planning | New songs start unreleased; the Unreleased section and Release checklist come first; the release panel is surfaced. |
| Writer, not the performer | Composition path (§4.6): PRO + MLC + splits first; no master, artwork, UPC or SoundExchange requirement; ISRC waits for the artist. |
| Producer who sells beats | Instrumental on by default; "This beat is unsold" and "This beat is sold" offered (§4.5); splits and beat contracts surfaced; no PRO/MLC demand for a beat they didn't write. |
| Producer who doesn't sell beats | Today's instrumental path; no beat answers. |
| Label / Manager / Session musician | Roster and release views first; session players get credits and neighbouring rights, not writer registration. |

The roles feed the badge collections the badges plan already wants, so the question is asked once.

### 4.8 The comparison layout fix (decision 12)

The comparison shows two columns, **Your catalog** and **The agency (BMI)**, and then two cards underneath: *Use the
agency's version* first, *Keep my catalog version* second. So the card that describes your own catalog sits under the
agency's heading, and the founder read it exactly that way in the dialog (screenshot, 2026-11-09).

The fix is the order of the two cards:

```
Writers            Your catalog                    The agency (BMI)
                   Qui-Ona Peterson 100%           PETERSON QUI-ONA LASHAY 200%

┌──────────────────────────────┐  ┌──────────────────────────────┐
│ ● Keep my catalog version    │  │ ○ Use the agency's version   │
│   Nothing changes here…      │  │   Check that it's correct…   │
└──────────────────────────────┘  └──────────────────────────────┘
```

- Keep-mine goes on the left, under **Your catalog**; use-the-agency's on the right, under **The agency**.
- "Keep" stays the default, the selected card keeps its accent border, and the note under it ("Keeping this one leaves
  the difference in place at BMI") stays where it is.
- No logic changes: `choices`, `runFill` and the re-embed caution are untouched.

---

## 5. Bug check (2026-11-09, read from the shipped code)

| # | What is wrong | Where | Fix |
| --- | --- | --- | --- |
| 1 | The two version cards sit under the column they don't describe (§4.8). | `AgencyLists.tsx` duplicates block | Swap the two cards; keep "keep" as the default. |
| 2 | **PDF writer names arrive broken.** `readTable` pushes every pdf.js text item as a whole cell, so a name the PDF letter-spaces ("PETERSON") becomes `PETER SON QUI ONA LASHY`, and adjacent cells can glue ("THESTEPHENS …"). Adopting that version would save a wrong legal name, and the name matching against the PRO then fails. The uploaded list in the screenshot shows both. | `agency-lists.ts` `readTable`, `bmiPdfRows` | Rebuild lines from each item's `transform` x/y and join only across real word gaps (space wider than a fraction of the font height); then split cells on the BMI column positions. Add the screenshot's names as a test fixture. |
| 3 | **"One release" with a blank title files everything under "Untitled EP"**: `album: release.title.trim() || c.metadata.album` falls back to the list's (usually empty) album. | `AgencyLists.tsx` `runFill` | Require a title for EP/Album/Compilation before Add enables; never fall back to the list's album. |
| 4 | **"Each one is its own single" writes no release type.** The toast promises singles; the song keeps `releaseType: ""`, and agency exports read that field while `releaseKind` only guesses "Single". | `AgencyLists.tsx` `runFill` | Write `releaseType: "Single"` and clear `album` with that answer. |
| 5 | **`finishItems` is dead code** — the "what's left to finish" list the dialog promises appears nowhere except its own test. | `agency-fill.ts`, `agency-fill.test.ts` | Show its output after a fill (song card or toast), or delete it. Not both. |
| 6 | **The Hub still scores unreleased songs** and the to-do list still asks to register them (§2.1–2.2). | `health.ts` | One `isUnreleased` filter for `healthReport`, `agencyScores` and `todoList`. |
| 7 | **Unreleased songs get an automatic "missing ISRC" in the meter** through the MLC readiness step, and artwork is required for a beat with no artist. | `readiness.ts`, `release-checklist.ts` | The two "not yet" answers (§4.3). |
| 8 | **"Fix next" can point at an unreleased song** while the headline average only counts released ones, so the two disagree. | `catalogHealth.next` | Leave the behaviour (it's useful), but label the line "Next to get ready" so it doesn't read as the score's own step. |
| 9 | **The chip's count must respect the search box.** `releaseGroups` filters by query, so counting unreleased songs from an unfiltered list would promise songs the search hides. | `HealthChecklist.tsx` | Count from the same filtered list the sections use. |

Checked and **not** bugs: `toCatalogRow` never writes `audio_url`/`art_url`, so adopting an agency version keeps the
master and artwork; duplicate decisions are recomputed from the current catalog, so a song fixed since the upload is not
asked about again; `fromCatalogRow` spreads `emptyMetadata()`, so new metadata fields with defaults keep old rows
readable.

---

## 6. How it all fits (integration rules)

- **One partition, one helper.** `prerelease` already comes back from `songChecklist`; the Unreleased section, the chip
  and both meters take that same partition rather than each re-testing dates.
- **No migration.** Release status, the beat link and the deal are all `details` fields on an existing song row. New
  fields go into `metadataSchema`/`emptyMetadata` with defaults so a save never drops an unknown key.
- **Links point one way.** Master → beat by song id; the beat's side is derived. Deleting either end leaves a readable
  "the linked recording was deleted" state, never an error.
- **The Release panel and the fill dialog agree.** Both write `releaseType` + `album`; both read the same `releaseGroups`
  output, so a release created by a fill shows up in the panel immediately.
- **The fill dialog needs the catalog.** The existing-release picker takes the member's current tracks as a prop from
  `RoyaltyHealthCheck.tsx`, which already holds them for the report.
- **Nothing new to pay for.** Health checks and pre-release readiness stay free; saving and embedding remain the paid
  step. No new number is promised anywhere in this plan.

---

## 7. Build order

0. **Shipped**: comparison, per-song ticks, release filing from the dialog (484f125, 8dabb25, 51929fc, 4c49a4a).
1. **Quick fixes, each its own commit** (no new concept, no new state): card order (§4.8), the existing-release picker
   (§4.4), a required release title, `releaseType: "Single"` for the own-single answer, and the PDF row rebuild (§5.2).
2. **Fairness fix**: both meters and the to-do list use `isUnreleased`; group % becomes honest.
3. **Unreleased section** in My Catalog, with the chip in the type sections.
4. **Release panel** on each group header, with the three statuses.
5. **Onboarding situations + roles + the sell-beats question**, and the defaults that follow from them.
6. **"Not yet" answers**, the unsold-beat answer and its help box, and the SoundExchange step that waits.
7. **Sold beat**: the master entry, the link, the deal fields, and the renegotiation reminder.

Steps 1 and 2 fix real unfairness without asking the member anything new, which is why they come first.

## 8. Files (no database migration)

`src/components/AgencyLists.tsx` (card order, release picker, filing), `src/lib/agency-lists.ts` (PDF rows),
`src/lib/agency-fill.ts` (destination metadata, `finishItems`), `src/lib/metadata.ts` (link and deal fields),
`src/lib/beat-links.ts` (new: the link, its derived reverse and the renegotiation line),
`src/lib/release-checklist.ts` (status, not-yet answers, role-aware items), `src/lib/health.ts` +
`src/lib/health-checklist.ts` (one rule, todos, group %), `src/lib/roles.ts` (new), `src/lib/artist-profile.ts`
(situations, roles, sellBeats on `Onboarding`), `ArtistOnboarding.tsx`, `MetadataUploader.tsx` (release panel, beat
answers, master link, deal), `HealthChecklist.tsx`, `RoyaltyReport.tsx`, `HealthMeter.tsx`, plus tests beside each.

## 9. Open questions

1. **The chip** (§4.2): chip only (recommended, one row per song), or list unreleased songs in their type section **as
   well** (more familiar, longer catalog)?
2. **The deal fields** (§4.5): are deal type, date, stream threshold and a contract link enough, or is there something
   else a beat license needs recorded?
3. **A sold beat stays in Unreleased** (recommended — it isn't a release), rather than getting a "Sold beats" line of its
   own. Confirm?
