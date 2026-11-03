# Fast Track — what to get, in what order

**Purpose.** Everything needed to make the Streaming Fast-Track (hub plan §4) fully functional, split into what you do, what I do, and what happens if an approval doesn't land in time.

**Status today:** the discography half can run with **no accounts and no keys at all**. Only the composition half needs an application.

---

## The chart

```
                     ┌──────────────────────────────────────┐
                     │  PASTE A LINK (artist or track)      │
                     └──────────────────┬───────────────────┘
                                        │
        ┌───────────────────────────────┴────────────────────────────────┐
        │                                                                │
  ── RECORDING SIDE ──                                        ── COMPOSITION SIDE ──
        │                                                                │
 ┌──────▼───────────┐                                       ┌─────────────▼──────────────┐
 │ STEP 1  Deezer   │  no key, no account, works today      │ STEP 3  The MLC            │
 │ (already built)  │                                       │ Public Search API          │
 └──────┬───────────┘                                       └─────────────┬──────────────┘
        │ albums, tracks, ISRC, UPC, release dates,                       │ writers as registered,
        │ featured artists                                                │ publisher, IPI, ISWC,
        │                                                                 │ work ID, splits
 ┌──────▼───────────┐                                       ┌─────────────▼──────────────┐
 │ STEP 2  Spotify  │  OPTIONAL. Free key in 10 min.        │ must enrol first:          │
 │ better metadata  │  Dev Mode = 5 users.                  │ dah.themlc.com             │
 │                  │  Extended Quota needs 250K MAU +      └─────────────┬──────────────┘
 │                  │  a registered business → not now.                   │
 └──────┬───────────┘                                                     │
        │                                                                 │
 ┌──────▼─────────────────────────────────────────────────────────────────▼───────────┐
 │ STEP 4  MATCH: ISRC + writer names → registered / unregistered / unmatched          │
 │ (I build this; it needs STEP 1 + STEP 3 to say anything real)                       │
 └──────┬─────────────────────────────────────────────────────────────────────────────┘
        │
 ┌──────▼───────────────┐        ┌─────────────────────────────────────────┐
 │ STEP 5  Diagnosis    │        │ Songview / ASCAP ACE / BMI repertoire   │
 │ Unregistered Musical │◄───────┤ STEP 6  NO API EXISTS.                  │
 │ Work : Mechanical &  │        │ Link-out for a human check, or a paid   │
 │ Digital Perf Uncoll. │        │ licensed provider. Your call.           │
 └──────────────────────┘        └─────────────────────────────────────────┘
```

Read it as: **STEP 1 alone is enough to ship something honest by Nov 16.** STEP 3 makes it genuinely valuable. STEP 2 and STEP 6 are optional.

---

## Step 1 — Deezer discography (nothing to do)

| | |
|---|---|
| Who | Nobody. Already in the codebase (`runSongLookups`) |
| Key needed | **None** |
| Cost | Free |
| Time | Zero |
| Gives | Artist → albums → tracks, **ISRC**, **UPC**, release dates, featured artists |
| If it ever gates | Fall back to MusicBrainz — also key-free, 1 request/second, needs a contact User-Agent |

**This is the recommended production path for the recording side**, because there is no approval standing between you and working software.

## Step 2 — Spotify metadata (optional, 10 minutes)

| | |
|---|---|
| Who | You |
| Where | [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → Create app → "Web API" |
| Key needed | **Client ID** + **Client Secret** — server-side only, never `VITE_*` |
| Cost | Free, but the **account must have Spotify Premium**: since Feb 2026 a Development Mode app stops working if the owner's Premium lapses |
| Time | 10 minutes |
| Limits | Development Mode: 5 users, search max 10 results per page (paginate) |
| Production ceiling | **Extended Quota Mode requires 250,000 MAU and a registered business with a launched service.** Not available to this project now, not worth planning around |

**Verdict:** nice during beta for artist linking and cover art. Do not make it load-bearing. If you skip it entirely, the feature still works.

## Step 3 — The MLC Public Search API (the one that matters)

| | |
|---|---|
| Who | You — needs company details and a use case |
| Where | [dah.themlc.com](https://www.dah.themlc.com/) → Data Access Hub → Sign Up → enrol in **Public Search API** |
| Key needed | Issued after enrolment — either an API key or a client ID/secret pair. The portal is login-walled, so the exact shape is only visible inside |
| Cost | Free data program; you accept the Data Access Hub Terms of Use |
| Time | Signup in minutes; **approval time is out of our hands** |
| Gives | Works in the MLC database: writers as registered, publishers, IPI, ISWC, work ID, share splits |
| Notes | Aimed at publishers and administrators, DSPs, CMOs and music technology companies — that is your category. US mechanicals only |

**Do this today.** It is the longest-lead item in the whole plan.

## Step 4 — Matching (mine)

Once 1 and 3 both answer, I match ISRC → work → writer and IPI, then render the locked diagnosis: *"Unregistered Musical Work : Mechanical and Digital Performance Royalties Uncollected."* I can write and test this layer against sample MLC response shapes before your credentials exist, and flip it on the day access lands.

## Step 5 — The diagnosis (mine)

Already specced in the hub plan; renders as soon as step 4 returns data.

## Step 6 — Songview / ASCAP / BMI (your decision)

| Option | Cost | What you get | Risk |
|---|---|---|---|
| **A. Skip it** (recommended for beta) | Nothing | MLC coverage only | None |
| **B. Link out** with the song pre-filled | Nothing | A human confirms PRO registration in one click | None — it's a link |
| **C. Licensed vendor** (Soundcharts, Blokur, Music Data Services and similar) | Paid contract | Full PRO and publisher coverage, automated | Cost and contract time |

There is **no free API** for these three. Scraping them breaks their terms and I won't build it — that is the one place where "it's public information" does not hold.

---

## What I need from you

- [ ] **Today:** sign up at `dah.themlc.com` and enrol in the Public Search API. Tell me when it is submitted, and when it is approved.
- [ ] **Optional, 10 minutes:** create the Spotify app and confirm the account is Premium.
- [ ] **Decide:** step 6 option A, B or C.
- [ ] **Store the credentials — don't send them.** Cloudflare → Worker → Settings → Variables and Secrets, as secrets. Vercel → Environment Variables until cutover. Never in chat, never in a file, never `VITE_`-prefixed.

## Where the keys go (the names I'll code against)

| Name | Source | Side |
|---|---|---|
| `SPOTIFY_CLIENT_ID` | Spotify dashboard | server only |
| `SPOTIFY_CLIENT_SECRET` | Spotify dashboard | server only |
| `MLC_API_KEY` | MLC Data Access Hub — or `MLC_CLIENT_ID` + `MLC_CLIENT_SECRET` if issued as a pair | server only |

The browser asks our Worker; the Worker holds the key. Nothing here is ever compiled into the browser bundle.

## What ships by Monday Nov 16, either way

- **If MLC approval has landed:** full fast-track — paste a link, discography pulled, works matched, real diagnosis.
- **If it hasn't:** the discography pulls and populates My Catalog, and the composition check shows *"Not yet verified — check at The MLC"* with a pre-filled link. **No spinner pretending to work, no invented results.**
- Either way the retimed schedule holds: Cloudflare in the week of Dec 7, Lovable gone Dec 11.
