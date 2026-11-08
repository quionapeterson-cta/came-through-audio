# PLAN — Every workspace task, its badge and its celebration · v1

Status: **inventory and gaps, read from the code on 2026-11-08** (`badges.ts`, `badge-rules.ts`, and every place a
celebration or a badge check fires). Nothing here is built except where it says built. The two sky changes at the end
are built and type-checked this day.

The rule this file serves (founder, 2026-10-25, PLAN-master-notes §3.7b): **every task earns a badge every time it is
done**, with the milestone badges sitting on top as they are and the art rotating after each 10. 125 badges are live
today; 57 of them repeat, and the full task→badge table for those is in
[PLAN-pamphlets-and-repeatables.md](PLAN-pamphlets-and-repeatables.md).

---

## 1. What "celebration" means in this app

| Celebration | Where it lives | When it fires |
| --- | --- | --- |
| Badge pop-up (`UnlockPopup`) | `src/components/Badges.tsx` | every badge earned, and every repeat — "You Came Through: your 4th …" |
| `×N` on the shelf | `Badges.tsx` | a repeatable badge's earnings, with its earning dates |
| Confetti + toast | `Guides` in `Contracts.tsx` | a blueprint checklist finished top to bottom, then the badge check |
| Rocket sky (`StarSky`, rocket) | `Guides` + `ArtistOnboarding` | both profile defaults finished, or the profile saved with all 12 defaults filled — once per browser |
| Contract sky (`StarSky`, rocket) | `contract.$partyId.tsx` | the one signature that makes an agreement fully signed, then the badge check |
| `StarsAligned` | `MetadataUploader` | the catalog completes; the newest song's title is spelled in stars |
| Welcome burst | `celebrateReturn` | coming back after 30 days or more |
| Toast only | everywhere else | saves, downloads and settings that carry no badge |

## 2. The inventory, by workspace tab

### Embed Metadata and My Catalog

| Task | Badge today | Repeats | Celebration today |
| --- | --- | --- | --- |
| Embed a master | Embedded | every master | pop-up, art rotates each 10 |
| Embed lyrics | First Lyric Entry | every lyric | pop-up, 5-art rotation |
| Upload cover art | Cover Story | every upload | pop-up, 3-art rotation |
| Save your first song | First Note | once | pop-up |
| Credit a vocalist | Mic Check | once | pop-up |
| Credit 3 or more performers on a song | Full Band | every such song | pop-up |
| Credit an instrument | Vocal / Guitar / Piano / … Credit | every 5 credits | pop-up |
| 25 performer credits on any instrument | Session Hero | once | pop-up |
| Produce a song (you in Produced by) | Cobalt → Platinum → Gold Beat Machine | milestones 1/5/10/25/50/100 | pop-up; 100 repeats every 100 |
| Self-produce a Ready song | Self-Produced | every one | pop-up with an art choice |
| A song becomes Registration Ready | Came Strong | every song | pop-up |
| 10 songs Ready | Doubled Up | every 10 | pop-up |
| Download an agency export | Paper Ready | every 10 | pop-up |
| Embed and download a master | Master Crowned | every master, and every full album of WAVs | pop-up |
| A full EP / a full album | Full EP / Full Album | every one | pop-up |
| Every song Ready, 10 or more | Catalog Complete | once | `StarsAligned` + pop-up |
| 10 / 25 / 50 / 75 / 100 hip-hop tracks | Cobalt Boombox → Dripping Ice Boombox | ladders; 100 every 100 | pop-up |
| A hip-hop split fully signed | Iced Dollar | every such song | pop-up |
| A hip-hop EP or album Ready | Diamond Vinyl | every one | pop-up |
| A spiritual track | Positive Vibes | every track | pop-up |
| Every 5 / 50 spiritual tracks | Encourager / God-Led | every 5 / every 50 | pop-up |
| 5 songs in one night, 9 PM–12 AM | Marathon | every such night | pop-up |
| A song 12–4 AM | Midnight Oil | every such night | pop-up |
| A song 4–6 AM | In the Quiet | every such morning | pop-up |

### Split Sheets

| Task | Badge today | Repeats | Celebration today |
| --- | --- | --- | --- |
| Create a split sheet | Fist Bump Deal | once | pop-up |
| A split sheet signed by everyone | Sealed | every sheet | pop-up, 5-art rotation |
| 3+ / 4+ collaborators signed | Three-Way Collab / Studio Circle | once each | pop-up |
| Every signature you receive | High Five | every signature | pop-up |
| 10 / 25 / 50 signed sheets | Piggy Bank Split / Hands In / Payout Explosion | milestones | pop-up |
| 100 signed sheets | Written in the Stars | every 100 | pop-up |

### Contracts & Blueprints

| Task | Badge today | Repeats | Celebration today |
| --- | --- | --- | --- |
| Read a blueprint guide | Blueprint | once | pop-up |
| Finish a blueprint checklist | Blueprints Checked | every finished run | Confetti + toast + badge check |
| Finish both profile default blueprints | **none** | — | rocket sky, once per browser |
| Draft a contract | Read the Fine Print | once | pop-up |
| Send a contract for signature | Cross Your T's | once | pop-up |
| A contract signed by every party | Fully Executed | every contract | contract sky (names + rocket), then pop-up |
| A Management or Rights & Distribution deal signed | Executive Contracts | every such deal | pop-up |
| 3 / 5 / 10 / 25 / 35 / 50 signed contracts | Secure the Structure → Executive Suite | milestones | pop-up |
| 75 signed contracts | Executive Legacy | every 75 | pop-up |

### Royalty Health

| Task | Badge today | Repeats | Celebration today |
| --- | --- | --- | --- |
| Run a Royalty Health Check | Checkup Champ | once a month | pop-up |
| A song reaches 100% healthy | Silver Crown | every song | pop-up (unchanged — founder, 2026-11-08) |
| 25 / 50 healthy songs | Jeweled Crown / Gold Crown | milestones; 50 every 50 | pop-up |
| Writers complete, splits 100%, a signed sheet and a timestamp on one song | Chain of Title | every song | pop-up |
| A whole release Ready | Full Release | every release | pop-up |

### AI Protection

| Task | Badge today | Repeats | Celebration today |
| --- | --- | --- | --- |
| Complete a certificate | AI Slayer | every certificate | pop-up |
| Every 10 protected songs | Time Witness / Shield Up | every 10 | pop-up |
| 25 protected songs | Key Keeper | every 25 | pop-up |
| First Bitcoin-timestamped certificate | Sound Sealed | once | pop-up |

### Profile, account and seats

| Task | Badge today | Repeats | Celebration today |
| --- | --- | --- | --- |
| Set up your profile | Genesis Crown | once | pop-up |
| Save the profile with all 12 defaults filled | **none** | — | rocket sky, once per browser |
| 1–5 years as a member | Unbreakable · N Years | once each | pop-up |
| Get a collaborator to sign | Key Holder | once | pop-up |
| 10 signed agreements (sheets + contracts) | Deal Maker | every 10 | pop-up |

## 3. Tasks with no badge at all — the ones to add

Nothing on this list has a metric in `badge-rules.ts`, so no badge can fire however often it is done. Each needs the
founder's art and a `BadgeDef` through Admin → Badges → Badge Protocol, and then a metric that counts it.

| Task | Where it is done | Why nothing fires | What a badge needs |
| --- | --- | --- | --- |
| Save the profile with all 12 defaults filled | Profile / setup | `profileFilled` only opens the sky | art + a "defaults complete" metric |
| Finish both profile default blueprints | Blueprints | `defaultsFinished` only opens the sky | art + a metric for the pair |
| Download the whole catalog as a ZIP | My Catalog | no event is logged for the download | art + a download metric |
| Download one album or EP as a ZIP | My Catalog | same | art + a download metric |
| Download a Royalty Health Report | Royalty Health | no event | art + a report metric |
| Fill & sign a PDF | PDF Fill & Sign | no event | art + a metric |
| Save a brand kit | Profile → Brand kit | no event | art + a metric |
| Add a logo version or save a palette | Profile → Brand kit | no event | only if you want it |
| Generate promo captions | workspace | no event | only if you want it |
| Invite a seat / add another artist | Profile | no event (Key Holder waits for a *signature*, not an invite) | art + an invite metric |
| Re-embed / replace a master | My Catalog | no event | only if you want it |
| Submit a song for registration assistance | Registrations | no member-facing badge | your call |
| **"100% embed"** (your words) | — | nothing measures it yet; the closest are Came Strong (a Ready song) and Chain of Title (writers + splits + signed sheet + timestamp) | your definition first, then a metric |

## 4. Already covered by the four you named

- **Every lyric added** — First Lyric Entry, `every: 1`, with five rotation arts; the pop-up counts "your Nth lyric".
- **100% blueprints** — Blueprints Checked, `every: 1`, one earning per finished run.
- **100% royalty health** — Silver Crown, `every: 1` per 100% song; its celebration stays exactly as it is.
- **100% embed** — not defined yet, so not built: see the last row of §3.

## 5. The two skies, as changed on 2026-11-08 (built)

- **Embed defaults + Catalog Defaults 100%**: the title is that line, in Poppins; the encouraging line underneath is
  unchanged ("Both of your defaults are set, so every master you embed and every song you catalog starts finished."),
  and the rocket still lifts. The sky no longer waits for a catalogued song to name, because the title is fixed now.
- **Every party signed**: the title is the signers' own names, one after another with " X " between them (Karma Came X
  Cardi B X Nicki Minaj), "It's a done deal!" sits underneath, and the rocket lifts here too.
- **The 100% healthy song celebration is untouched** (founder, 2026-11-08).
- Only the line changed in either sky: the star field, the shooting stars, the rocket and every timing are as approved.

## 6. Your decisions, 2026-11-08

These supersede the guesses in §3 where the two disagree.

1. **Defaults finished** — award `cta-double-protection-trophies.png` at the sky moment, and again when a song entry is
   filled 100%. Yes, the blueprints are the two profile defaults in the **Blueprints** section (`embed-defaults` and
   `catalog-defaults`), so #2 in §3 was the same task and needs no second badge.
2. **Whole-catalog ZIP** — confetti the first time only.
3. **Album / EP ZIP** — confetti the first time only.
4. **Royalty Health Report download** — confetti the first time only.
5. **Fill & Sign a PDF** — confetti the first time only.
6. **Brand kit** — confetti plus `brand_kit_512x512.webp`, one earning per purchased kit unlocked after the payment
   succeeds.
7. **Seat invites** — one earning per person invited, and one more when the invite is accepted.
8. **Re-embedding a master** — skipped.
9. **Registration assistance submission** — a badge that rotates `dripping_ice_boombox` and `cta_chain_medallion`.
10. **100% embed** — `song_embedded_512x512.webp`, one earning per embed.
11. **Lyrics** — `lyric_locked_gold_512x512.webp` on the lyric-entry badge. **100% royalty health** —
    `100_Royalty_Health.webp` rotating with `100_Royalty_Health_Fully_Matched.webp`. Its celebration is untouched.

## 7. What is built, and what waits on a picture

Built and pushed in this change:

- The four first-time confetti moments: the whole-catalog ZIP, a release ZIP, the Royalty Health Report and a
  filled-and-signed PDF (`claimFirstBurst` in `src/lib/celebrate.ts`, `burstConfetti` in `Confetti.tsx`).
- **Registration Runner** (`registration_submitted`): one earning per song submitted for Expert Registration Assistance,
  counted from `registration_songs.submitted_at`, art alternating between `dripping_ice_boombox` and
  `cta_chain_medallion` on every earning (`alternate` on a `BadgeDef`, read by `rotationArt`).

## 8. Built on 2026-11-08, second pass (every item approved)

- **Double Protection** (`double_protection`, `serious/cta-double-protection-trophies.png`): one earning for both profile
  defaults filled — the rocket-sky moment, now titled **Embed defaults & Catalog Defaults 100% Filled!** — and one more
  for every song entry finished 100% (master and cover art in, Registration Ready). One blueprint finished on its own
  keeps its confetti and Blueprints Checked; the sky still waits for both.
- **Kit On File** (`brand_kit_bought`, `playful/brand_kit_512x512.webp`): one earning per brand kit bought, counted from
  the non-refunded `purchases` rows of kind `branding`, plus confetti the first time the purchase return opens.
- **Set of Keys** (`seat_keys`, `serious/key_holder.png`): a key for every seat invited and another for every seat the
  artist accepts, counted from `artist_seats`.
- **Fully Matched** (`health_report_matched`, `playful/100_Royalty_Health_Fully_Matched.webp`): one earning per month
  whose health check found every song 100% healthy.
- **Embedded** now wears `playful/song_embedded_512x512.webp` for every master embedded, **First Lyric Entry** wears
  `playful/lyric_locked_gold_512x512.webp` on **every** earning with no rotation left on it (the 5, 10, 15, 25, 40, 50 and
  100 lyric milestones keep their own art as separate badges), and **Silver Crown** wears
  `playful/100_Royalty_Health.webp` with no rotation (founder, 2026-11-08). Its celebration is unchanged.
- Those five pictures live in R2 only, so `artInBucket` is set on their badges and `badge-rules.test.ts` names each one;
  their tiles are blank in local dev and tests until a 512px copy is added to `public/icons/playful/`.
- Two measurements are mine, not yours, and are easy to change: a "finished song entry" is master + cover art +
  Registration Ready, and "100% healthy report" is a check month where every song is healthy.
