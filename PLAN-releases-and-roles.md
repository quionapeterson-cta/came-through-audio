# PLAN — One answer per release, fair pre-release health, roles, and the producer and songwriter paths · v6

Status: **v4 — everything planned, nothing built from it yet.**
v1 (2026-11-09) set out the findings; v2 recorded the founder's answers and planned the producer and songwriter paths; v3
approved the help box and made the artist's catalog the floor; v4 adds the sell-beats question, the sold beat and its
linked master, the four destinations for filled songs, the dialog layout fix and a bug check of what is already shipped;
v5 adds the songwriter who never performs, the artist who also writes for other people, the credit check that runs after
another artist's release, the master checkup that triggers a beat renegotiation, and the blueprint and agreement that
carry it (§10–§16); v6 answers the four deal fields, keeps a sold beat in Unreleased until its master is out, and makes
the credit check read the official public repertoires instead of the member's memory (§11.5–§11.6).
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
| 14 | The **chip only**: unreleased songs are counted in their type section ("2 unreleased →") and listed once, in the Unreleased section. §4.2. |
| 15 | The four deal fields are confirmed as they stand — **deal type · deal date · streams at which it changes · contract link**. §4.5. |
| 16 | A **sold beat stays in Unreleased** until its linked master has a released recording; then the beat is sold *and* out, and leaves the section. §4.5. |
| 17 | Release credits are **checked against the official public repertoires**, with the links and copy-paste fields provided; a catalog prefill and a typed entry remain available but are never shown as verified. §11.6. |
| 18 | Say **"someone else performs it"**, not "someone else's recording", wherever the outside-song case is explained. §10. |
| 19 | Every **beat licence** gives the producer **100% of the composition** — the writer's share and the publisher's share — editable when a second producer or an artist's writing is added. §13, §17. |
| 20 | A list printed on BMI's **200% scale** is read on the **100% scale**; word order and titles are ignored, but **a different set of name parts is reported with both spellings**, so the catalog can be brought up to the registration. §11.6, §17. |
| 21 | A producer's share names the arrangement — **50%** when artist and producer work closely and split the publishing (the exclusive licence opens here), **25%** when the producer supplied a beat for a song the artist wrote — and a beat licence only exists where the artist writes the song: a producer who wrote it alone licenses it under a sync licence and a master use licence. Every producer deal carries the producer's legal name, PRO affiliation and IPI number, and a PRO fill leaves each writer's author/composer role blank. §17, §18. |

Still to confirm: §9 questions 2 and 3, and §16.

---

- **Producer terms carry the whole registration** (founder, 2026-11-09, `src/lib/blueprints/music-production.ts`): all three beat licences share one composition clause naming the two usual splits — 50% when artist and producer work closely and split the publishing evenly, 25% when the producer supplied a beat to a song the artist wrote — and saying a beat licence exists only where the artist writes the song: a producer who wrote it alone licenses the beat under a sync licence and a master use licence (`rights.ts` says so too). The exclusive licence opens at 50%, the non-exclusive and the buyout at 25%. The clause has the producer registered as the song's composer under their legal name, with their PRO affiliation and IPI name number as real fields prefilled from the member's catalog defaults (`ownProIpi`, `src/components/Contracts.tsx`). A fill from a PRO list leaves each writer's author/composer role blank (`agency-fill.ts`) and lists it in what the entry still needs, and "Use the agency's version" keeps a role the catalog already knew.

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

**Why those four, and only those four.** Each one is used by a screen rather than kept for its own sake:

| Field | What it decides |
| --- | --- |
| Deal type | Which licence template applies (exclusive, non-exclusive, lease, other), so the amendment knows what it is amending and the checklist knows which terms to ask for. |
| Deal date | Which terms were in force on a date — the date the amendment's recitals name, and the day the reminder counts from. |
| Streams at which it changes | The trigger: the cap, the sales threshold or the renegotiation point. Without it there is nothing to compare a reading against, and the check says so instead of guessing. |
| Contract | The document itself, so the member can read the terms they are measured against and the amendment can sit beside it. |

Everything else about the deal (the fee, the points, the territory, the credit line) already lives **inside the contract**
this field links to. Copying those into four more fields would give us two versions of the same fact and a second place to
be wrong, which is the thing the checkup exists to stop.

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

1. ~~**The chip** (§4.2)~~ — answered (founder, 2026-11-09): **chip only**, one row per song. See decision 14.
2. **The deal fields** (§4.5): are deal type, date, stream threshold and a contract link enough, or is there something
   else a beat license needs recorded?
3. **A sold beat stays in Unreleased** (recommended — it isn't a release), rather than getting a "Sold beats" line of its
   own. Confirm?


---

## 10. The two songwriter shapes

A songwriter is not one person. Two shapes matter, and they are not the same path:

| Shape | What they hold | What they are never asked for |
| --- | --- | --- |
| **Writer only** (never performs) | The composition: writers, roles, splits, publishing answers, PRO, IPI, ISWC when the PRO assigns it. | A master, artwork, UPC, SoundExchange, an ISRC of their own. |
| **Artist who also writes for others** | Both, song by song: their own releases keep today's full path, and the songs they wrote for other artists take the writer's path. | Nothing extra — the outside songs simply drop the recording items. |

**It is decided per song, not per account.** The account answers (§4.7) only choose the default for a new entry. A song
that was written for someone else keeps its own answer even when the member also releases music, and an artist's own
release is never converted into a writer-only song by ticking Songwriter.

- **One new catalog answer**, in `details` beside the rest (no migration): `recordingSide: "own" | "external"`. `"own"`
  is the default and today's behaviour; `"external"` means **someone else performs it**. Blank reads as
  `"own"`, so every existing row is unchanged.
- With `"external"`, the song records **who released it** (`artist` becomes the recording artist's name, and the field's
  label reads *Recording artist (who released it)*), and the ISRC is optional until that release exists.
- **My Catalog gets a filter** — *My releases · Written for others* — which is a view over that one field, so nothing is
  moved or hidden by default. The fill dialog's destination step already knows a writer's list is compositions (§4.4).
- **A placed song is a released song for the artist, not for the writer.** Its Release panel still shows the artist's
  release date and status, because that date is what starts the MLC matching.
- **The composer credit is the money.** The PRO pays the writer's share on the registration, The MLC pays mechanicals on
  the same registration, and neither pays on the release's credit line. What goes wrong when the credits disagree is not
  ownership but *matching*: a different spelling or a missing IPI on the registration is what leaves money unclaimed. The
  next section is built around that one sentence.

## 11. The credit check: what runs after another artist releases the song

This is the process the founder asked for, and it is a loop rather than a screen.

```
catalogue the work → register it → the artist releases → check the three copies → fix → check again
```

1. **Catalogue it** — title, writers with roles, splits, publishing, lyrics, PRO and IPI. Nothing here needs a recording.
2. **Register it** — the PRO first (it assigns the ISWC), then The MLC. The ISRC is not needed by either, and the check
   says so (§4.6).
3. **The artist releases** — their distributor issues the ISRC and the UPC, and the release carries a credit line for
   every writer. That credit line is the third copy of the same fact.
4. **Run the credit check.** It compares three copies of the same song side by side:

   | Your catalog | Your agency registration | The released recording |
   | --- | --- | --- |
   | legal name, IPI, share | the work as BMI/ASCAP/The MLC has it | the artist's credits as released |

5. **It shows differences only.** Everything that matches is a line with a tick; the screen opens on the differences,
   the way the fill dialog does. Each difference has one action: *fix this field*, *open the agency's list*, *start the
   split sheet*, or *nothing to do yet*.
6. **The credits are read from the official repertoires, not from memory.** Each writer is looked up where the industry
   keeps the record — The MLC's public search, BMI's repertoire, ASCAP's repertory, SoundExchange's ISRC search — and what
   comes back is compared with the catalog and with the release. A catalog prefill and a typed entry stay available, but
   they are never shown as verified (§11.6).
7. **Each run is saved on the song** (`details.creditCheck: { at, state, findings }`), so the next run can say what
   changed, and the report can say *"checked 14 Aug · 2 differences fixed, 1 open"*. No new table.
8. **It is done when the release exists and the three copies agree** — not when the song is registered. A writer whose
   song is registered but still shows the wrong legal name on the release is not finished, and the card says exactly
   which copy to fix.

### 11.5 Where the credits come from

Four sources, in the order the check trusts them. The links already exist in the app (`PILLARS` and `BMI_SEARCH` in
`src/lib/audit.ts`, shown today only inside the Royalty Inspector), so this reuses them rather than starting a bookmark
list.

| Order | Source | What it settles | How the member gets there |
| --- | --- | --- | --- |
| 1 | **The MLC Public Search** (`portal.themlc.com/search`) | whether the work is registered, its ISWC, the writers and publishers The MLC will pay | copy the title and ISWC, open the portal, paste the result back — or the same answer from the MLC API when credentials exist (§11.7) |
| 2 | **BMI Repertoire** (`repertoire.bmi.com`) and **ASCAP Repertory** (`ascap.com/repertory`) | the society's own record of the work: the writer's legal name, IPI and share | one copy button per field, the portal in a new tab, paste back |
| 3 | **SoundExchange ISRC Search** (`isrc.soundexchange.com`) | which recording carries which ISRC, so the writer can see the artist's recording actually exists | paste the ISRC the release shows |
| 4 | **The release's own credit line** (the artist's distributor page, YouTube description, DSP credits) | who the public sees credited, spelling and all | typed or prefilled from the catalog, marked *from the release, unchecked* |

**Producer credits, and what the repertoires can and cannot see.** No public repertoire lists a producer as a producer:
Songview, BMI, ASCAP and The MLC keep compositions, not studio roles. But a producer who wrote the beat *is* the
composer, and that is now the term of every beat licence (decision 19): **100% of the composition, writer's share and
publisher's share**, reduced on the split sheet when a second producer or the artist's lyrics and melody join it. So the
producer is checked exactly like a writer, under their **legal name**, by song title, **ISWC** or **ISRC** — the same
four sources in §11.5 — and the one line the check adds is that a *non-writing* producer credit exists only on the
release and in the beat contract, where the master checkup (§12) and the amendment (§13) live.

### 11.6 How it stays accurate

Twelve rules, most of them already learned elsewhere in this codebase:

1. **Identifiers before names.** ISWC for the work, ISRC for the recording, IPI for the writer. A name alone never
   establishes a match; it only breaks a tie between two works sharing a title, which is how `matchWork` already works.
2. **Three outcomes, never two.** *Found*, *empty*, *unknown* — the vocabulary `parseSearch` in `composition.server.ts`
   already enforces. Only a lookup that actually ran and returned nothing may say "not listed"; a failed, blocked or
   unrecognised answer says "couldn't check", never "missing". This is the biggest accuracy rule of all, because a false
   "unregistered" sends a writer to register the same work twice.
3. **Verified versus entered.** Every writer row carries its provenance: *MLC Public Search · 9 Nov 2026* or *typed from
   the release*. Only the first may turn a finding green. A typed row is a claim, and the screen says whose claim it is.
4. **Copy, don't deep-link.** The MLC portal is a client-side app that ignores query strings, and Songview has no public
   API and forbids scraping. So: one copy button per field, the portal in a new tab, the answer pasted back. No invented
   prefill, no scraper, no rate-limit games — the rule PLAN-mlc-access already set.
5. **Names are compared, never corrected.** The normaliser (`nameKey`: case, punctuation, hyphens, suffixes, word order)
   *finds* the difference; then both spellings sit side by side and the member chooses. The app never rewrites a legal
   name on its own — the PDF bug that produced "PETER SON QUI ONA LASHY" is exactly why.
6. **Shares stay in their own scale.** A BMI record for a writer-publisher totals 200%, so each party's share is compared
   with that party's share, never a total against a total.
7. **A credit line is not a registration.** The finding names which document is wrong and says plainly that a credit line
   does not decide who is paid: the registration does. The member fixes their own copy first.
8. **Every reading is stamped.** Source, date and what was searched (title, writer or ISRC). *"MLC Public Search · 9 Nov
   2026 · by ISWC"* beats a green tick, and it is the only thing that lets the next run say what changed.
9. **Nothing is called missing after a failed check.** Rule 2 applied to the UI: a blocked lookup disables the finding
   instead of filling it in.
10. **Re-check on an event, not a schedule.** When the ISRC arrives, when a registration changes, when a writer is added,
    when a share moves — plus whatever date the member sets on the Working On item. No notification promises.
11. **One lookup, many songs.** A writer's IPI and legal name are one fact across the whole catalog, so a verified lookup
    applies to every song naming that IPI, and the check only asks about the songs where the answer differs.
12. **The member's own copy is the only copy we touch.** If the artist's release or the agency's record is wrong, the app
    prepares a short correction note to send — it does not email anyone and does not edit the other party's record.

**What the check may and may not claim.** It may say the registration and the release disagree, and name the field. It
may not say a writer is owed money, that a royalty was lost, or that the artist did anything wrong — a credit line and a
registration are different documents, and the app does not have the artist's paperwork. The finding is always "these two
say different things; fix the one you control".

### 11.7 When the MLC lookup can run itself

`mlcLookup` (`composition.server.ts`) already exists, is credential-gated, and answers work / empty / unknown — the exact
shape the credit check needs. It is reached today only from the fast-track flow, so the plan calls it from the credit
check first and falls back to copy-and-paste when `available` is false:

- **Credentials configured**: the MLC half runs in one click per song, server-side, stamped with its source and date.
  Keys stay in the server environment; the browser never sees them.
- **No credentials**: the same button reads *Copy the fields for The MLC*, opens `portal.themlc.com/search`, and takes the
  pasted answer. Nothing breaks and nothing pretends.
- **Either way**, BMI, ASCAP and SoundExchange stay copy-and-paste: none of them offers a public API, and scraping is not
  on the table.

**For the artist who writes for others**, the same screen is where the two halves meet: their own release is checked
against their registration like any artist's, and each outside song is checked against that artist's release. The two
never share a score, because one is a master and one is a composition.

## 12. The master checkup and the beat renegotiation

The producer's side is the same engine with a different lens, which is why it belongs in this plan rather than beside it.

**One module, two checks.** `src/lib/process-check.ts` (new, pure) exposes:

- `creditCheck(song, agencyWork, releaseCredits)` → the findings in §11.
- `masterCheck(song, deal, reading)` → where the recording stands against its license.
- Both return the same shape — `{ state, findings[], next, checkedAt }` — using the checkup's existing `Finding` and
  `StepAction` vocabulary (`royalty-checkup.ts`), so one renderer serves both and nothing is re-implemented.
- `renegotiationDue(deal, reading)` → *not yet · close · due · over*, from the stream count the member entered.

**The process, in the producer's words:**

1. **Record the deal with the beat** (§4.5): type, date, the stream count where it changes, the contract.
2. **Check the master** when the member has a number: paste the streams from the distributor's report (or type them).
   The reading is stamped with its date and is never shown as live.
3. **The check says where it stands**, in one line: *"63,200 of 50,000 — the license point has passed."* With no reading
   it says *"no reading yet — check the master's streams in your distributor report"*, never "0 streams".
4. **Prepare the ask.** The report turns the numbers into the three things a renegotiation needs: what the license allows
   today, what the recording has done, and what the member wants (a new cap, a new fee, a new share, or a buyout).
5. **Make the agreement** — the new contract in §13, prefilled from the beat's deal and attached to the master.
6. **File it back.** The signed amendment sits on the master's card, the old terms stay readable, and the reminder waits
   for the new cap instead of repeating.
7. **Check again on a date.** The checkup sets a due date on the Working On item, so the existing "next step" line picks
   it up; there is no email promise and no automatic renewal of anything.

**Honest limits, stated in the copy:** the app never polls a distributor, never estimates a stream count, and never
promises that a license holder will renegotiate. It records what the member tells it, on the date they told it.

## 13. The blueprint and the agreement

Three additions, all using machinery that already exists — no new screens and no migration.

**1. Blueprint — "Songwriter Credits and Placements" (`songwriter-placements`).** For the writer-only member and for the
outside songs of an artist who writes for others.

Steps: catalogue the work without a recording · settle the splits and sign the sheet · register with the PRO and save the
ISWC · register with The MLC · when the artist releases, collect the release credits · run the credit check and fix what
differs · keep the proof with the song.

Checklist (each item points at its step through `stepOf`, and every step is claimed by an item, which `guides.test`
enforces): *Work catalogued without a master · Splits settled and sheet signed · PRO registration and ISWC saved · MLC
registration · Release credits added · Credit check run · Differences fixed · Proof kept*.

Links through `GUIDE_LINKS`: open the song, open the Health Hub's credit check, open Contracts for the split sheet.
No numbered step is left unclaimed.

**2. Blueprint — "Beat License Checkups and Renegotiation" (`beat-renegotiation`).** Steps: know what the license allows
· record the deal on the beat · read the master's numbers on a date · compare against the cap · decide the ask · sign the
amendment · file it and set the next check. Checklist: *License terms read · Deal recorded · First reading entered ·
Position checked · Ask decided · Amendment signed · New terms filed · Next check dated*.

**3. Contract — "Beat License Renegotiation & Amendment" (`beat-license-amendment`)** in `blueprints/music-production.ts`,
category Music Production, roles Producer / Artist, built with `doc()` and the shared clauses so it reads like the
licenses it amends. Fields: effective date, beat title, song title, the original license date, the original cap and fee,
the new cap, the new fee (if any), the producer's royalty and composition share going forward, credit, earlier leases,
governing law. Every value prefills from the beat's recorded deal when it exists and stays blank when it does not — no
number is invented by us.

Clauses: recitals naming the original agreement · what changes and what does not · the new cap and fee · **prospective
only** (nothing already earned or already licensed changes, and copies already signed keep the terms they were signed
with) · credit · ownership unchanged · no waiver of either side's rights · general terms.

**How it is linked into the process.** `Contract.catalogId` already exists, so the amendment is attached to the beat's
master entry from the song picker (the title becomes *Beat License Renegotiation & Amendment – Gold Teeth*). From the
renegotiation card, one button opens Contracts with that song already chosen and the old terms prefilled; when it is
signed, the master's card shows *Amended 9 Nov 2026 · cap 50,000 → 250,000* and the reminder moves to the new cap. The
signed PDF goes to the Signed Vault like every other contract, because it is one.

## 14. What else makes this better

Proposals, all additive, none of them a new promise:

1. **One renderer, two checkups.** The credit check and the master check share the finding shape, so a member learns one
   report layout and the codebase keeps one component. A third check later is a lens, not a screen.
2. **Difference-first, everywhere.** The fill dialog already does it; the credit check should open on the differences with
   the matches collapsed, so a 40-song writer is not asked to read 40 rows to find two.
3. **Prefill, then confirm.** The release-credits form and the amendment both start from what the member already typed.
   Confirming is one click; correcting is one field.
4. **Say which copy pays.** A one-line legend on the check: the registration is what the PRO and The MLC pay on; the
   release credit is what listeners and the artist's paperwork show. That stops the member fixing the wrong document.
5. **Match by code before name.** `matchWork` already tries ISRC, then ISWC, then title with the writers breaking a tie;
   the credit check keeps that order and never matches on a name alone.
6. **One song, one line.** A song with two disagreeing sources is listed once, with both reasons joined, the way
   `royaltyCheckup` already de-duplicates.
7. **Nothing new is gated.** A missing ISRC, an unchecked credit line or a beat with no master never blocks saving,
   embedding or an export (§ the writer-credits rules). The check is a reading, not a gate.
8. **The contract remembers.** Governing law, the producer's name and the beat title are already remembered by the
   contract form; the amendment adds nothing new to remember.
9. **The checkup dates itself.** A saved run carries its date, and `nextDue` on the Working On item already surfaces the
   next one, so the routine is the member's calendar rather than a notification we cannot guarantee.
10. **A signed amendment ends the prompt.** Once the new terms are filed, the reminder waits for the new cap; it does not
    keep asking about the old one.

## 15. Bug check (read from the shipped code, 2026-11-09)

| # | What is wrong | Where | Fix |
| --- | --- | --- | --- |
| 1 | **A writer-only song cannot be saved at all.** `metadataSchema` requires `artist` to be at least one character, and `MetadataUploader` stops on the first issue at both Save and Embed, so a songwriter with no recording of their own is told *"Artist name is required."* This contradicts §4.6 and blocks the whole first step of §11. | `metadata.ts` `metadataSchema.artist`, `MetadataUploader.tsx` (281, 483) | Require an artist only when the entry has a recording of the member's own. For `recordingSide: "external"`, the field is labelled *Recording artist (who released it)* and may be blank, with a warning rather than a block. |
| 2 | **Every composition list is told it is missing an ISRC.** `listGaps` adds *"No ISRC — The MLC and SoundExchange match a recording by it"* unless the list is SoundExchange, including on BMI and ASCAP catalogues, and the agency card prints it as a gap. AGENTS says ASCAP and BMI never require an ISRC. | `agency-lists.ts` `listGaps`, called from `AgencyLists.tsx` | Ask for an ISRC only on The MLC's and SoundExchange's lists. A PRO list never does, whatever the song. |
| 3 | **An absent catalog ISRC reads as a difference for a song the member did not record.** `workIssues` says *"The agency has ISRC …, your catalog has none"*, which for a placed song is simply "the release hasn't happened yet". | `agency-lists.ts` `workIssues` | For `recordingSide: "external"` with no own recording, a missing ISRC is "waiting for the artist's release", not a difference. The ISWC still compares. |
| 4 | **`bmiPdfRows` throws away every publisher line** (it keeps only `W` participants), so the comparison can never say whether publishing is registered, and a writer's 200% total (writer + publisher) arrives as one 200% writer row. | `agency-lists.ts` `bmiPdfRows` | Keep the `P` rows as publisher entries so both halves of the registration are compared. Existing `listGaps` totals already accept the 200 scale. |
| 5 | **A shared title can attach the wrong work.** `matchWork` falls back to the title and takes the first candidate; two different songs with the same name and no code on either side match by name alone. For a writer with many placements that silently compares against another writer's registration. | `agency-lists.ts` `matchWork` | When more than one work carries the title and no writer or IPI agrees, return "couldn't tell which work this is" and ask, rather than picking the first. |
| 6 | **The contract form can only prefill a title and splits.** `pickSong` fills `songTitle` and `splits`, so the amendment's cap, fee and original license date have no way in from the beat. | `Contracts.tsx` `pickSong` | For the amendment blueprint only, also read the beat's `details` (beat title, cap, fee, license date) into the fields. |
| 7 | **A new blueprint renders without links unless it is registered.** `linkFor` has one guide in `GUIDE_LINKS`, so the two new blueprints' items would show no action. Not a bug, a gap the plan must close in the same change. | `guides.ts` `GUIDE_LINKS` | Add both guides' links; the existing test already fails a link pointing at an item or guide that does not exist. |
| 8 | **The new guides have to satisfy rules the suite enforces**: `stepOf` must be exactly as long as the checklist, every step must be claimed by at least one item, and a cheat sheet may carry no links. | `guides.test.ts` | Write both checklists with an explicit `stepOf`; treat a failing guide test as a build error, not a test to loosen. |
| 9 | **A writer-only song can never reach full health.** `auditTrack` pushes *"Missing ISRC"* into the digital pillar for every track, so a song the member did not record is permanently short of 100% and the report keeps asking for a code that belongs to the artist's release. | `audit.ts` `auditTrack` | Skip the digital pillar's ISRC issue for `recordingSide: "external"` with no own recording; keep it for anything the member records. |

Checked and **not** bugs: `workIssues` compares shares as each writer's part of the total, so a 100-scale and a
200-scale list still compare correctly; `matchWork` tries ISRC, then ISWC, then title with the writers breaking a tie,
which is the right order for a placement; `Contract.catalogId` already exists, so attaching an amendment to a song needs
no migration; `royaltyCheckup` already de-duplicates one song listed for two reasons, which is what the credit check
needs; the beat license templates and `doc()`/`CLAUSE` cover the amendment with no new machinery.

## 16. Open questions

Answered since v5 and now in the decisions table: the chip (14), the four deal fields (15), a sold beat staying in
Unreleased until its master is released (16), release credits checked against the official repertoires (17), and the
wording "someone else performs it" (18).

Still open:

1. **Do we hold MLC Public Search API credentials?** If yes, the MLC half of the credit check runs itself (§11.7) and the
   member only pastes BMI, ASCAP and SoundExchange. If not, all of it is copy-and-paste and the copy must not imply
   otherwise.
2. **Where the credit check lives**: a tab in the Royalty Health Hub beside the agency lists (recommended), or a card on
   the song in My Catalog?
3. **Who sees it**: everyone whose song is `recordingSide: "external"` (recommended), or only members who answered
   *registered as a writer while someone else performs them*?
4. **How long a verified reading stays good**: the sources update on their own schedules (ACE is described as weekly in
   PLAN-pricing-badges), and a stamp stays honest either way — so does a reading expire, or only when an event fires
   (§11.6 rule 10)?
5. **The correction note**: a short note the app prepares for the member to send themselves (recommended), or just a
   copyable paragraph?

## 17. Shipped since this plan (2026-11-09)

Two of §11's fixes went in ahead of the check itself, because the founder hit both on a real BMI upload:

1. **The beat licences carry the composition term** (`src/lib/blueprints/music-production.ts`): Exclusive, Non-Exclusive
   and Buyout now default the producer to **100% of the composition**, the field is editable per song, and the clause
   says the producer registers it under their legal name and can check it in their PRO's repertoire and The MLC's public
   search by legal name, title, ISWC or ISRC. The Music Producer Agreement keeps its 50% co-write default, because there
   the artist is a writer too.
2. **BMI's 200% meets our 100%, and a spelling difference stays a difference** (`src/lib/agency-lists.ts`,
   `src/lib/agency-fill.ts`): one scaler (`scaledShares`) brings any list to the composition's own scale, so the comparison
   column, the dialog and the saved catalog agree. `sameWriter` knows "PETERSON QUI ONA LASHAY" and "Qui-Ona Peterson" are
   one person — word order and titles are ignored — while `spelledDifferently` reports that the name parts differ, naming
   both: "The agency has STEPHENS CALVIN ANDRE JR (MR) where your catalog has Calvin Stephens — same writer, fix the
   spelling so both records match." So the share is not complained about, nobody is called a stranger, and there is a real
   to-do: adopt the agency's spelling, which "Use the agency's version" does in one click.

Still open from §15: the false ISRC gap on PRO lists, `bmiPdfRows` dropping publisher lines, and the writer-only save
blocker — none of them touched by these two.

## §18 Planned, not built

- **Registration assistance** (founder, 2026-11-09): not offered yet. The producer deals now carry the producer's legal name,
  PRO affiliation and IPI name number, so a future offer can start from the signed contract instead of asking the member
  again — and the same two fields already ride on every writer row. `registrationCheck` (PLAN-registration-intake §5) stays
  the strict per-agency gate; nothing here changes it. Price, turnaround and what an agent may do on the member's behalf
  are all undecided: no figure or promise goes into copy until the founder sets it.
- **Choosing a writer's role while filling from an agency list** (founder, 2026-11-09, proposed, not built): the list gives
  the writers but never says who wrote the words. The proposal is one choice per **person**, not per song, because the
  same co-writers appear across a whole catalog: `Author`, `Composer` and `Author/Composer` boxes set once per writer found
  in the uploaded list, applied to every work they appear on, with a per-song override only where it differs. The value is
  written into the writer rows `agencyMetadata` already creates; blank stays blank until the member chooses, and saving,
  embedding and the member's own exports are never blocked by it.
