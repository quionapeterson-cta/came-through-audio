# PLAN — Level 3 layout and wording: preview · v1

Status: **preview for approval (2026-10-27). Nothing below is built until you approve.** Already fixed as a plain
bug: "Copyright Owner" was listed twice in "How you usually hold the master"; it's listed once now.
Source: founder testing list, 2026-10-27. Reply "approve all", or list the numbers to change.

Mockups are rough sketches of the layout, not the final look; everything uses the brand colors and Poppins.

---

## Homepage

**1. "Who It's For" moves above "How It Works".**
Order now: Hero → What does embed mean? → Everything in the plan → How It Works → **Who It's For** → Testimonials…
Order after: Hero → What does embed mean? → Everything in the plan → **Who It's For** → How It Works → Testimonials…

**2. Who It's For icons become animated badges.** Each audience card (songwriters, composers, producers, artists…)
keeps its title and line; its icon is replaced by a matching badge from the badge collections that gently floats
and shines (the same shine the badges use), and stays still for visitors who turn off motion.

**3. Composer picture:** the composer icon moves to the bottom-right corner of its picture.

**4. Help chat bubble:** moves from bottom left to **bottom right**, and shrinks from the "Help" pill to a small round
button with a chat icon (52px), opening the same chat panel above it.

**5. Help box answers:** it found nothing for "How much is AI Protection". I'll add prices and the most-asked questions
to its answer library. Questions I'll answer (tell me any to add or drop):
- How much is AI Protection? · How much is Expert Registration? · What does each plan cost and include?
- What's the difference between embedding and registering? · Do I need a PRO? Which one?
- What's an IPI / ISRC / ISWC / UPC and where do I get it? · How do splits work? · What's The MLC / SoundExchange?
- Can I get a refund? · How do I cancel or pause? · Is my music private? · How do I change my email or password?
- What do badges do? · How do I invite a collaborator to sign a split sheet?

## Share card (Facebook cuts off the top)

Facebook and most apps show link previews as a wide **1.91 : 1** rectangle (1200 × 630) and crop anything taller
from the top and bottom. Two options:

```
Option A: whole card, fitted                Option B: close-up
┌──────────────────────────────────┐        ┌──────────────────────────────────┐
│ ░░░  ┌────────┐  CAME THROUGH    │        │      [ big badge / avatar ]      │
│ ░░░  │ badge  │  AUDIO CAME      │        │   Came Through Audio Came        │
│ ░░░  │  art   │  THROUGH FOR     │        │   Through for [Artist]           │
│ ░░░  └────────┘  [ARTIST]        │        │                                  │
│      YOUR FIRST STOP BEFORE DIST.│        │   YOUR FIRST STOP BEFORE DIST.   │
└──────────────────────────────────┘        └──────────────────────────────────┘
 Every part of the card is visible:          Bigger and bolder in the feed; the
 badge left, words right, made at            card's smaller details (song title,
 1200 × 630 so nothing is cropped.           date) are left off the preview.
```
**Recommendation: A** (the whole card shows, nothing important can be cut). When people open the link they still see
the full tall card on the page.

## My Catalog

**6. BMI and self-published answers go above Writers**, with the explanation right there:
```
Publishing for this song
  ☐ I'm self-published (I collect my own publisher share)
  ☐ I'm a BMI writer with no publishing company
     💡 BMI pays BMI writers the publisher share too when there's no publisher. Tick this only if every writer on
        the song is with BMI. This is why the song can reach 100% without a publisher.
Writers · 2
  …
```
**7. "Recorded in"** (under Performers & recording) is renamed **"Country where it was recorded"**, with a tip: "For
airplay royalties outside the US (neighbouring rights). Most US artists can leave it as United States."

**8. © and ℗ symbols** use a clear system font (Arial/Helvetica) everywhere they appear, so they read as © and ℗ and
not as blurry shapes (an approved exception to Poppins).

**9. Instruments go into the performers list.** The separate Instrument box goes away; the role menu lists the
instruments themselves:
```
Before:  [Session musician ▾] [Name        ] [Instrument: Guitar]
After:   [Guitar ▾          ] [Name        ]
Menu:    Vocals (backup) · Guitar · Bass · Drums · Keys / Piano · Strings · Horns · Percussion · Programming /
         Synths · Other instrument… · Arranger · Mixing engineer · Recording engineer · Mastering engineer
```
Songs already saved as "Session musician + Guitar" show as "Guitar"; nothing is lost. Same change in Profile →
"Regular performers and crew".

**10. Genre list** grows from 17 to about 60, grouped, with subgenres (e.g. Hip-Hop/Rap → Trap, Drill, Boom Bap,
Conscious, Spiritual Hip-Hop; R&B/Soul → Neo-Soul, Contemporary R&B; Gospel → Contemporary Gospel, Traditional
Gospel; Electronic → House, Afro House, Amapiano, Techno, EDM; Latin → Reggaeton, Latin Trap…). Type to search. When
a subgenre is picked, exports send each agency the closest genre on its own list.

**11. The Re-check button** (Royalty Health → "What the world sees"): since MusicBrainz was removed it looks the song
up on **Deezer**, a streaming service with an open catalog: whether the ISRC is live on streaming and how the title and
artist are credited there. It still works, so it stays, renamed **"Check streaming"** with a tip saying exactly that.

## Split Sheets

**12. "Generate split sheet" moves to the top**, above the Contributor Library, Pending signatures and other boxes.

## AI Protection Hub (laid out like Split Sheets)

```
AI Protection Hub
[one-line description]
┌ Protect your songs ───────────────────────────────────────────────┐
│ Choose:  (•) A single  ( ) An EP  ( ) An album  ( ) Pick songs     │
│ [ Bloodline (Single) ▾ ]          →  [ Create certificates ]       │
└────────────────────────────────────────────────────────────────────┘
┌ Create your certificates ┐ ┌ How your certificates protect you ┐ ┌ My certificates ┐
│ steps 1–3                │ │ what they prove, how to use them  │ │ list + download │
└──────────────────────────┘ └───────────────────────────────────┘ └─────────────────┘
```
"Pick songs" lets people choose a few songs from an album or EP. Every heading says **certificates** (plural).

## Contracts & Blueprints

**13. The Contract Generator gets its own tab**, placed right before the contract tabs.
**14. The contract shows first.** Step 1 is Read, so the full contract opens first; the details to fill in come
after (step 2), then signing.

## Profile and badges

**15. Account section** replaces "25 days left to ask for a full refund · upgrades are always prorated" with:
> **Upgrade any time and only pay the difference.** Your upgrade is prorated for the rest of your plan year.
(The refund window stays in the Refund Policy and receipts; it's no longer shown on the profile.)

**16. Badges share in one step**, like the profile badge screen: tapping a badge opens the celebration with its
description underneath and the Share button right there. Badges earned more than once stack like coins with a count:
```
  ┌──────────┐
  │  badge   │ ×5     ← coins slide together and the number counts up
  └──────────┘
  Word Weaver
  5 lyrics milestone · earned 5 times
  [ Share ]
```

## Branding Kit (one design pass)

**17. After purchase:** a short welcome with where to find it: "Your Branding Kit is ready. Go to Profile → scroll to
Branding Kit to add your logo, colors and font. Then choose it on your next contract in Contracts & Blueprints."
**18. Exact color:** each color picker gets a box to type a hex code (#004AAD).
**19. Default font: Arial** (not Poppins) for new kits.
**20. Footer tagline** uses the same color as the generated "Came Through Audio" line, so it blends with any brand.
**21. Term headers** (the numbered section titles in contracts) are **black #0b0b0b** by default whenever a kit is
used, so our blue doesn't clash. Users can pick their own header color; the picker says "Dark colors read best".
**22. Several kits:** $13.99 per kit per year; edit kits in Profile or right from the Contracts tab, and pick which
kit a contract uses before generating it.
**23. Four contract styles** to choose per kit:
```
1 Classic                2 Sidebar                 3 Banner                  4 Minimal
┌──────────────────┐     ┌──┬───────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ LOGO      Title  │     │▌ │ LOGO   Title  │     │██ LOGO  Title ███│     │ Title            │
│──────────────────│     │▌ │ 1. TERMS      │     │                  │     │                  │
│ 1. TERMS         │     │▌ │ text text     │     │ 1. TERMS         │     │ 1. TERMS         │
│ text text text   │     │▌ │ 2. PAYMENT    │     │ text text text   │     │ text text text   │
│ 2. PAYMENT       │     │▌ │ text text     │     │ 2. PAYMENT       │     │ 2. PAYMENT       │
│──────────────────│     │▌ │               │     │                  │     │                  │
│ footer + tagline │     │▌ │ footer        │     │ footer + tagline │     │ small logo footer│
└──────────────────┘     └──┴───────────────┘     └──────────────────┘     └──────────────────┘
 Logo left, thin rule     A slim color bar down    A solid color band       No header band; logo
 under the header.        the left edge.           across the top.          small in the footer.
```
**24. More simple ways to customize** (pick any to add): a watermark of the logo behind page 1; a signature-line
style (line or box); a cover page with the logo; a second accent color; rounded or square corners on boxes.

## Share caption generator

**25. More promotional captions**: add release-day, pre-save, behind-the-scenes, milestone and thank-you styles (about
30 more). **Varying them by activity:** captions pick from what the user just did (a new song saved, a badge, a
split sheet signed, a registration filed) and their own genre and artist name, and never repeat the last one shown.
No AI cost: it's a library of templates filled with their details.

## Approve

- [ ] Homepage 1–5 · [ ] Share card option A or B · [ ] My Catalog 6–11 · [ ] Split Sheets 12 · [ ] AI Protection Hub
- [ ] Contracts 13–14 · [ ] Profile and badges 15–16 · [ ] Branding Kit 17–24 · [ ] Captions 25
