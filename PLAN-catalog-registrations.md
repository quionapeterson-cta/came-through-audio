# Plan — Saved registration record for every song

Status: **proposed, not built.** The Financial Lab's new royalty pipeline ships with per-agency "Mark registered"
buttons, but they only live in the session. This plan is how each song keeps its own record, so a registration is a
fact stored once and read by the catalog, the Lab and the reminders instead of being retyped.

Last updated: 2026-11-23.

## What exists today

- `src/lib/readiness.ts` decides what an agency needs: `registrationCheck(m, "ascap" | "bmi" | "mlc" | "soundexchange")`
  returns `{ ready, missing, tips, total }`, built on `registrationReadiness`, the split rules and `proAccountGaps`.
  There is no SESAC check in that module yet.
- `src/components/RoyaltyPipeline.tsx` shows the three money buckets (master / PRO / The MLC) plus SoundExchange, and
  each agency has a "Mark registered" button. The mark is `useState` keyed by agency and reset when the song changes;
  the field note says so out loud.
- The moment a song is marked registered while `registrationCheck` still reports a gap, the pipeline shows the
  **mismatch** state: "Fix the registration or update the catalog", with the agency's own site linked. That reminder is
  the behaviour this plan has to keep once the mark is saved.
- The catalog already has the fields every agency reads (writer legal names, PRO, IPI, writer and publisher splits,
  ISRC, UPC, master share, rights dates), and `My Catalog` is the place they are edited.

## The one rule this must not break

**A mark is the member's own answer; the check is the catalog's.** Never derive "registered" from filled-in fields, and
never flip a song to registered because its details complete. The member presses the button after they file, and the
button is the only writer of the record. Equally, nothing here may block saving, embedding, playback or a download —
registration has always been the strict gate, and only for registration and agency exports.

## Data model

One row per (song, agency), never a column on the track:

```
song_registrations
  id            uuid primary key default gen_random_uuid()
  owner_id      uuid not null            -- the seat that owns the catalog, same scoping as tracks
  track_id      uuid not null references tracks(id) on delete cascade
  agency        text not null            -- 'ascap' | 'bmi' | 'sesac' | 'mlc' | 'soundexchange'
  status        text not null            -- 'registered' | 'cleared'  (see below)
  registered_on date                     -- the date the member filed, optional
  reference     text                     -- agency work / claim id, optional, the member's own note
  fingerprint   text                     -- hash of the catalog fields the agency reads, at filing time
  created_at    timestamptz not null default now()
  updated_at    timestamptz not null default now()
  unique (owner_id, track_id, agency)
```

- `status`: `registered` means "I filed it". `cleared` is reserved for staff-assisted registrations confirmed by the
  team (Expert Registration Assistance); it is not reachable from a member button. If the team never needs it, ship
  without the value rather than leaving dead copy.
- `fingerprint`: not a checksum for display. It records what the catalog said when the member filed, so a later edit can
  tell them the two no longer match.
- A migration adds the table and its policies; it touches no existing column, so every current catalog entry is
  unchanged and simply has no registration rows.

### RLS and seats

Mirror `tracks`, not a new rule: the owner writes their own rows, and a live seat's owner writes and reads its artist's
rows (`20261108130000_seat-owner-catalog-writes.sql` is the precedent). Reads are always scoped to a user id — an
unscoped query would mix every seat into one catalog, which the catalog reads already guard against. No new
`is_staff` read: staff see registration state only through the existing staff-verified server functions if that is ever
asked for.

## The library, not the component

Add `src/lib/song-registrations.ts` with its test, and keep every decision there:

- `REGISTRATION_AGENCIES` — the ordered agency list and labels, the single place a new agency is added.
- `registrationFingerprint(m, agency)` — the fields that agency's check reads, normalised (trimmed, case-folded, numbers
  as strings) and hashed. Two songs with the same filing-relevant data hash the same however they were typed.
- `registrationCondition({ mark, check })` — the same four states the Lab already shows: `empty` (no money / not
  relevant), `waiting` (filed is false), `mismatch` (filed, and `check.missing` is not empty **or** the fingerprint has
  moved), `collected` (filed and everything still lines up). The Lab's `pipelineState` in `royalty-pipeline.ts` folds
  into this so there is one rule, and its test moves with it.
- `registrationReminders(track, marks)` — the reminder set: one entry per agency that needs action, each with a route
  (`agency` url) and a `fix` list (`check.missing` fields) the catalog form can jump to.

SESAC: `registrationCheck` has no SESAC arm. Either add one to `readiness.ts` from the agency's published intake rules
(founder to confirm the requirement list) or ship SESAC with the button and no readiness gate, saying so on screen.
Do not invent SESAC's rules.

## UI

1. **My Catalog entry**: one row of agency chips under the song's details — ASCAP, BMI, SESAC, The MLC, SoundExchange —
   each a button that reads "Mark registered" until pressed, then "Registered" with the filing date. Pressing again
   asks to clear the mark. No chip turns gold from catalog data alone.
2. **Reminders on the entry**: when a mark and the catalog disagree, the song shows one line — "ASCAP: fix the
   registration or update the catalog" — with two actions: the agency site, and the field the check names (the existing
   `missing[].field` ids already point at the form inputs). This is the same wording the Lab uses.
3. **The Financial Lab** reads the saved marks instead of `useState`: `RoyaltyPipelinePanel` takes `marks` and an
   `onMark` callback; the parent loads them with `listTracks`. The session-only note is deleted when the read is real.
   Its per-agency buttons and mismatch reminder keep working exactly as they do now.
4. **A filter, not a new page**: "Needs attention" in My Catalog can narrow to songs with a mismatch or a missing mark
   for an agency whose bucket holds money. No second catalog surface.

## Drift: "fix registration or update the catalog"

The two actions are genuinely different and the copy must keep both:

- **Fix registration** — the filing is wrong or incomplete; link the agency's site (and the reference id if one is
  stored).
- **Update catalog** — the catalog no longer matches what was filed; link the named field so the member can correct it,
  then re-mark once they have told the agency.

Drift never blocks, hides or unpublishes a song, and it never changes a split. It is a reminder with two doors.

## Order of work

1. Migration + `song-registrations.ts` + tests (fingerprint, condition, reminders). No UI.
2. Catalog chips and the reminder line, read-only for anyone without write access to the song.
3. Lab reads and writes the saved marks; delete the session-only state and its note.
4. Optional: `cleared` marks from Expert Registration Assistance, if the team's intake asks for it.

## Open decisions (founder)

- SESAC's requirement list for `registrationCheck` — needed before SESAC gets a readiness gate.
- Whether a filing date and the agency's reference id are worth capturing now (they are declared above, optional).
- Whether the "Needs attention" filter belongs in this pass or after the chips have been used for a while.
