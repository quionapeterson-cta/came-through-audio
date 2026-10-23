# PLAN — BMI writers with no publisher: ready to register without ticking Self-published · v1

Status: **awaiting approval.**
Source: founder, 2026-10-23 ("writers with no publishers on BMI still get their writers share"). Follows
PLAN-health-hub-reports.md. This changes the shared readiness rules, so it needs approval before any edit (AGENTS.md).

---

## The problem

When a song has no publisher, BMI still pays the writer share, and it pays its writers the publisher share as well,
split in proportion to their shares. The Royalty Health Report and the Embed Metadata info box already say so.

The shared registration check (`registrationCheck` in `src/lib/readiness.ts`) doesn't. For every agency, including BMI,
a song with no publisher counts as **not ready** until **Self-published** is ticked:

> ⚠️ Add the song's publisher, or check Self-published (no publisher).

So a BMI writer with no publisher sees **"Ready to register with BMI" not done** in the checklist and a lower health %,
while the report says the song is fine. The check-in currently gets around this by ticking Self-published when the
user answers "No".

## The change

**Only the BMI check changes.** When no publisher is listed and Self-published isn't ticked:

| Check | Today | After |
| --- | --- | --- |
| **BMI** | ⚠️ missing: "Add the song's publisher, or check Self-published" | ✓ no longer missing. Shows a tip instead: "No publisher: BMI pays you the publisher share too, in proportion to your split." |
| **ASCAP** | ⚠️ missing | unchanged: ASCAP doesn't pay the publisher share to writers, so they still need a publisher or Self-published |
| **The MLC** | ⚠️ missing | unchanged: mechanicals have nothing to do with BMI. The MLC still needs a publisher, or Self-published (self-administered) |
| **SoundExchange** | no publisher check | unchanged |

These still apply to BMI, exactly as today:
- Ticking Self-published **and** listing a publisher is still flagged ("Keep one").
- Any publisher that **is** listed still needs its name, PRO and IPI.
- Saving, embedding and the user's own exports are never held to any of this (unchanged).

**Songs with writers at both BMI and another PRO:** the BMI check covers only the BMI writers. The other PRO's check
still asks its writers for a publisher or Self-published. (A song's checklist has one PRO step today, picked from its
first writer's PRO. That isn't changing here.)

## What follows from it

- **Song Health Checklist, catalog health meter, My Catalog "Ready to register" badge for BMI:** these all read
  `registrationCheck`, so they update with no extra code. BMI-only songs with no publisher reach 100% on that step.
- **Expert Registration Assistance (BMI):** the BMI intake check stops asking for a publisher on these songs. Its
  summary line shows **"Publishers: none, BMI pays the writers"** instead of "—".
- **Check-in:** for songs where every writer is with BMI, "No" just records the answer and **no longer ticks
  Self-published**. For songs with writers at other PROs it ticks Self-published, as it does today.
- **Royalty Health Report:** no change. It already treats these songs as covered.
- **Writer data:** nothing is deleted or rewritten. Songs where the check-in already ticked Self-published keep it.

## Files

- `src/lib/readiness.ts`: the BMI branch of `registrationCheck` (the publisher rule, plus the new tip).
- `src/lib/readiness.test.ts`: BMI with no publisher is ready; ASCAP and The MLC still need one; Self-published plus a
  publisher is still flagged for BMI.
- `src/components/HealthCheckIn.tsx`: "No" on all-BMI songs records the answer instead of ticking Self-published.
- `src/components/ExpertAssistance.tsx`: the "Publishers:" summary line.
- `AGENTS.md`: the BMI line under *Registration assistance* gets "(no publisher needed when every writer on the
  registration is with BMI)".
- No migration, no schema change, no change to writer fields, roles or export templates.

## Questions

1. Should the **BMI / ASCAP cheat sheet** (.csv) fill the empty Publisher column with "None: BMI pays the writers"
   for these songs, or leave it blank as it is today?
