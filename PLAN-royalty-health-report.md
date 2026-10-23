# PLAN — Royalty Health Check: Singles in the sidebar + a real checkup report · v1

Status: **approved 2026-10-23 and BUILT 2026-10-23** (f9c6411 Singles, 9679196 engine, 640ba88 page, a170093 history, a2937e0 PDF, 61be9dc agency lists, 5ec69ef guided confirm). Founder applies migration 20261024130000. Not built yet: co-writer IPI request email, 'royalties waiting for you' links (need verified URLs), explainer videos (decision pending). Answers: organ mapping approved; free accounts get the full report; agency list upload (§3A) is built this round.
Source: founder notes, 2026-10-23. Follows PLAN-health-hub-round2.md.

---

## 1. Sidebar: one "Singles" dropdown

**Today:** the song list groups by the *Album* field. A single that has its own title typed in Album becomes its own dropdown, so 20 singles = 20 dropdowns.

**After:** grouped by **release type**, using the same rule My Catalog already uses (Single or blank → Single; EP → EP; Album/Compilation → Album):

```
Search songs…            [Least healthy ▾]
▸ Late Night Drive (Album)        62%   12 songs · 9 steps left
▸ Summer Tape (EP)                80%    5 songs · 3 steps left
▾ Singles                         71%   18 songs · 14 steps left
    Song A          ▬▬▬▬▬  2 left
    Song B          ▬▬▬▬▬  Done
    …  (A–Z, or by health when sorted that way)
▸ Royalty Inspector songs         40%    3 songs
```
- Albums and EPs keep one dropdown each; **every single goes in one Singles dropdown**, closed unless the selected song is in it or a search matches.
- The release-type rule moves to `src/lib/health-checklist.ts` so My Catalog and the Health Check share one definition.

Files: `src/lib/health-checklist.ts` (`releaseGroups`), `src/components/MetadataUploader.tsx` (imports the shared rule), `src/lib/health-checklist.test.ts`.

---

## 2. The checkup report ("Royalty Health Check")

### What it answers (what people actually need to know)
1. **Am I getting paid everywhere my songs earn?** (each royalty stream, in one glance)
2. **What's blocking the money, and why?** (symptom → cause)
3. **What do I do first?** (one treatment, then the rest in order)
4. **Is it getting better?** (compared with the last checkup)

### The body: each organ is one way your music gets paid

| Organ | Royalty system | What it checks (from data we already have) |
| --- | --- | --- |
| 🧠 **Brain** | Your identity: codes and names | Legal names, IPI, ISRC, ISWC, UPC filled and **consistent across songs** (same writer with two IPIs, a name spelled two ways, one ISRC on two songs) |
| ❤️ **Heart** | Performance royalties (ASCAP, BMI, SESAC, GMR) | **Left artery = writer share:** writer PRO + IPI, song registered. **Right artery = publisher share:** publisher or Self-published (BMI writers covered), publisher IPI |
| 🫁 **Lungs** | Mechanicals (The MLC): every stream is a breath | **Left lung:** song registered with shares. **Right lung:** recording linked to the song (ISRC + ISWC) |
| 🫘 **Kidneys** | Digital performance (SoundExchange): filters internet & satellite radio plays | **Left:** featured artist registered. **Right:** master owner/label registered. ISRC present |
| 🦴 **Spine** | Splits & paperwork | Writer splits = 100%, publisher shares = 100%, signed split sheet on file |
| 💓 **Pulse** | Follow-through | Registered songs confirmed showing up; songs edited after registering that still need updating at the agency |

All of it comes from what's already computed: `auditTrack`, `registrationCheck`, checklist ticks (registered / confirmed / dates), live streaming + MusicBrainz lookups, and split totals. **No new data entry.**

Each organ gets a state: **Healthy · Watch · Blocked · No flow** (no flow = nothing registered for that stream at all).

### The top line (changes every report, based on what's entered)
The worst organ (severity × songs affected) leads, in three parts: **Diagnosis** (the metaphor), **Cause** (plain words), **Treatment**.

**Rule (founder, 2026-10-23): the Treatment always ends with the real fix at the agency, not only inside Came Through Audio.** Fixing the catalog is never the last step, because the agency still has the old (or no) data. Every treatment runs in this order:
1. **Fill the gap** in the catalog, if anything is missing (link straight to the field).
2. **Download the agency file** right from the Health Check, one click: The MLC Bulk Work Registration (.xlsx), SoundExchange Direct ISRC Ingest (.xlsx), or the BMI / ASCAP Registration Cheat Sheet (.csv). These are the existing agency exports, now reachable from each organ.
3. **Register at the agency:** upload the file in that agency's portal (The MLC, SoundExchange), or type the cheat sheet's fields into ASCAP Member Access / BMI Online Services. Portal link + the plain-language steps from `register-guides.ts`.
4. **Tick Registered** (the checklist step that already exists). The Pulse then watches for confirmation, and an uploaded agency list (§3A) confirms it for real.
Songs already registered get the *update your registration* version of step 3 instead.

> **Blockage in the left heart artery.**
> 3 of 8 songs can't pay your writer share from ASCAP. **Cause:** your IPI number is missing, and those songs aren't registered with ASCAP yet.
> **Treatment:** add your IPI once in Catalog Profile (it fills all 3), download your **ASCAP cheat sheet**, then register the 3 songs in ASCAP Member Access and tick Registered. *Strong, even breaths: one song at a time.*

More examples it would write:
- *"Your lungs are only breathing on one side."* 5 songs are registered with The MLC but aren't linked to their recordings. **Cause:** no ISRC on file. **Treatment:** add the ISRC from your distributor, download **The MLC file**, upload it in The MLC Portal to update those 5 songs.
- *"Your kidneys aren't filtering."* 4 recordings aren't with SoundExchange, so internet and satellite radio plays can't reach you. **Treatment:** download the **SoundExchange file** and upload it in SoundExchange Direct.
- *"Your spine is out of alignment."* "Midnight" splits total 110%. **Treatment:** lower one writer's share, then update the registration at your PRO and The MLC with the new splits (cheat sheet + MLC file).
- *"Mixed signals from the brain."* Jordan Lee has two different IPI numbers across your songs. **Treatment:** check the right one in Jordan's PRO account, correct it here, then update the songs registered with the wrong one.
- *"Clean bill of health. Strong pulse."* Every song is registered and confirmed. Next checkup suggested in 90 days.

**Plans (confirmed 2026-10-23):** everyone gets the full report and every step. The one-click agency files stay on Catalog & Collaborate; on Free and Catalog Plus, step 2 shows a 🔒 "Get the 1-click file" upgrade and the plain field-by-field guide so they can still register by hand.

### More real fixes (outside Came Through Audio), shown as "More ways to fix it" under each treatment
- **Update-registration pack:** when a song is ticked Registered we save a snapshot of its details; if it changes later, the Pulse lists exactly which fields changed and gives the updated agency file, so the user knows what to change in each portal.
- **Ask a co-writer:** a branded email (`emailLayout()`) asking a co-writer to add their PRO and IPI, or to register their share at their own PRO. Uses the existing invite opt-out.
- **Distributor correction message:** when the streaming lookup shows a different title, artist or ISRC, a ready-to-send message for the distributor's support with the exact before and after.
- **Join a PRO:** writers with no PRO get the worldwide list with join links, then the register steps.
- **Royalties waiting for you:** after registering with SoundExchange or The MLC, a link to check for royalties they're holding (links checked before shipping).
- **Confirm reminder:** a calendar file (.ics) plus an email reminder when new registrations usually start showing up.
- **Split sheet:** a Spine problem with co-writers offers "Send a split sheet for signatures", then register with the agreed splits.
- **Let our agents do it:** Expert Assistance, gated by the existing `registrationCheck`.

### Design direction (founder, 2026-10-23)
- Page title: **Royalty Health Report**.
- **Organs are clickable** (in the body diagram and the organ cards) and open that organ's own report: diagnosis, symptom, cause, songs affected, ℞ treatment plan, more ways to fix it; healthy organs show the checklist of what was examined. Previous/next organ buttons.
- **Report colour exception** (goes into BRANDING.md §1 when built, like the health meter): organs use reds and pinks; the prestige accent is **Gold in light mode, Platinum in dark mode** for step numbers, the score ring, the selected-organ ring and section rules. Black, white and cobalt stay for text, buttons and Healthy.
- **Checkup instruments as visuals:** a "royalty rhythm" heart monitor whose line reflects the worst finding (steady / uneven / irregular / flat), vitals tiles, ℞ treatment plan, clipboard checklist for healthy organs, stethoscope on Run a new checkup. Each organ report shows a small rhythm line for its state.
- **Colour balance (60 / 30 / 10):** 60% black and white; 30% Cobalt, used at transparency levels (4%, 8%, 16%, 32%) for organ report headers, fact cards, hover and selected states so it never feels heavy; 10% accents: reds and pinks only on organs, problem states and scans, Gold / Platinum only on step numbers, the score ring, scan markers and the short divider under each heading. Diagnoses are in black / white type; the pictures carry the red.
- **Rhythm colour = status colour** (a colour key explains it): Cobalt steady = healthy, Gold / Platinum uneven = watch, red irregular = needs treatment, grey flat = no flow. Rhythms sit on a small dark monitor so every colour reads in both modes.
- **Scan pictures for every finding:** each finding has its own picture on a dark imaging screen with a Gold / Platinum ring around the blockage (artery clogged with plaque, heart split in two, one lung hollow, kidneys empty, brain fog, double image, misaligned vertebrae, gap in the heartbeat…). Healthy organs show a clear scan.
- **Animation, purposeful and finite:** the monitor line draws once, the score ring fills once, the organ needing treatment beats 4 times then rests, organ reports fade in. Nothing loops forever; all motion is off for people who turn on Reduce motion.

### One consolidated page
Everything on the Royalty Health Check becomes one report, in collapsible sections with a summary line (⚠️ sections open on their own):
1. **Your checkup** (top line, body diagram, treatment, since last checkup, PDF), replacing the score-ring header
2. **Organ sections**: problems first; healthy organs grouped into one closed row
3. **Song by song**: the Song Health Checklist (Albums, EPs, Singles)
4. **Confirm with your agency lists** (upload, §3A)
5. **Check a song that isn't in your catalog** (Royalty Inspector)
6. **Past checkups** (saved reports with their PDFs)
7. **Why this matters**: the two red warning boxes and the mismatch tips move here, so the page has no loose cards
Preview: https://claude.ai/artifact/5Dto9RMV4saF2zr6tqEPkU (report preview + full wording list for approval).

Wording has a few variants per condition so repeat reports don't read the same, but the facts in it always come from the catalog.

### What the page looks like
```
┌ YOUR ROYALTY CHECKUP · Oct 23, 2026 ────────────────────────┐
│  [ body illustration ]   Blockage in the left heart artery. │
│   brain  ◉ cobalt        3 of 8 songs can't pay your writer │
│   heart  ◉ ⚠️            share. Cause: IPI missing.          │
│   lungs  ○ hollow        Treatment: add your IPI once →     │
│   …                      Since last checkup: Spine healed ✓ │
├─────────────────────────────────────────────────────────────┤
│ ▸ ❤️ Heart · Performance · ⚠️ Blocked · 3 songs              │
│ ▸ 🫁 Lungs · Mechanicals · Watch · 5 songs                    │
│ ▸ 🧠 Brain · ✓ Healthy                                        │
│   … (collapsible, ⚠️ ones open on their own)                 │
│ [Download report (PDF)]                                     │
└─────────────────────────────────────────────────────────────┘
```
- Each organ section: **Symptom** (what you'd notice: "no checks from ASCAP for these songs") → **Cause** → **Treatment** (fill the field → download the agency file → register at the agency → tick Registered), with links straight to each step (⚠️ + link, never a dead end), and the songs affected.
- **Broken heart 💔:** when a song is missing one side of the heart (no writer share set up, or no publisher share: no publisher and not Self-published), the Heart shows as a broken heart. **Exception:** BMI writers with no publisher aren't broken, because BMI pays them the publisher share (same rule as `publisherCovered`).
- **Pictures:** a clean front-view body outline with the six organs; each lights **cobalt** when healthy, shows **⚠️** when Watch/Blocked, and goes **hollow grey** for No flow. Black/white/cobalt only, no gore, no red. I draw it as SVG now; it can be swapped for commissioned art later.
- **Honest source line** under the top line: *"Based on your catalog, the steps you've confirmed and live streaming/MusicBrainz lookups. Agency databases can't be searched automatically yet."* Once an agency connection exists (§3D), that organ is marked **Verified**.
- **Download report (PDF)**, built like the catalog PDF.
- **Since last checkup:** each report is saved, so the next one says what healed and what's new.

Files: new `src/lib/royalty-checkup.ts` (diagnosis engine, pure + unit tests), new `src/components/RoyaltyCheckup.tsx` + `BodyDiagram.tsx`, `HealthReport.tsx` (top section), `src/lib/checkup-pdf.ts`.
Migration (preserves all data, adds only): `royalty_health_reports` (user_id, created_at, summary jsonb) with RLS own-rows.
Readiness logic is **not** re-implemented: the engine only calls `registrationCheck` / readiness / `auditTrack`.

---

## 3. Better data until agencies let us search (my suggestions)

Catalog input is the base, but these make the report far more accurate, with no permission needed:

- **A. Upload your agency catalog.** Member portals let writers download their registered works as a spreadsheet (I'll confirm each one's format before building). The user uploads it; we match it to their catalog and report **real mismatches**: song not registered, writer missing, share or IPI different. Authorized, because it's their own data. *Biggest accuracy jump.*
- **B. Guided confirm instead of one tick.** After "Search Songview", three quick questions: *All writers listed? Shares match? Publisher listed?* A "no" becomes a precise finding instead of a vague "not confirmed".
- **C. Later: royalty statement upload.** A song with streams but $0 from an agency is the clearest symptom there is.
- **D. The MLC Public Search API exists today** (search works by title and writers, returns ISWC and writers). It needs credentials from The MLC. Applying is step 1 of the partnership plan, and it would make the Lungs a **verified** check.

---

## 4. Name
It's already called **Royalty Health Check** in the app. The homepage footer link still says "Royalty Health Suite"; it becomes **Royalty Health Check** with the report.

## Order of work (each its own commit, app works after each)
1. Singles dropdown (§1)
2. Diagnosis engine + tests (§2), with the full wording list sent to you for approval first
3. Checkup section + body illustration (preview screenshot before pushing)
4. Saved reports + "since last checkup" (migration for you to apply)
5. PDF download
6. Guided confirm (§3B), then agency catalog upload (§3A)

