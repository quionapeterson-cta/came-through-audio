# PLAN — Royalty Health Check: Singles in the sidebar + a real checkup report · v1

Status: **approved 2026-10-23.** §1 built. Answers: organ mapping approved; free accounts get the full report; agency list upload (§3A) is built this round.
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
The worst organ (severity × songs affected) leads, in three parts: **Diagnosis** (the metaphor), **Cause** (plain words), **Treatment** (the one next step).

> **Blockage in the left heart artery.**
> 3 of 8 songs can't pay your writer share from ASCAP. **Cause:** your IPI number is missing on those songs.
> **Treatment:** add your IPI once in Catalog Profile; it fills all 3 songs. *Then take a deep breath: the other two steps are quick.*

More examples it would write:
- *"Your lungs are only breathing on one side."* 5 songs are registered with The MLC but aren't linked to their recordings. **Cause:** no ISWC/ISRC pair. **Treatment:** add the ISRC from your distributor.
- *"Your spine is out of alignment."* "Midnight" splits total 110%. **Treatment:** lower one writer's share.
- *"Mixed signals from the brain."* Jordan Lee has two different IPI numbers across your songs. **Treatment:** check which one is right in your PRO account.
- *"Clean bill of health. Strong pulse."* Every song is registered and confirmed. Next checkup suggested in 90 days.

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
- Each organ section: **Symptom** (what you'd notice: "no checks from ASCAP for these songs") → **Cause** → **Treatment** with a link straight to the field (⚠️ + link, never a dead end), and the songs affected.
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

