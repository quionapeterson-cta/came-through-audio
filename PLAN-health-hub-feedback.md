# PLAN — Health Hub fine-tuning, catalog splits, PDF, artist name, info tips, invite email · v1

Status: **built 2026-10-20 (§0–§6 complete).**
Source: founder testing notes, 2026-10-19.

---

## 0. Security: split-invite emails (Lovable warning)

### What's actually open today
- Only Collaborate+ accounts can send, capped at 50 per day. **But the cap counts split rows, not emails.** Re-sending the same row updates its time, so one row can be re-sent without limit.
- The song title, artist and collaborator name are typed by the sender and go into the subject and body. A spammer could put "Claim your prize at…" in the title and send it to a stranger, using our domain.

### Fix
1. **Log every send** in a new `invite_sends` table (sender, row, recipient, time), written by the server. The daily cap counts real sends.
2. **Per row: at most 3 sends, 24 h apart** ("Resend available tomorrow").
3. **Per recipient: at most 3 invites a day from all senders combined.**
4. **Recipient opt-out:** a "Don't send me invites" link in the footer adds the email to `invite_blocklist`; later sends to it are refused with a clear message to the sender.
5. **No links or web addresses in sender-typed text:** title, artist and name are shortened (80 characters) and anything that looks like a web address is removed before it goes in the email.
6. Lower the daily cap from 50 to **25** (an album's worth of co-writers). Support can raise it.

Files: `src/lib/splits-email.functions.ts`, new migration (2 tables, server-only, no existing data touched), `src/lib/email-layout.ts` (opt-out link), new `/invites/stop` route.

---

## 1. Song Health Checklist

### 1a. Where to search each agency
Each agency's search works best with a different key, so the step says which one and copies it:

| Agency | Search by | "Open" button copies |
| --- | --- | --- |
| SoundExchange | **ISRC** | the ISRC |
| The MLC | **Writer name** | the first writer's legal name |
| BMI / ASCAP / SESAC | Title + writer | the title |
| Others | Title | the title |

```
3  CONFIRM IT SHOWS UP
☐ Confirm it shows up in SoundExchange
   Search SoundExchange by ISRC — it's the most exact match.
   Your ISRC: GX8KD2640648  [Copy]
   [🔍 Open SoundExchange ↗]  [Yes, it's there]  [Not showing up]
```
If the ISRC (or writer name) is missing, the step says so and links to the field.

### 1b. "Fix it" fixes your catalog, not the agencies
A note appears under every Fix it button, and once in the hub header:

```
✏️ Fix it  — updates your catalog
ⓘ This corrects your Came Through Audio catalog, so your exports and
  1-click agency files are right from now on. It doesn't change what
  SoundExchange, The MLC or your PRO already have. If the song is
  already registered there, log in and update it too.
```
After a fix on a song that already has a "registered" or "found" tick, the related step reopens as
**"Update your registration at The MLC"** with the agency's own update steps, so it can't be forgotten.

### 1c. "What the world sees" missed your song (bug)
Your song **is** on streaming. The lookup only searched "artist + title", and Deezer's search doesn't
recognize "Karma Came" as an artist, so it returned nothing. Searching by the ISRC finds it right away.
- **Fix:** search by ISRC first (already done when the catalog has it), then title + artist, then **title only**, keeping only a result whose artist matches.
- **MusicBrainz** genuinely has no entry for this song. That's normal: it's a volunteer database. The wording changes so nobody confuses it with SoundExchange or The MLC:

```
In MusicBrainz (the open, volunteer music database)
Not listed there. That's normal for independent releases and doesn't
affect your royalties. SoundExchange and The MLC don't let apps look
songs up, so confirm those with the steps above.
```

### 1d. Unticking steps
Bug: once a song is marked "found", its **Register** step can't be unticked, because "found" also counts as registered.
- Every ticked box can be unticked. Clicking a ticked box asks first:
  `Untick "Register with The MLC"? [Untick] [Keep it]`
- Unticking **Register** also clears that agency's "found" mark (it can't be found if it isn't registered).
- Ticked steps can still be expanded to re-read the steps (today they collapse with no way back in).
- Steps that tick themselves (writer names, ISRC) stay automatic; their box opens the field instead, as now.

### 1e. Song list for big catalogs (5 albums × 20 songs)
The left panel groups songs by release, collapsed, with search:

```
┌ Song Health Checklist ────────────────────────────┐
│ [Needs attention · 64] [Saved for later · 3] [100% Healthy · 33] │
│ 🔍 Search songs…               Sort: [Least healthy ▾] │
│                                                    │
│ ▸ Karma Season (album) · 20 songs   ███████░ 72%   │
│     4 need attention                                │
│ ▾ Came Through (EP) · 6 songs       ████░░░░ 48%   │
│     Big Booty Bouncing   ████░░ 60% · 3 left        │
│     Track Two            ██░░░░ 30% · 5 left        │
│ ▸ Singles · 12 songs                ██████░░ 81%   │
│ ▸ Royalty Inspector songs · 9       █████░░░ 63%   │
└────────────────────────────────────────────────────┘
```
- Releases come from the catalog's album field; songs without one go under **Singles**. Inspector songs get their own group.
- The release holding the selected song opens automatically. Songs show in track order.
- Song rows become one line (title, bar, steps left), and the panel scrolls on its own beside the detail.
- Sort: least healthy (default), A–Z, recently updated.

Files: `src/components/HealthChecklist.tsx`, `src/lib/health-checklist.ts`, `src/components/HealthReport.tsx`, `src/lib/lookups.ts` (+ tests), `src/lib/repertoires.ts` (search key per agency), `src/lib/register-guides.ts` (update steps).

---

## 2. Catalog splits can't go over 100% ⚠️ touches writer fields

Writer splits (Author, Composer and Author/Composer together) must total no more than 100%. Publisher shares, separately, no more than 100%.

- **Each box is capped** at what's left: if two writers already have 70%, the third can't go above 30%. Typing more snaps it to the most allowed, with a short note.
- **Live total** under each section: `Total: 85% · 15% left` turns ⚠️ when it doesn't reach 100% (a warning only, saving still works) and can never go above 100%.
- **Nothing is blocked:** following the "Embedding is forgiving" rule, saving and embedding still work with blank or partial splits.
- Existing songs that are already over 100% aren't changed. They show ⚠️ "Writer splits total 110%, lower one to fix" with a link to the field, and the next edit enforces the cap.
- The same cap applies to the Royalty Inspector split box.

**Readiness:** no change. "Ready" stays exactly as defined (author or instrumental, composer, every legal name). Over-100% is
already flagged by the audit (`audit.ts`), and that message will also say "over" vs "under".

Files: `src/components/MetadataUploader.tsx` (Contributors share inputs), new `src/lib/splits-total.ts` (one shared cap/total helper + tests), `src/lib/audit.ts` (message wording), `src/components/RoyaltyInspector.tsx`. **No schema change, no writer data rewritten.**

---

## 3. Catalog PDF

Header: **"Karma Came · Master Catalog"** (the account's artist name). The brand bar uses the real tagline
(today it says "Organize your music business like a pro"). Each song becomes an evenly aligned block:

```
┌──────────────────────────────────────────────────────────────┐
│ [logo] CAME THROUGH AUDIO      YOUR FIRST STOP BEFORE DISTRIBUTION │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ Karma Came                                                    │
│ MASTER CATALOG                         38 songs · Oct 19, 2026│
│                                                               │
│ CAME THROUGH (EP) · 2026                                      │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ 1  Big Booty Bouncing (feat. OG PI)               3:12    │ │
│ │    ISRC   GX8KD2640648      UPC    1234567890123          │ │
│ │    ISWC   —                 Genre  Hip-Hop/Rap            │ │
│ │    Released  Mar 3, 2026    Label  Came Through Audio     │ │
│ │    WRITERS    Jane Doe (Author/Composer), John Roe (Composer)│
│ │    PRODUCED BY  OG PI                                     │ │
│ │    PUBLISHERS   Karma Came Publishing                     │ │
│ └───────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```
- Songs are grouped under release headings, then by track number.
- Identifiers sit in a fixed two-column grid with labels left-aligned on one line. Empty values show "—", so every block lines up.
- Credit labels sit in one fixed-width column. Long names wrap under the value, not under the label.
- A song block never splits across pages. Still no splits, PRO or IPI (they stay private).

Files: `src/lib/catalog-pdf.ts`, `src/lib/brand-pdf.ts` (tagline; affects other PDFs' header line too — will show you).

---

## 4. Artist name change

### Pop-up when you change the name
When the Artist name field is edited, a pop-up appears **before** saving (the fine print stays too):

```
┌ Change your artist name? ─────────────────────────┐
│ "Karma Came"  →  "Karma Kame"                     │
│                                                   │
│ Changes left this year:  2 of 3                   │
│ Next change after this:  in 7 days (Oct 26)       │
│ Resets:  1 change frees up on Mar 3, 2027         │
│                                                   │
│ Songs you already saved keep the name they were   │
│ released under.                                   │
│                                                   │
│ Releasing music as a different artist?            │
│ Add them as another artist instead, so both names │
│ stay on your account.                             │
│                                                   │
│ [Add another artist]  [Cancel]  [Change name]     │
└───────────────────────────────────────────────────┘
```
When a change isn't allowed yet: "You can change your artist name again in **5 days** (Oct 24). **2 changes** left this year."
The fine print shows the same live numbers.

### "Add another artist": is it set up? **No.**
Artist seats were designed (PLAN-pricing-badges.md §E) but not built. They need 3 Paddle prices you create first
(`artist_seat_plus_yearly`, `artist_seat_collaborate_yearly`, `artist_seat_management_yearly`) and a bigger build
(own logins, artist switcher, data-preserving catalog migration).
**For now:** the button opens a "Coming soon: add more artists" panel with the seat prices and a "Notify me" option
(saved to the account), so the path exists and we learn who wants it.

Files: `src/components/ArtistOnboarding.tsx`; small migration: `artist_name_status()` also returns the date the oldest of the 3 changes frees up (read-only change).

---

## 5. Producer field note

"Add song" can save a song that was never embedded, so "This name is embedded in your track" reads wrong.
The paragraph under **Produced by** becomes an ⓘ tip instead, worded for both cases:

> **Produced by** is a credit: it shows who produced the recording, and it's embedded in your MP3 when you embed one.
> It doesn't pay royalties by itself. If the producer co-wrote the music (made the beat) and gets a share of the song,
> also add them under **Writer** with their legal name and the **Composer** role. Producer points from the master
> (a cut of record sales) are agreed in a producer contract, not here.

---

## 6. Info tips across the site

- **Tips work on phones:** today they're hover-only (`title` text), which phones never show. A shared `<InfoTip>` opens on tap or hover,
  closes on tap outside, and is screen-reader friendly. It replaces the three separate tip styles now in use.
- **One plain-language glossary** (`src/lib/glossary.ts`), so the same term reads the same everywhere: ISRC, ISWC, UPC, IPI, PRO,
  The MLC, SoundExchange, publisher, split, master vs composition, Author/Composer roles, P-line/C-line, mechanical,
  performance and digital performance royalties, explicit, release type, featured artist, label, metadata.
- **Every form field gets one**, in order: Embed Metadata, Add song, Royalty Inspector, Split sheets, Contracts, Embed Defaults/Profile,
  AI Protection Hub, Health Checklist headings. Writer fields' tips follow the writer rules (legal name only, PRO/IPI can wait).
- Style: one or two short sentences, "what it is → why it matters → where to get it". Example:
  > **ISRC** — Your recording's ID, like a barcode for one version of a song. Streaming services use it to pay you.
  > Your distributor gives you one free when you release.

I'll send you the full glossary text to approve before it goes in.

---

## Order of work (each its own commit, app works after each)
1. Security fix (§0)
2. Checklist fixes: lookup bug, untick, agency search keys, "Fix it" note (§1a–1d)
3. Song list grouping (§1e)
4. Split caps (§2)
5. Artist-name pop-up (§4) + producer tip (§5)
6. Catalog PDF (§3): I'll send a sample PDF to review
7. InfoTip + glossary (§6): glossary text first for approval

Migrations needing applying in Lovable afterwards: §0 (invite log + blocklist) and §4 (status function).
