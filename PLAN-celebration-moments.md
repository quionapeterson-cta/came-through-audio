# Plan: celebration moments (the skies and what else deserves one)

**Status:** proposal. The three moments in place are approved and built. Nothing else here is approved, and no new sky
is written until the founder picks one from §4. (Founder, 2026-11-06: "lets plan this for big accomplishments … I don't
want to overdo it".)

## 1. What exists today

| Moment | Where | What it is | Repeats? |
| --- | --- | --- | --- |
| Welcome back | Any workspace page, `celebrateReturn` in `src/lib/celebrate.ts` | `Confetti` when the last visit was 30+ days ago | No: once per return, at most every 30 days |
| Checklist finished | Blueprints, `Guides` in `src/components/Contracts.tsx` | `Confetti` + one toast + badge check (`Blueprints Checked`) | Per finished run, on purpose |
| Badge unlocked | `UnlockPopup` in `src/components/Badges.tsx` | The badge, its art and its message | Per badge, and per repeat for repeatable badges |
| **Both defaults set** | `Guides`, `defaultsFinished` + `StarSky rocket` | Full sky, shooting stars, rocket launch, "Zero to one." | Once per browser (`claimDefaultsSky`) |
| **Contract fully signed** | `contract.$partyId.tsx` + `src/components/StarSky.tsx` | Full sky, "It's a done deal!", then the badge check | Once per agreement that reaches fully signed |

So the full-screen sky is used for **two** things, and there are three "big" moments in total once the welcome burst is
counted. That is the point of this document: keep it at that size.

## 2. The bar a moment has to clear

A sky is expensive attention, so a completion may only earn one when **all** of these are true.

1. **Rare or once.** A member meets it once, or at most once a year. Anything they can do weekly is a toast.
2. **Identity-level, not progress.** It changes what the member *is* ("I'm set up", "I'm signed", "I'm released"),
   not what they have ticked.
3. **The member did it.** Not a purchase, not a renewal, not something staff or a webhook completed for them.
4. **It closes a chapter.** There is a before and an after; the next screen is a different kind of work.
5. **It cannot fire twice by accident.** A stored claim (a browser key or a database row) gates it, and a re-render, a
   reload or a second tab must not repeat it.

A sixth, softer test: **does the badge already say it?** If a badge pop-up is going to land on the same event, the sky
turns one moment into two interruptions. The contract sky is the exception only because the founder asked for the sky
*then* the badge, in that order.

## 3. Candidates and verdicts

| Candidate event | Test it fails | Verdict |
| --- | --- | --- |
| A blueprint's checklist finished | 2 (progress), and the badge already fires | No: confetti + badge, as now |
| 5 or 10 blueprints finished | 2 (progress), badgeable | No: badge |
| Time Witness, every 10 certificates | 1 is fine but 6 fails (badge already) | No |
| First song catalogued | 1 fails: a member does this in their first ten minutes | No |
| 10 / 100 songs catalogued | 6 fails: a badge is the right shape | No |
| First contract generated (draft) | 4 fails: a draft closes nothing | No |
| Every signed contract in the vault | 2 fails: it is a count, not a change of state | No |
| First paid plan started / renewed | 3 fails: money moments belong in billing copy, not confetti | No |
| Registration sent to a PRO / The MLC / SoundExchange | 2 fails: one of several, and `registration-submitted` already exists | No |
| First release fully documented (master, cover, lyrics, splits, registered) | 1 and 4 pass, but nothing observes "released" | Not yet: we cannot see distribution, so we would be guessing |
| Returning after 30+ days | Already has its moment (welcome burst) | No new sky |
| **Every blueprint in the library finished at least once** | None of the five fail, and no badge covers it | **Maybe: the only candidate worth a sky** (§4) |
| Account deleted or exported | 3 and 5 fail (not a member action to celebrate) | No |

## 4. The one proposal (undecided)

**"The whole playbook."** The sky fires the first time a member has a finished run of **every** blueprint in
`BLUEPRINT_GUIDES` (24 today, and the list can grow, so the predicate compares against the live list rather than a
number).

- **Why it clears the bar:** it is rare by construction (24 guides, each with a full checklist), it is identity-level
  ("I've actually built the business side"), the member did it, it closes a chapter, and no badge measures it — the
  closest, `blueprints_checked`, counts runs and stays the everyday reward.
- **What it would take:** a pure `allBlueprintsFinished(entries)` next to `defaultsFinished` in `src/lib/workbench.ts`
  with a test; a `claimPlaybookSky()` in `src/lib/celebrate.ts` alongside `claimDefaultsSky`; one more `StarSky` in
  `Guides` after the finish branch, no rocket, line to be written by the founder; nothing new in `badges.ts`, no art,
  no metric.
- **What it must not become:** a second sky on a screen that already shows one, a reward that repeats after "Start
  again", or a reason to celebrate a count.
- **Copy:** undecided. A placeholder line would be "You built the whole thing." — not official until the founder
  approves it.

## 5. The rule this leaves behind

Any future sky is one row in §3 that passes all five tests in §2, is approved by the founder, and reuses `StarSky` and
the `claim…` pattern rather than a second overlay. When in doubt, the answer is a badge or a toast: a member who sees
the sky three times in a week has been trained to skip it.
