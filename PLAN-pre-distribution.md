# PLAN — Pre-distribution health analysis · v1

Status: **✅ Approved and BUILT 2026-10-25** (founder: yes to all 4; "clear distinction with the sections and colors": the release checklist is its own dashed Cobalt box with a black PRE-RELEASE label, also on the song list, the catalog meter line and the report). The release-day email is a one-time note per song (no unsubscribe needed; it never repeats). No database change.
Source: founder idea, 2026-10-25 (PLAN-master-notes "NEXT (after Phase 3)").

## The idea in one line
A song that isn't out yet gets a **Release checklist** ("Ready to distribute: 7 of 10") instead of being marked down for
things only a released song can have. On release day it switches to the normal Royalty Health reading.

## 1. How a song counts as "not released yet"
- Automatic: its release date is in the future.
- Or by hand: a new box in the song's Release section, **This song isn't released yet**, for songs with no date picked.
- On the release date (or when they untick the box) it becomes a released song.

## 2. The Release checklist (Song Health Checklist, for unreleased songs)

| # | Item | Done when | Why before release |
| --- | --- | --- | --- |
| 1 | Writers and roles | Every writer has a legal name and role, author and composer covered (the shared readiness check) | Registrations and split sheets need them |
| 2 | Splits settled | Writer splits total 100%; publisher shares 100% if any | Agencies reject anything else |
| 3 | Split sheet signed | A fully signed split sheet for the song | Settles ownership before money arrives |
| 4 | PRO + IPI | Each writer's PRO and IPI, or marked "not with a PRO yet" | So the PRO can match it |
| 5 | ISRC | Filled in | Your distributor asks for it (or assigns one); stores match recordings by it |
| 6 | UPC | Filled in, or "my distributor will assign it" | Needed for the release itself |
| 7 | Master embedded and stored | Tagged master in My Catalog | Every copy you send carries your credits |
| 8 | Artwork and lyrics | Cover stored; lyrics added (or Instrumental) | Stores and lyric sites ask for them |
| 9 | Registered with your PRO | Ticked, or the PRO search finds it | PROs accept songs before release, so plays count from day one |
| 10 | Registered with The MLC (or your mechanical society) | Ticked or found | Same: on file before the first stream |
| Optional | AI Protection certificate | Issued | Proof of creation dated before the song is public |
| After release | SoundExchange | Waits for the release date, never counted against the song | Recordings register once they're out |

- Each item links straight to the field or action that finishes it (⚠️ + link, as everywhere else).
- Items 1, 2 and 4 come from the shared readiness module (registrationReadiness), never re-checked separately.

## 3. Royalty Health Report
- Unreleased songs get a **Pre-distribution reading** section at the top of their report: the checklist above with
  ✓ / ⚠️, the organ pictures stay calm (no broken organs) for anything that only applies after release.
- "Not found in the PRO / MLC" for an unreleased song reads as a to-do ("Register now so it's on file before release"),
  not a problem.

## 4. Catalog health score
- Unreleased songs show in their own line under the meter: **"2 songs getting ready: 70% ready to distribute"**.
- They don't pull down the registered score until their release date; their details still count.

## 5. Release day
- On the release date the song switches to the normal reading automatically.
- Optional email that morning: "Your song is out. Next: register it with SoundExchange and check your PRO found it."
  Sent from the existing daily reminders job, once per song, with an unsubscribe link.

## 6. Files (no database change; the new box lives in the song's details)
`src/lib/metadata.ts` (unreleased flag), `src/lib/release-checklist.ts` (new, uses readiness.ts), `health.ts`,
`health-checklist.ts`, `royalty-checkup.ts`, `HealthChecklist.tsx`, `RoyaltyReport.tsx`, `HealthMeter.tsx`,
`MetadataUploader.tsx`, `registration-reminders` cron (release-day email), tests.

## Questions
1. Detect unreleased songs both ways (future date + the box)? *Recommended: yes.*
2. Keep unreleased songs out of the registered score until release, with their own "getting ready" line? *Recommended: yes.*
3. Send the release-day email? *Recommended: yes, once per song.*
4. Anything to add to or drop from the 10 checklist items?
