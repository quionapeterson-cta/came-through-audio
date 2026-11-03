# Fast Track — what to get, in what order

**Purpose.** Everything needed to make the Streaming Fast-Track (hub plan §4) fully functional, split into what you do, what I do, and what happens if an approval doesn't land in time.

**Status today (3 Nov 2026):** the discography half is **built and live** — no accounts, no keys, no approval. It appears in the hub as **Streaming Profile** (`src/lib/discography.ts`, `src/components/StreamingFastTrack.tsx`). Only the composition half needs an application; until it lands, every work reads **Not yet verified** with a one-click link to The MLC, and nothing is ever called missing.

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
| Who | Nobody. **Built** — `pullDiscography` in `src/lib/discography.ts` |
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

Songview itself has **no public API**, and scraping it breaks their terms — I won't build that. But the *underlying facts* (who a writer is affiliated with, their legal name, their IPI) are reachable through the routes below, so this is an access problem, not a dead end.

## Other legitimate sources (confirmed 3 Nov 2026)

| Source | What it gives | How you get it |
|---|---|---|
| **MLC Bulk Data Access** (BWARM / DDEX) | Works, parties, sound recordings, products, releases in bulk machine-readable form — the MMA requires The MLC to publish it | Enrol in the Data Access Hub, same place as the Public Search API |
| **SoundExchange Repertoire Search API** | Recording → ISRC in real time, from rights-owner-supplied data | **Request-gated.** Their page says to email them to request use; aimed at licensees and third-party reporting vendors. There is also a free ISRC search site and a bulk Repertoire Matching Service inside Licensee Direct |
| **CISAC IPI Pocket Edition** | Every IP code with **the member society each party is affiliated with**, plus the IP-Name-Number | Provided **to publishers on request**. This is the clean route to "BMI affiliation + legal name + IPI" from a name |
| **CISAC ISWC IPI Context Search API** | Creator IPI numbers found from a name plus known work titles | Launched Dec 2025 for music publishers |

**Read this against your Umogal observation.** A new service can show BMI affiliation, registered legal name and IPI because those three fields are exactly what the IPI Pocket Edition carries, and what MLC bulk data carries for works and parties. That is available to a company that signs up as a publisher/administrator — and you already register works with The MLC, so you are in that category. The alternative explanation is scraping Songview, which works until it doesn't.

The practical upshot: **ask The MLC for Data Access Hub enrolment and the IPI Pocket Edition in the same breath.** They are two doors in the same building.

---

## The Data Access Hub programmes (CTA is a label, so more than one applies)

| Programme | What it actually gives | Verdict |
|---|---|---|
| **Public Search API** | GET lookups of musical works already in The MLC's database — the fast track's composition half | **Enrol now.** Nothing works without it |
| **DURP for Record Labels** | A dashboard of the recordings CTA has released in the US that The MLC could not match to a registered work, i.e. royalties sitting unclaimed on CTA's own roster | **Enrol now.** This is the hub's thesis aimed at the label's catalog instead of one artist |
| **Data Quality Initiative (DQI)** | Upload a schedule of our works, get discrepancy reports back. Free for MLC members; non-members reach it through a partner (Blokur, Music Data Services, TuneRegistry and others) who charge | After the first two. No code, no API — a spreadsheet in, a report out |
| **Bulk Data Access** (DDEX BWARM) | The whole works, parties, recordings and releases database in bulk | Later. Needs a storage and query layer we have not built |
| **DURP** (the distributor version) | Same idea as the label version, but keyed to distributors and aggregators | Only if CTA delivers releases itself |
| **Radar for CMOs**, **Member Benefits Vendor Portal** | CMOs only; vendors invited into that programme only | Not eligible |

**The condition on DURP that decides whether it is worth the form:** it reads distributor names out of the monthly DSP usage reports. It can show CTA its own releases only if CTA is the label or distributor of record in that metadata — either delivering to DSPs itself or being named by whichever distributor delivers for it. If CTA does admin, splits and registration while someone else's name goes out on the release, DURP will show nothing about us. Settle that before enrolling, because the two answers are "apply this week" and "skip it".

## What I need from you

- [ ] **Today:** sign up at `dah.themlc.com` and enrol in the Public Search API. Tell me when it is submitted, and when it is approved.
- [ ] **Also today, if the releases go out under CTA's own name:** enrol in **DURP for Record Labels**.
- [ ] **Optional, 10 minutes:** create the Spotify app and confirm the account is Premium.
- [ ] **Decide:** step 6 option A, B or C.
- [ ] **Store the credentials — don't send them.** Right now that is **Lovable → Cloud → Secrets** (where `RESEND_API_KEY` and the Cloudflare AI token already are), or Vercel → Environment Variables if you are serving from the backup. There is no Cloudflare Worker yet: it is created in step 1 of the move in the week of Dec 7, and its **Settings → Variables and Secrets** is where the same names go after that. Never in chat, never in a file, never `VITE_`-prefixed.

## Where the keys go (the names I'll code against)

| Name | Source | Side |
|---|---|---|
| `SPOTIFY_CLIENT_ID` | Spotify dashboard | server only |
| `SPOTIFY_CLIENT_SECRET` | Spotify dashboard | server only |
| `MLC_API_KEY` | MLC Data Access Hub — or `MLC_CLIENT_ID` + `MLC_CLIENT_SECRET` if issued as a pair | server only |

Whichever host is running the app holds the key: the browser calls a server function, the server reads `process.env`, and nothing here is ever compiled into the browser bundle. That is also why the names matter more than the host — a key stored in Lovable's secrets today keeps working unchanged when the Worker takes over, because the code asks for the same name either way.

## What ships by Monday Nov 16, either way

- **If MLC approval has landed:** full fast-track — paste a link, discography pulled, works matched, real diagnosis.
- **If it hasn't:** the discography pulls and populates My Catalog, and the composition check shows *"Not yet verified — check at The MLC"* with a pre-filled link. **No spinner pretending to work, no invented results.**
- Either way the retimed schedule holds: Cloudflare in the week of Dec 7, Lovable gone Dec 11.
