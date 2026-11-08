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

### Every repeatable badge, and the task it repeats on

57 of the 125 live badges repeat: each has `every` set in `src/lib/badges.ts`, so it comes back each time the member does the task again. The numbers are always in the task's own unit (masters, lyrics, split sheets, songs), the shelf shows the earnings as `×N` ("Earned … · 3 times"), and a badge with `repeatPopup` counts out loud ("your 4th…"). Nothing here is new: these are the intervals live today, and retuning one is a product decision (§3.3).

**Came Through** — 14 repeating badges

| Task | Badge | First earning | Repeats every | Art on later repeats |
| --- | --- | --- | --- | --- |
| Ready a song to register | Came Strong | 1 | 1 | Doubled Up → Full Band → The Vault (its own art for the first 10, then one per 10) |
| Seal a song's paperwork | Chain of Title | 1 | 1 | no, the same picture |
| Run a monthly Health Check | Checkup Champ | 1 | 1 | no, the same picture |
| Upload album art | Cover Story | 1 | 1 | the second cover art → the third cover art (its own art for the first 10, then one per 10) |
| Embed a master | Embedded | 1 | 1 | First Note → the vinyl art → the band art (its own art for the first 10, then one per 10) |
| Catalog a full album | Full Album | 1 | 1 | no, the same picture |
| Credit 3+ performers | Full Band | 1 | 1 | no, the same picture |
| Catalog a full EP | Full EP | 1 | 1 | no, the same picture |
| Ready a full EP or album | Full Release | 1 | 1 | no, the same picture |
| Embed your first master | Master Crowned | 1 | 1 | no, the same picture |
| Download an agency export | Paper Ready | 1 | 10 | no, the same picture |
| Sign 10 agreements | Deal Maker | 10 | 10 | no, the same picture |
| Ready 10 songs to register | Doubled Up | 10 | 10 | no, the same picture |
| Store 25 masters | The Vault | 25 | 25 | no, the same picture |

**Lyrics** — 2 repeating badges

| Task | Badge | First earning | Repeats every | Art on later repeats |
| --- | --- | --- | --- | --- |
| Embed a lyric | First Lyric Entry | 1 | 1 | Word Weaver → Lyrical Genius → Lyric Lover → Hook Keeper → Verse Vault (its own art for the first 10, then one per 10) |
| Embed 100 lyrics | Lyrical Legacy | 100 | 100 | no, the same picture |

**Split Sheets** — 3 repeating badges

| Task | Badge | First earning | Repeats every | Art on later repeats |
| --- | --- | --- | --- | --- |
| Collect a signature | High Five | 1 | 1 | no, the same picture |
| Get a split sheet signed | Sealed | 1 | 1 | Fist Bump Deal → Three-Way Collab → Studio Circle → Piggy Bank Split → Hands In (its own art for the first 10, then one per 10) |
| Get 100 splits signed | Written in the Stars | 100 | 100 | no, the same picture |

**Contracts & Blueprints** — 4 repeating badges

| Task | Badge | First earning | Repeats every | Art on later repeats |
| --- | --- | --- | --- | --- |
| Finish a blueprint checklist | Blueprints Checked | 1 | 1 | no, the same picture |
| Fully sign a management or rights deal | Executive Contracts | 1 | 1 | no, the same picture |
| Get a contract signed | Fully Executed | 1 | 1 | no, the same picture |
| Get 75 contracts signed | Executive Legacy | 75 | 75 | no, the same picture |

**Royalty Health** — 2 repeating badges

| Task | Badge | First earning | Repeats every | Art on later repeats |
| --- | --- | --- | --- | --- |
| Get a song 100% healthy | Silver Crown | 1 | 1 | Jeweled Crown → Gold Crown (its own art for the first 10, then one per 10) |
| Get 50 songs 100% healthy | Gold Crown | 50 | 50 | no, the same picture |

**AI Protection** — 4 repeating badges

| Task | Badge | First earning | Repeats every | Art on later repeats |
| --- | --- | --- | --- | --- |
| Protect a song | AI Slayer | 1 | 1 | no, the same picture |
| Protect 10 songs | Time Witness | 1 | 10 | Shield Up → Sound Sealed → Key Keeper (its own art for the first 10, then one per 10) |
| Protect 10 songs | Shield Up | 10 | 10 | no, the same picture |
| Protect 25 songs | Key Keeper | 25 | 25 | no, the same picture |

**Producer** — 2 repeating badges

| Task | Badge | First earning | Repeats every | Art on later repeats |
| --- | --- | --- | --- | --- |
| Self-produce a ready song | Self-Produced | 1 | 1 | no, the same picture |
| Produce 100 songs | Full Gold Beat Machine | 100 | 100 | no, the same picture |

**Live Musicians** — 17 repeating badges

| Task | Badge | First earning | Repeats every | Art on later repeats |
| --- | --- | --- | --- | --- |
| Credit players 100 times | Live Legend | 100 | 100 | no, the same picture |
| Credit a performer on an instrument | Vocal Credit, Steel Pan Credit, Ukulele Credit, Electric Guitar Credit, Guitar Credit, Piano Credit, Drum Credit, Trumpet Credit, Saxophone Credit, Violin Credit, Cello Credit, Banjo Credit, Clarinet Credit, Trombone Credit, Harp Credit, Xylophone Credit (one badge per instrument) | 1 | 5 | no, the same picture |

**Hip-Hop/Rap** — 3 repeating badges

| Task | Badge | First earning | Repeats every | Art on later repeats |
| --- | --- | --- | --- | --- |
| Ready a hip-hop EP or album | Diamond Vinyl | 1 | 1 | no, the same picture |
| Sign splits on a hip-hop song | Iced Dollar | 1 | 1 | no, the same picture |
| Catalog 100 hip-hop songs | Dripping Ice Boombox | 100 | 100 | no, the same picture |

**Spiritual Hip-Hop** — 3 repeating badges

| Task | Badge | First earning | Repeats every | Art on later repeats |
| --- | --- | --- | --- | --- |
| Catalog a spiritual song | Positive Vibes | 1 | 1 | no, the same picture |
| Catalog 5 more spiritual songs | Encourager | 5 | 5 | no, the same picture |
| Catalog 50 spiritual songs | God-Led | 50 | 50 | no, the same picture |

**Night Shift** — 3 repeating badges

| Task | Badge | First earning | Repeats every | Art on later repeats |
| --- | --- | --- | --- | --- |
| Catalog a song 4–6 AM | In the Quiet | 1 | 1 | no, the same picture |
| Catalog 5 songs, 9 PM–12 AM | Marathon | 1 | 1 | no, the same picture |
| Catalog a song 12–4 AM | Midnight Oil | 1 | 1 | no, the same picture |

The instrument credits are generated from `INSTRUMENTS` + `LIVE_STEPS` in `badges.ts`, so a new instrument gets its repeating credit badge as soon as its art and `every: 5` exist; the Medallion (10) and Star-Studded (25) steps above them do not repeat.

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
