# PLAN — Royalty Health Hub + Reports working together · v1

Status: **approved and BUILT 2026-10-23.** Founder applies migration 20261024160000 (reports save without their scope until then). BMI writers with no publisher are covered in every report (founder, 2026-10-23).

**Naming (founder, 2026-10-23):** the tab is the **Royalty Health Hub** (the place). Running one is a
**Royalty Health Check** (the action: buttons say *Run a Royalty Health Check*). What it produces is the
**Royalty Health Report** (the result, kept in the Hub under *My reports*).
Source: founder notes, 2026-10-23. Follows PLAN-royalty-health-report.md (built 2026-10-23).

**The problem:** the Hub tab now opens straight on the Royalty Health Report, so there's no step where the user
chooses what to check or tells us what they've already done. The checklist (Song by song) is buried in a dropdown,
the report always covers the whole catalog, and the body picture is too big.

**The idea:** the **Hub is home base**, and a **report is something you generate** for a song, a release or the
whole catalog. Reports are kept in the Hub. Like a doctor's visit: **check-in → checkup → report → treatment →
follow-up.**

| Part | Its job |
| --- | --- |
| **Hub** (home) | Where everything lives: catalog health at a glance, your reports, the checklist, follow-ups |
| **Check-in** (the missing step) | Choose the songs, confirm the country, answer a few "have you registered?" questions |
| **Report** | The diagnosis: body, main finding, organ reports, ℞ treatment |
| **Checklist** | The treatment tracker: each ticked step heals the next report |

---

## 1. The Hub (what the tab opens on)

```
Royalty Health Hub                                     [Run a Royalty Health Check ▸]
┌───────────────────────────────────────────────────────────────────────┐
│ Catalog health 71%  ▬▬▬▬▬▬▬▱▱▱   18 songs · 6 need attention          │
│ Next up: "Song A" needs an ISRC  [Fix it]                              │
└───────────────────────────────────────────────────────────────────────┘
▸ My reports              3 reports · latest Oct 23: "Blockage in the left heart artery" 62%
▸ Song Health Checklist   18 songs · 2 albums & EPs · 11 singles · ⚠️ 6 need attention
▸ Co-writer details       ⚠️ 1 answer to approve
▸ Confirm with your agency lists   Upload what each agency has on file
▸ Check a song that isn't in your catalog   Royalty Inspector · 2 checked
▸ Why this matters
```
- Same collapsible-section style as now (BRANDING.md §3). Sections with ⚠️ open on their own.
- **My reports** replaces "Past reports": every report you generated, newest first, with its scope
  (Whole catalog · *Late Night Drive* (Album) · *Song A* · *Outside song: Song X*), date, score and organ pills.
  Click one to reopen it. Each has **Run it again** (same songs, compared with that report).
- The checklist keeps its sidebar (Singles / EPs / Albums) and gets a **Report** button per song and per release.

## 2. Generating a report: three ways in

1. **From My Catalog:** a small **Health check** button on each song row and on each release header, plus
   **Run a Royalty Health Check** beside the health meter. It opens the Hub on that song's check-in.
2. **From the Hub:** **Run a Royalty Health Check ▸** (pick songs), or the Report button in the checklist.
3. **Manually, for free users or any song outside the catalog:** the Royalty Inspector form. Fill in the song,
   then **Run a Royalty Health Check** instead of only "Save". Free accounts get the full report (already approved).

## 3. Check-in (the missing step, one short screen)

```
Check-in · Song A                                           Step 1 of 2
Which songs?   (•) Song A   ( ) Whole release: Summer Tape   ( ) Whole catalog
Country        United States ▾
What have you done already?               Yes    No    Not sure
  Registered with your PRO (ASCAP)?       ( )    ( )    ( )
  Registered with The MLC?                ( )    ( )    ( )
  Registered with SoundExchange?          ( )    ( )    ( )
  Split sheet signed?                     ( )    ( )    ( )
  Has your distributor delivered it?      ( )    ( )    ( )
  Do you have a publisher?   ( ) Yes  ( ) No, I'm self-published  ( ) Not sure
                                   [Back]   [Run my checkup ▸]
```
- The questions are the checklist's existing "Registered" ticks, so answering here ticks them there (and the reverse):
  one source, no new data. Questions already answered are shown filled in; a song with everything answered skips
  straight to the checkup.
- **Distributor delivered:** filled in Yes when the streaming lookup already found the song. Saved as a checklist
  step (`delivered`), no new column.
- **Publisher:** reads the song's existing Publisher / Self-published fields. "Yes" with no publisher entered shows
  ⚠️ with a link to the publisher field; "No, I'm self-published" ticks Self-published on the song (only when it has
  no publisher listed, never overwriting).
- "Not sure" counts as not registered and the report says how to check (agency list upload or the portal search).
- Missing writer info shows ⚠️ here with a link to the field, but never blocks the checkup.
- Then a short checkup moment (live streaming + MusicBrainz lookups for those songs) → the report.

## 4. The report (scoped to what you chose)

- Same report as today, but built only from the chosen songs (the engine already takes a list of songs), with the
  scope in the header: *Checkup · Oct 23 · Song A · United States*.
- **← Back to the Hub** at the top; the report is saved to My reports automatically.
- Treatment steps that say "tick Registered" open that song in the checklist, so treatment and tracking connect.
- **Smaller body picture:** the body column goes from up to 440px wide to about **280px** (about 220px on phones),
  so the main finding sits beside it without scrolling. Organ cards and organ reports stay as they are.

## 5. Follow-up

- After treatment, the Hub shows "Song A: 2 steps ticked since your report · **Run it again**", and the new report
  says what healed (already built: "since your last report", now compared per scope).
- The calendar confirm reminder stays.

---

## Data

- Migration (additive, keeps every saved report): `royalty_health_reports` gains `scope` (`catalog` · `release` ·
  `song` · `outside`), `label` (the song or release title) and `song_refs` (text[]). Existing rows become `catalog`.
- Reports still save the summary only (score, organs, findings). Reopening a saved one shows that snapshot;
  **Run it again** runs it fresh on the same songs.
- No change to writer fields, readiness logic or export templates.

## Files

- `src/components/RoyaltyHealthCheck.tsx`: Hub home, view switch (Hub · Check-in · Report), My reports.
- New `src/components/HealthCheckIn.tsx`: the check-in screen.
- `src/components/RoyaltyReport.tsx`: scope header, Back to the Hub.
- `src/royalty-report.css`: smaller body column.
- `src/components/HealthChecklist.tsx`: Report button per song and per release.
- `src/components/RoyaltyInspector.tsx`: **Generate my report**.
- `src/components/MetadataUploader.tsx` + `src/routes/workspace.tsx`: Health report buttons in My Catalog, opening
  the Hub on a song or release.
- `src/lib/health-reports.ts` + migration `20261024160000`: scope, label, song_refs.
- Tests: scoped checkup, check-in answers ↔ checklist ticks, report saving per scope.

## Renaming

The tab, FAQ (`src/lib/docs.ts`, `guides.ts`), homepage, emails and Terms say **Royalty Health Hub** for the place;
"Royalty Health Check" stays wherever it means running one (18 files mention it today; each is reworded by meaning).
