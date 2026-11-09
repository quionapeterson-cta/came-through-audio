# PLAN — One answer per release, fair pre-release health, roles, and the producer and songwriter paths · v2

Status: **v3 — decisions recorded, nothing built yet.**
v1 (2026-11-09) set out the findings; v2 recorded the founder's answers and planned the producer and songwriter paths in
full; v3 adds the approved help box and the rule that an artist's catalog never changes because of another role.
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

Still to confirm: the six music roles (§4.7) and the two questions left at the end.

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
  Beat 12 · Single · Instrumental · This beat is unsold
```

- It holds every song that isn't out yet, grouped the same way (Singles / EPs / Albums), sorted by readiness.
- Each entry opens the same song and the same Release checklist as today. Nothing is read-only.
- The released sections list released music only. A release that isn't out leaves a chip in its type section
  ("2 unreleased →") so a song never looks deleted, and clicking the chip jumps to it in the Unreleased section.
- The Royalty Health Hub keeps the pre-distribution reading it already has, and its meter line reads "N getting ready",
  so the two screens agree.
- The section has no score of its own for the whole catalog, only per song and per release readiness; it never adds a
  number to the headline.

### 4.3 The "not yet" answers (decision 3, approved wording)
Offered only while a song is unreleased, only for what cannot be known yet:

| Item | Answer | What happens |
| --- | --- | --- |
| ISRC | **"My distributor will assign it"** | The item is answered, still visible, and never blocks. On release day the tick stops applying and the release-day note asks for the real ISRC. |
| Artwork | **"No artwork yet"** | Same: answered, visible, no penalty. Artwork arrives with the release. |

Once released, both become real requirements again — the checklist asks, the note names them, and no score hides them.

### 4.4 Filled songs land in a release (shipped)
An agency list names works, not the release they came out on, so the fill dialog asks once: *Each one is its own single*
(default) or *They all belong to one release* with a type and title. The answer is written with each ticked song, so My
Catalog files them under that EP or album immediately. One release per fill; §4.1's panel is where moving songs between
releases becomes a single action later. Shipped in 4c49a4a.

### 4.5 The producer path (decision 5, approved)

**On the song.** A new answer beside Instrumental: **"This beat is unsold"**.

- Offered on an unreleased instrumental (see the open question about the songwriter's instrumental cues).
- It says out loud what is true: no artist yet, no performer, no release, no ISRC, no artwork. The song stays in
  Unreleased, is never scored, and its checklist stops asking for the things only a release can have.
- It is a statement, not a sale: never shown as "sold", never marks the song released, never invents a code.

**The help box under it** (approved 2026-11-09, keep the wording):

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

### 4.7 Roles and the onboarding question (decision 6)

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
| Producer | Instrumental on by default; "This beat is unsold" offered; splits and beat contracts surfaced; no PRO/MLC demand for a beat they didn't write. |
| Label / Manager / Session musician | Roster and release views first; session players get credits and neighbouring rights, not writer registration. |

The roles feed the badge collections the badges plan already wants, so the question is asked once.

---

## 5. Build order

0. **Shipped**: filled songs can be filed into a release from the fill dialog (4c49a4a).
1. **Fairness fix**: both meters and the to-do list use `isUnreleased`; group % becomes honest.
2. **Unreleased section** in My Catalog, with the chip in the type sections.
3. **Release panel** on each group header, with the three statuses.
4. **"Not yet" answers**, the unsold-beat answer and its help box, and the SoundExchange step that waits.
5. **Onboarding situations + roles**, and the writer-only and producer defaults that follow from them.
6. **Reminder card** for unsold beats, linking Split Sheets and Contracts & Blueprints.

Each step ships on its own; 1 and 2 fix the unfairness without asking the member anything new.

## 6. Files (no database migration)

`src/components/AgencyLists.tsx` (fill release choice, shipped), `src/lib/release-checklist.ts` (status, not-yet
answers, role-aware items), `src/lib/health.ts` + `src/lib/health-checklist.ts` (one rule, todos, group %),
`src/lib/roles.ts` (new), `src/lib/artist-profile.ts` (situations + roles on `Onboarding`), `ArtistOnboarding.tsx`,
`MetadataUploader.tsx` (release panel, Unsold beat, Unreleased section), `HealthChecklist.tsx`, `RoyaltyReport.tsx`,
`HealthMeter.tsx`, plus tests beside each.

Pricing is unchanged: health checks and pre-release readiness stay free; saving and embedding remain the paid step.
Nothing here adds a paywall or promises a number.

## 7. Open questions

1. **The six roles** — confirm the list as written? *(Recommended: yes, multi-select and skippable.)*
2. **"This beat is unsold"** on every unreleased instrumental, or only when the member picked Producer? *(Recommended:
   every unreleased instrumental — a songwriter's instrumental cue can be unsold too.)*
3. **Unreleased section and the type groups**: chip in the type section pointing to it (recommended), or the unreleased
   song stays in its type group as well?

The help-box wording is approved (§4.5) and needs nothing further.
