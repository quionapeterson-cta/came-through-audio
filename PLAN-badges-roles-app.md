# PLAN — Badge & award system · v1 (for approval)

Status: **v1 built 2026-10-20 (a476467); round 2 built 2026-10-20 (8940b29: recurring badges, High Five, Self-Produced, new pop-up, ×N counts, earning dates, badge-drop reminder). Unbreakable 2–5, Full EP and Full Album wait for art.**
(the other items queued in v0) are at the bottom and follow once badges are approved.

The point of every badge: **reward people for handling their music business.** Each one is earned from real work
already saved in the app (catalog, embeds, split sheets, contracts, health checks, timestamps), never from clicking around.

---

## 1. Turning badges on and off

**Users (Profile → Awards & Badges → Badge settings).** Badges are never deleted and never stop being earned; the
settings only control what the user *sees*.

| Setting | Choices | Default |
| --- | --- | --- |
| Celebrations (pop-up, badge rain) | All · Big moments only (MEGA & Ultimate) · Off | All |
| "Next badge" progress hints in Embed, Catalog and Health Check | On · Off | On |
| Collections | Hide collections that don't fit you (e.g. Live Musicians, Hip-Hop, Spiritual Rap) | Set from the music role and genre picked at onboarding |
| Show badges on my share cards and public profile | On · Off | On |

- **Quiet earning:** with celebrations off, badges still unlock silently. When the user turns them back on they get
  one "While you were away, you earned 4 badges" summary, not four badge storms in a row.
- **Reduced motion:** if the phone or computer asks for less motion, the pop-up still shows the badge and its message,
  but the rain and burst are skipped. This is automatic (WCAG 2.2), not a setting.

**Staff (Admin → Badges).** Staff can switch any badge or whole collection on or off for the site (seasonal,
retired, sponsored, or art being replaced). Switching a badge off stops new unlocks only; anyone who already earned it
keeps it on their shelf.

---

## 2. How badges work (behind the scenes)

- **One badge list, one place:** `src/lib/badges.ts` holds every badge: title, collection, tier, milestone, rule,
  description, pop-up message and art path. Profile shelf, pop-ups, progress hints and share cards all read from it.
- **Tiers:** Standard · Instant Win (first-time badges) · MEGA · Ultimate. MEGA and Ultimate get the biggest celebration.
- **Earned on the server, not the browser.** A badge is recorded in a new `user_badges` table only after the server
  re-counts the user's real data. Users can't hand themselves badges, which matters once sponsored badges unlock
  discount codes (same safeguard as paid access).
- **Never taken away.** Deleting a song later does not remove a badge already earned.
- **Time-of-day awards** use the user's own time zone (saved from their browser), so Midnight Oil means midnight *for them*.
- **Personal touch:** pop-ups can use the user's artist name, e.g. "This is huge, {artist}." No fixed names or
  gendered words, so every message fits every user.
- **Voice (BRANDING.md §4):** lead with "Came Through" and YOUR FIRST STOP BEFORE DISTRIBUTION. Crowns appear only
  now and then: Genesis Crown, the three Royalty Health crowns and Lyrical Legacy's "crown on".
- **Next-milestone previews:** while embedding, cataloging and running health checks, a small chip shows the next
  badge and progress ("3 more lyrics to Lyric Lover"). Clicking it opens the badge, locked, with its milestone.

---

## 3. Your lyric copy: suggested edits (preview)

"Lyric entry" = a song in the catalog with lyrics saved. Each song counts once.

| # | Badge | What changes | Before | After |
| --- | --- | --- | --- | --- |
| 1 | First Lyric Entry | Brand name | Welcome to Came Through | Welcome to Came Through Audio |
| 1 | | "Instant Win" moves to the tier label, so the title is just **First Lyric Entry** | | |
| 5 | Hook Keeper | Keeps the count consistent | 25 hooks means… | 25 lyrics means… |
| 6 | Brain to Diamond | Reads as a personal note, every user sees it | This is THE ONE. Your favorite for a reason. | This is the big one. |
| 6 | | Fixed name in pop-up | This is huge, Karma. | This is huge, {artist}. |
| 6, 8 | | "MEGA Accomplishment" / "Ultimate Boss" become tier labels; titles stay **Brain to Diamond** and **Lyrical Legacy** | | |
| 8 | Lyrical Legacy | Gendered word in pop-up | crown on, queen. | crown on, {artist}. |

Everything else stays exactly as you wrote it. Art: the old `serious/lyrical_genesis.png` duplicates First Lyric
Entry, so it is retired once the new lyric art is in `public/icons/playful/lyrics/`.

---

## 4. Full badge catalog (draft copy, written in the lyric badges' voice)

Format: **Title** · tier · milestone — description — *pop-up*.

### 4.1 Came Through (core business)

1. **Genesis Crown** · Instant Win · profile set up (already live) — Every empire starts with a name on the door. You
   set up your profile and claimed your spot. From here on, everything you build has your name on it. — *"You came through! Your profile is live and your story starts now."*
2. **First Note** (`bedazzled_note`) · Instant Win · 1st song saved to your catalog — One song, filed and safe. Most artists never write
   down what they own. You just did. Your first stop before distribution, handled. — *"First note logged! Your catalog is officially open."*
3. **Master Crowned** (`master_crowned`) · Instant Win · 1st master embedded and downloaded — Your credits now travel inside the file.
   Wherever this master goes, your name goes with it. That's how you get found and get paid. — *"Came through! Your credits ride with every play."*
4. **Mic Check** (`bedazzled_mic`) · 1st song crediting a vocalist — The voice got its credit. Naming who sang it means
   nobody gets left out of the story or the royalties. — *"Mic check! Every voice on this record is on the record."*
5. **Came Strong** (single trophy, `came_strong_gold`) · 1st song Registration Ready — Writers named, roles set, nothing
   missing. This song is ready to register and ready to collect. You came through for it. — *"Came strong! Your first song is ready to register."*
6. **Came Double** (two trophies, `came_crown_gold`) · 10 songs Registration Ready — Ten songs with nothing missing.
   You're not hoping the money finds you, you're making sure it does. — *"Double up! 10 songs ready to collect."*
7. **Key Holder** (`key_holder`) · 1st collaborator joins from your invite — You opened the door and someone walked in.
   Good business is built with people you trust, and you just handed out the first key. — *"Key handed over! Your first collaborator is in."*
8. **Time Witness** (`time_witness`) · 1st song timestamped on Bitcoin — The clock saw it. You now have proof this file existed on this date, sealed where nobody can change it. — *"Witnessed! Your song's timestamp is locked in."*
9. **Shield Up** (`award_shield`) · 10 songs with AI protection — Ten songs guarded in the AI Protection Hub. You
   protect what you make before anyone else gets ideas. — *"Shield up! 10 songs protected."*
10. **Paper Ready** (`award_folder`) · 1st agency export — Your songs left the building in the format the agencies
    want. This is the paperwork that turns plays into payments. — *"Exported! Your songs are on their way to get paid."*
11. **Checkup Champ** (blue handshake, `award_certificate`) · 1st Royalty Health Check — You looked at your money
    instead of guessing. Every fix you make from here is money you were missing. — *"Checkup done! Now you know where your money is."*
12. **Chain of Title** (crossed chains, `came_double_gold`) · 1st song with writers complete, splits at 100%, a fully
    signed split sheet and a timestamp — Every link is in place. Who wrote it, who owns what, signed and dated. This
    is what a bulletproof song looks like. — *"Unbreakable chain! This song's paperwork is airtight."*
13. **Full Band** (`bedazzled_band`) · 1st song crediting 3+ performers — Everybody on the stage got their name on
    the record. Credit where it's due is how musicians keep getting called back. — *"Full band! Every player got their credit."*
14. **The Vault** (`vault`) · 25 masters stored in your catalog — Twenty-five masters, locked and organized in one
    place. No more digging through old drives and inboxes. — *"Vault sealed! 25 masters safe and sound."*
15. **Full Release** (`bedazzled_vinyl`) · 1st EP or album where every track is Registration Ready — A whole project,
    nothing missing on any track. That's a release run like a real label. — *"Came through for the whole project! Every track is ready to collect."*
16. **Deal Maker** (`handshake_diamond_watch`) · MEGA · 10 signed agreements (split sheets and contracts together) —
    Ten deals signed and on file. You handle business like a boss, and everyone who works with you knows where they stand. — *"MEGA! 10 deals signed. Boss moves."*
17. **Catalog Complete** (`catalog_complete`) · Ultimate · every song in your catalog Ready (10 songs or more) — Not
    one loose end. Every song you own is credited, organized and ready to collect. Most catalogs never get here. Yours did. — *"ULTIMATE! You came through for every song you own."*
18. **Unbreakable** (`unbreakable`, "1 YEAR") · 1 year as a member, then every year after — A full year of showing up
    for your music business. Consistency is the chain that holds everything else together. — *"Unbreakable! One year strong."*

### 4.2 Royalty Health crowns (healthy songs from the Royalty Health Check)

19. **Silver Crown** (`silver_tiara`, name approved) · 10 songs at 100% healthy — Ten songs with every royalty door open. You fixed
    what most people never even check. — *"Silver crown! 10 healthy songs."*
20. **Jeweled Crown** (`cross_crown`) · MEGA · 25 songs at 100% healthy — Twenty-five songs collecting from every
    direction. Every one of them came through. — *"MEGA! 25 healthy songs. Jewels earned."*
21. **Gold Crown** (`king_crown`) · Ultimate · 50 songs at 100% healthy — Fifty songs, fully healthy, fully
    collecting. This is the crown for people who leave no money on the table. — *"ULTIMATE! 50 healthy songs. Wear the gold."*

### 4.3 Night shift (time-of-day)

22. **Marathon** (`marathon`) · 5 songs completed in the catalog between 9 PM and midnight, same night (repeatable) — Five songs in one night. While everyone else was winding down, you were building. — *"Marathon! 5 songs in one night. Hustle."*
23. **Midnight Oil** (`midnight_oil`) · a catalog entry completed between midnight and 4 AM — The world's asleep and
    you're still handling business. Late nights build early wins. — *"Midnight oil! Still grinding at 2 AM."*
24. **In the Quiet** · first catalog entry between 4 AM and 6 AM — **needs art.** Before the sun, before the noise,
    you showed up for your music. The quiet hours are where real work happens. — *"In the quiet. You beat the sunrise."*

### 4.4 Lyrics (your copy, section 3)

First Lyric Entry 1 · Word Weaver 5 · Lyrical Genius 10 · Lyric Lover 15 · Hook Keeper 25 · Brain to Diamond 40 (MEGA) ·
Verse Vault 50 · Lyrical Legacy 100 (Ultimate).

### 4.5 Split sheets (fully signed = every collaborator signed)

25. **Fist Bump Deal** (`fist_bump_deal`) · Instant Win · 1st split sheet created — The conversation most artists
    avoid, you started it. Splits on paper before the song blows up is how friendships survive. — *"Deal! Your first split sheet is started."*
26. **Sealed** (`fist_pump_sealed_blue`) · 1st split sheet fully signed — Everyone signed. No "I thought we said…"
    later. This song's money has a map. — *"Sealed! Your first split sheet is signed by everyone."*
27. **Three-Way Collab** (`three_way_collab`) · 1st signed split sheet with 3+ writers — Three minds, one song, zero
    confusion. You made sure everyone in the room gets paid. — *"Three-way! Every writer's share is on paper."*
28. **Studio Circle** (`studio_circle_clean`) · 1st signed split sheet with 4+ writers — A full circle of creators and
    every share accounted for. Big sessions need big organization, and you brought it. — *"Studio circle! 4+ writers, all settled."*
29. **Everyone Gets Paid** (`everyone_gets_paid`) · 5 split sheets fully signed — Five songs where nobody gets left out.
    That's your reputation being built: fair, clear and on paper. — *"Everyone gets paid! 5 split sheets sealed."*
30. **Piggy Bank Split** (`piggy_bank_split`) · 10 split sheets fully signed — Ten songs with the money already divided
    fairly before the first check arrives. That's how you save the music and the friendships. — *"Piggy bank! 10 split sheets signed."*
31. **Hands In** (`four_hand_packed_clean`) · MEGA · 25 split sheets fully signed — Twenty-five times everyone put their
    hand in and signed. People trust working with you. — *"MEGA! 25 split sheets. Hands in!"*
32. **Payout Explosion** (`payout_explosion_cta`) · 50 split sheets fully signed — Fifty songs with every payout
    mapped. When the money comes, it knows exactly where to go. — *"Payout explosion! 50 split sheets sealed."*
33. **Written in the Stars** (`constellation_collab`) · Ultimate · 100 split sheets fully signed — One hundred songs,
    every share signed and sealed. Your collaborations are written in the stars and on paper. — *"ULTIMATE! 100 split sheets. Written in the stars."*

The `_hero`, `_join_us`, tagline and v2/v3 variants become share-card and marketing art, not separate badges.

### 4.6 Contracts & Blueprints

34. **Blueprint** (`blueprint_contract`) · Instant Win · 1st blueprint guide read to the end — Knowledge first. You
    learned what's in the deal before anyone handed you a pen. — *"Blueprint unlocked! You know the layout now."*
35. **Read the Fine Print** (`fine_print`) · 1st contract drafted — You wrote the terms instead of just accepting
    someone else's. That's a power move. — *"Fine print read! Your first contract is drafted."*
36. **Cross Your T's** (`cross_your_ts`) · 1st contract sent for signature — Terms clear, names right, sent out. You
    handle business the way it's supposed to be handled. — *"T's crossed! Your contract is out for signature."*
37. **Blueprints Checked** (`blueprints_checked`) · 1st contract fully signed — Signed by every party. Your agreement
    is real, on file and protecting you. — *"Checked! Your first contract is fully signed."*
38. **Secure the Structure** (`secure_structure`) · 3 contracts fully signed — Three agreements holding your business
    up. Structure is what lets creativity run free. — *"Structure secured! 3 contracts signed."*
39. **Terms Architected** (`terms_architected`) · 5 contracts fully signed — You're not just signing deals, you're
    designing them. Five agreements built your way. — *"Architect! 5 contracts signed."*
40. **Crossin' Your T's** (`crossin_your_ts_ultra`) · 10 contracts fully signed — Ten deals with every detail handled.
    Nobody can say you didn't read it. — *"Crossin' them all! 10 contracts signed."*
41. **Dottin' Your I's** (`dottin_your_i_ultra`) · MEGA · 25 contracts fully signed — Twenty-five agreements, every
    dot and cross in place. That's executive energy. — *"MEGA! 25 contracts. Every I dotted."*
42. **Executive Suite** (`bedazzled_v2`) · Ultimate · 50 contracts fully signed — Fifty signed agreements. You run your
    music like a company because it is one. — *"ULTIMATE! 50 contracts. Welcome to the executive suite."*

`bedazzled_v1` and `bedazzled_v3` look like alternates of v2: keep as spares or remove as duplicates?

### 4.7 Producer (songs where you're in "Produced by")

43. **Cobalt Beat Machine** · Instant Win · 1 song — Your first produced record is on file with your name on it. The
    beat is yours, and now the paperwork says so. — *"First beat logged! Producer credit secured."*
44. **Platinum Beat Machine** · 5 — Five productions credited. You're building a sound people can trace back to you. — *"5 beats credited. Platinum moves."*
45. **Platinum Cobalt Beat Machine** · 10 — Ten records with your production credit. That's a discography. — *"10 productions! Your sound has a name."*
46. **Gold Beat Machine** · 25 — Twenty-five beats, every one credited. You're the producer people come back to. — *"Gold! 25 productions credited."*
47. **Gold Crusted Beat Machine** · MEGA · 50 — Fifty records. Your pads have been busy and your credits prove it. — *"MEGA! 50 productions. Crusted in gold."*
48. **Full Gold Beat Machine** · Ultimate · 100 — One hundred productions with your name on every one. This is a legacy
    built one beat at a time. — *"ULTIMATE! 100 productions. Solid gold."*

### 4.8 Live Musicians (performer credits)

Every instrument earns up to three badges as you credit players on it: **First Credit** (bedazzled cobalt art) at 1,
**Medallion** (silver ring) at 10, **Star-Studded** at 25. One description per tier, with the instrument filled in:

- First Credit — *"Every {instrument} part deserves a name. You credited your first {instrument} player, and that credit
  is how session musicians get paid and get hired again."* Pop-up: *"{Instrument} credited! The player got their name on the record."*
- Medallion — *"Ten {instrument} credits. You treat players like partners, and the record shows it."* Pop-up: *"Medallion! 10 {instrument} credits."*
- Star-Studded — *"Twenty-five {instrument} credits. Your sessions are star-studded and every star is named."* Pop-up: *"Star-studded! 25 {instrument} credits."*

Plus overall: **Session Hero**, 25 performer credits on any instrument (MEGA), and **Live Legend**, 100 (Ultimate);
these need art or can reuse `bedazzled_band`.

**Several file names don't match their art. Rename before building:**

| File now | Art actually shows |
| --- | --- |
| `electric_guitar.webp` | microphone |
| `mic.webp` | trumpet |
| `trumpet.png` | saxophone |
| `saxophone.webp` | drum kit |
| `piano.png` | electric guitar |
| `drums.webp` | piano |
| `classic_drummer.png`, `prestige_drumming.webp` | steel pan / handpan |
| `classic_guitar.png`, `star_studded_guitar_playing.webp` | ukulele-size guitar |
| `star_studded_violin.png`, `star_studded_piano_join.png` | cello |

**Done (84dfb64).** New names, by tier: first credit = `acoustic_guitar`, `electric_guitar`, `keyboard`, `drum_kit`,
`vocal_mic`, `trumpet`, `saxophone`, `violin`; medallion = `banjo_`, `clarinet_`, `handpan_`, `ukulele_`, `trombone_`,
`xylophone_medallion`, `grand_piano_medallion`; star-studded = `star_studded_banjo`, `_clarinet`, `_steel_pan`,
`_ukulele`, `_cello`, `_cello_join`, `_trombone`, `_harp`, `_piano`, `_double_xylophone`, plus `gold_piano`.
Serious: two trophies → `came_double_trophy_gold`, crossed chains → `came_chain_gold` (Came Double and Chain of Title
above use these). `bedazzled_vinyl` was WebP data with a .png name → `bedazzled_vinyl.webp`.

### 4.9 Hip-Hop/Rap (songs with Hip-Hop/Rap as primary or secondary genre; hidden for other genres)

49. **Cobalt Boombox** · 1 — Your first rap record is on the books. Bars on paper, credits in the file. — *"Boombox on! First hip-hop track logged."*
50. **Studio Headphones** · 5 — Five tracks deep. You hear the details other people miss, in the mix and in the paperwork. — *"Headphones on! 5 tracks."*
51. **Vintage Mic** · 10 — Ten records. Classic energy, modern business. — *"10 tracks! That's a mixtape."*
52. **Cobalt Grillz Mic** · 15 — Fifteen songs, and your catalog is starting to shine. — *"Grillz on! 15 tracks."*
53. **Platinum Ice Mic** · 25 — Twenty-five tracks credited. Iced out and organized. — *"Platinum ice! 25 tracks."*
54. **Gold Filigree Mic** · MEGA · 40 — Forty tracks with every credit in place. That's a catalog with weight. — *"MEGA! 40 tracks. Gold grillz."*
55. **CTA Chain** (`cta_chain_medallion`) · 50 — Fifty records. Put the chain on, you earned it with paperwork, not just bars. — *"Chain on! 50 tracks."*
56. **Dripping Ice Boombox** · Ultimate · 100 — One hundred tracks, every one credited. Legend status. — *"ULTIMATE! 100 tracks. Dripping."*
57. **Iced Dollar** · 1st hip-hop song with a fully signed split sheet — You secured the bag before the beat dropped. Split settled, everyone paid right. — *"Iced out! Your bag is secured."*
58. **Diamond Vinyl** · 1st hip-hop project where every track is Ready — A whole project with nothing missing. That's diamond-certified business. — *"Diamond! Your whole project is ready to collect."*

### 4.10 Spiritual Hip-Hop (songs with Spiritual Hip-Hop as primary or secondary genre; hidden for other genres)

59. **Cobalt Wings** (`cobalt_wings_mic`) · 1 — Your first faith-filled record is on file. Your message is protected and credited. — *"Wings up! Your first spiritual track is logged."*
60. **Faith Flow** · 3 — Three songs flowing from the heart. Keep going. — *"Faith flow! 3 tracks."*
61. **Positive Vibes** · 5 — Five songs spreading light, every one credited. — *"Positive vibes! 5 tracks."*
62. **Authentic** · 10 — Ten songs that sound like you and nobody else. — *"Authentic! 10 tracks."*
63. **Encourager** · 15 — Fifteen songs lifting people up. Your music is somebody's answer. — *"Encourager! 15 tracks."*
64. **Self Love** · 20 — Twenty songs. You poured into others; this one's for you. — *"Self love! 20 tracks."*
65. **Gold Wings** (`gold_wings_mic`) · 25 — Twenty-five songs, gilded and guarded. — *"Gold wings! 25 tracks."*
66. **Golden Halo** (`cobalt_wings_mic_gold_halo`) · MEGA · 40 — Forty songs of purpose, every one credited and protected. — *"MEGA! 40 tracks. Halo on."*
67. **God-Led** · Ultimate · 50 — Fifty songs, led by faith and built with care. A ministry and a catalog. — *"ULTIMATE! 50 tracks. God-led."*

### 4.11 Not badges

`party_popper` (celebration effect), `bedazzled_cta` (the CTA Badge avatar), `platinum_laptop` (retired avatar art),
`*_64.png` (small copies of the same art).

---

## 5. Build steps (after approval)

1. Rename mislabeled files (keep the old paths working for saved avatars, as with the retired producer badge).
2. Migration: `user_badges` (earned), `badge_settings` (staff on/off), user badge preferences on the profile.
   Read-only for users; inserts only through a server function that re-counts.
3. `src/lib/badges.ts`: the full catalog above. Rules count from catalog, split sheets, contracts, health check and timestamps.
4. Award check runs after saves in Embed, Catalog, Split Sheets, Contracts, Health Check, AI Protection Hub.
5. Pop-up with the badge, its title, description and pop-up message (existing `BadgeCelebration`); profile shelf
   grouped by collection, with Badge settings; progress chips.
6. Admin → Badges tab for staff on/off.
7. Tests for every rule (counts, time-of-day in the user's time zone, never-revoked).

## 6. Founder answers (2026-10-20)

1. Lyric copy edits: **approved.**
2. Spiritual Rap: **new genre "Spiritual Hip-Hop"** (added to the genre list, with hashtags). The collection is renamed to match.
3. "Silver Crown": **approved.**
4. **Fix all art names:** done.
5. In the Quiet, Session Hero and Live Legend art: **founder uploads them with the lyric badges.**
6. New global rule: brand voice (BRANDING.md §4). Copy above revised to lead with "Came Through"; crowns only now and then.
7. Contracts `bedazzled_v1` / `v3`: kept as spares for now.

---

## Later (queued from v0, plan after badges)

- **Music role at paid onboarding** (Artist · Singer/Songwriter · Composer/Producer · Live Musician → instruments ·
  Author/Lyricist · Label Executive → role). Experience only; it picks default badge collections and share-card captions. Open question: bands.
- **Accessibility:** WCAG 2.2 AA (contrast, keyboard, screen-reader labels, reduced motion, captions).
- **App:** installable web app (PWA) first, free, one codebase; App Store / Google Play wrapper later.
- Social media department inside Marketing (admin). Phone check that share cards open a new post/story.
