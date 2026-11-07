# PLAN — Pamphlets, repeatable badge art, and what is already built · v1

Status: **pamphlet rollout and repeatable art are proposals; the admin side below is built and live.** Nothing here
changes a number, a price or a promise. (Founder, 2026-11-07: "What about all of the plans for the repeatable badges and
the new pamphlets? Lets build those out.")

---

## 1. Already built — no approval needed, nothing to do

Checked in code on 2026-11-07, not from memory.

| Thing the founder asked about | Where it lives | State |
| --- | --- | --- |
| Admin → Badges | `src/routes/admin.tsx` (badges tab) | Built: `BadgeSwitchboard` + `BadgeProtocolPanel`, gated by `public.can_manage_badges` |
| Substitute a badge's art without a deploy | `ArtReplace` in `BadgeSwitchboard.tsx`, `setBadgeArt` in `badges.functions.ts`, table `public.badge_art` (migration `20261106150000`) | Built: founder-only (`public.is_founder`), server-validated path, read by `checkBadges` / `listBadgeSettings` and used by the shelf and the unlock pop-ups |
| Click any badge art to see it full size | `PeekDialog` + `Thumb` in `BadgeSwitchboard.tsx` | Built: every picture is the button, opens at 288 px on the app's own dark surface with the art key, the repeat rule and an "art still to come" warning |
| Repeatable badges in one place | `Repeatable` in `BadgeSwitchboard.tsx` | Built: every badge with `every`, its first goal, its interval, how many members hold it, and its own art control |
| The badge protocol (submit → approve → upload) | `BadgeProtocolPanel.tsx` + `badge-submissions.functions.ts` + migration `20261105120000` | Built: staff submit with art, founder/super admin decides, private bucket, signed links, founder seat claimed once |
| ×N repeat count on the member side | `src/components/Badges.tsx` (shelf count, popup, `Earnings`) | Built: `×3` on the badge, "Earned … · 3 times", and the full earning history |
| Pamphlets | `pamphlet` in `src/lib/guides.ts`, `Pamphlet` pop-up in `Contracts.tsx`, `guide-pdf.ts` | Built for **2 of 24** blueprints: royalty-registration and copyright-protection |

So the shape is done. What follows is the content and the art that goes into it.

## 2. Pamphlet rollout — the 22 guides still without one

A pamphlet is the long-form read behind the numbered steps, not more steps: the steps stay the quick list, the pamphlet
carries the "why" and the detail a first-timer needs. Order chosen by consequence, not alphabet:

**Tranche 1 — money and ownership (a mistake here costs real money)**
1. `release-distribution` — **written (this change)**: the runway, the ISRC/UPC, paperwork before upload, the 7- and 28-day review.
2. `music-business-startup` — entity, bank, bookkeeping, the first year of costs.
3. `publishing-company` — publisher vs administrator, the writer's share vs the publisher's share.
4. `record-label` — master ownership, the label as a business, what a label actually does for an artist.

**Tranche 2 — paperwork and people**
5. `sync-licensing` — one-stop vs split licences, master use vs sync, what a supervisor needs from you.
6. `booking-touring` — deposits, riders, the settlement sheet, why the guarantee is not the pay.
7. `finance-funding` — royalties as collateral, what a distributor advance really costs.

**Tranche 3 — the craft and the audience**
8. `recording-workflow` · 9. `artist-branding` · 10. `marketing-fanbase` · 11. `video-production` ·
12. `brand-partnerships` · 13. `fashion-image`

**Tranche 4 — the rest**: `production-business`, `systems-automation`, `career-wealth`, and the profile-defaults
blueprints (`embed-defaults`, `catalog-defaults`) only if a founder review shows the steps are not enough on their own.

Rules that hold for every one of them:

- **Steps stay short.** A paragraph that explains rather than instructs belongs in the pamphlet (AGENTS.md).
- **No invented figures.** No fee, percentage, deadline or "typical" payout goes in a pamphlet unless the founder has
  approved that exact value. Where a number is genuinely the reader's to find, say where to find it.
- **No legal advice.** "Talk to a music attorney before you sign" stays the ending of anything with a dispute in it.
- **Every numbered step keeps a checklist item** — the existing test in `guides.test.ts` fails otherwise.
- A pamphlet is optional: a guide that is genuinely a checklist does not get padding.

## 3. Repeatable badge art — the open half of the repeatables

The mechanics are built (`every`, `×N`, the Repeatable section, per-badge art replacement). Three things are not:

1. **A second picture per repeat is not wired for most badges.** `rotationArt` and `choices` exist, so a badge can show
   different art at different counts, but today only the producer badge offers a choice and only Cover Story has rotation
   art planned. Proposal: add `forTimes` art lists to `BadgeDef` for the badges where a repeat deserves a visibly
   different trophy (Full Album, Marathon, Chain of Title), and keep one picture for the rest so the shelf stays readable.
2. **The placeholder art in `PLAN-badge-art-placeholders.md` is still placeholder** for the repeatable set (Steel Pan and
   the instrument credits, Cover Story rotations 2 and 3, Unbreakable 2–5). Those need the founder's art, then a key
   recorded in Admin → Badges — no code change.
3. **A repeatable's interval is data, not a plan.** Every `every` value in `badges.ts` is live today; changing one is a
   product decision, so a proposal to retune them (for example making the 100-song badges repeat at 50) waits for an
   explicit yes, and is listed in `PLAN-pricing-badges.md` rather than slipped in here.

## 4. Celebration moments — one decision outstanding

The three firings (both defaults, the 100% profile save, the fully signed contract) are built and approved, and the sky
now writes its line in stars. `PLAN-celebration-moments.md` holds the gate and the single candidate that passes it: the
**whole playbook** sky, when every blueprint in `BLUEPRINT_GUIDES` has one finished run.

It is waiting on two founder answers, and nothing is built before them:

1. **Does it get a sky at all?** (The alternative is a badge, which is cheaper attention.)
2. **What does it say?** The placeholder "You built the whole thing." is not official.

If both are answered yes, the build is small and already shaped: `allBlueprintsFinished(entries)` beside
`defaultsFinished` with a test, `claimPlaybookSky()` beside `claimDefaultsSky`, one more `StarSky` in `Guides` with no
rocket, and no change to `badges.ts`, no art, no metric.

## 5. Order of work

1. Tranche 1 pamphlets (1–4), one per change, each with its guides test green.
2. `forTimes` art lists for the repeat badges that earn it, once the founder picks which ones.
3. The playbook sky, only after §4's two answers.
