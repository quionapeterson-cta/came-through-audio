# PLAN — Hear it before you send it: catalog preview + WAV storage · v2

Status: **planned 2026-11-05, not built.** Delivery: **one of the last build steps**, after the Cloudflare move
(`PLAN-cloudflare-hosting.md`) and after the beta list is quiet — it is a convenience on top of a working catalog, not a
reason to hold up the move.
Source: founder, 2026-11-05 (play from the catalog only to confirm the right version and that the file is complete;
bytes never touch the Worker; **no official WAV storage limit before it is decided**).

> **Nothing in this document is an official promise yet.** The WAV storage question in §5 is open on purpose: numbers are
> here as arithmetic, not as an offer. Copy ships only what is approved.

---

## 1. What this is — and what it is not

**The job:** a member opens a song in My Catalog, presses play, and hears enough of the file to know two things: it is
the version they meant to save, and the file is whole (no cut-off, no wrong mix, no dead air, no silent tail). They do
this **on their own computer, from the catalog page**, the way they would double-click a file on their desktop.

**It is not a listening app.** No queue, no playlists, no shuffle, no background or lock-screen playback, no share
link, no "play whole catalog", no playback anywhere but My Catalog. If someone wants to listen while working, they
download the master. This keeps the feature honest about what it costs and stops it drifting into a streaming product
we never priced.

Concretely: **one play button per song, one `<audio>` element, playback stops when the page or the song closes.**

## 2. Where the bytes go (the decision that makes this cheap)

Masters live in Supabase Storage today (`catalog-files`, one folder per user). Playing from there bills Supabase
egress on every repeat listen and needs a signed URL per play anyway.

So the WAV/MP3 masters move to R2, beside the badge art, and playback is:

1. The server checks the member is signed in and **owns that path** (never a path from the browser).
2. It returns a **short-lived signed R2 URL** (5–15 minutes).
3. The browser's `<audio preload="metadata">` streams **straight from R2** on `media.camethroughaudio.com`.

Nothing else. **The bytes never touch the Worker** (founder, 2026-11-05).

- Worker cost per play: one request, 2–4 ms of CPU for auth plus signing. Byte streaming is I/O, which is not CPU.
- No proxy through a server function, ever: that turns every seek into a Worker request and puts a private master in
  an edge cache it does not belong in.
- No transcoding and no waveform drawing on the server. `ffmpeg` has no place in a Worker (30 s CPU ceiling, 128 MB
  memory); previews, if we ever need them, are generated once, offline, and stored next to the master.
- `preload="metadata"` matters: it fetches the header for duration, not the whole file, so opening a catalog does not
  download every master.
- Use `media.camethroughaudio.com`, not the `r2.dev` address: Cloudflare rate-limits and labels r2.dev as
  development-only, exactly as `PLAN-cloudflare-hosting.md` says for art.

## 3. Build order (this is the last step)

| # | Step | Who |
|---|---|---|
| 1 | R2 bucket for masters + custom domain `media.camethroughaudio.com` | Founder (Cloudflare) |
| 2 | Uploads write the master to R2; keep the Supabase copy until playback is verified | Software |
| 3 | `signedMasterUrl` server function: ownership check, 5–15 minute expiry, no path from the client | Software |
| 4 | Play button in My Catalog beside Download, one `<audio>` shared by the list | Software |
| 5 | Verify seeking: R2 answers `Range` with `206`, so scrub works and a seek is a read, not a re-download | Software |
| 6 | Only if §5 keeps stored WAVs: byte accounting and a soft meter in My Catalog | Software |
| 7 | Beta flag on, then the founder's own catalog as the first real test | Founder |

Acceptance: a 9.5 MB MP3 plays and scrubs in the browser with the request going to the media host; the worker log
shows one request per play; a second member's signed URL for someone else's path is refused; a paused plan can still
download but not play.

## 4. What it costs, at size (arithmetic, not a promise)

A 4-minute master: MP3 320 kbps ≈ 9.5 MB, WAV 24-bit/44.1 kHz ≈ 63 MB. Assumes 25 songs per member and ~8 plays each a
month.

| Scale | Stored at 25 MP3s each | Plays / month | Cloudflare | Supabase, same traffic |
|---|---|---|---|---|
| 100 members | 24 GB | 20,000 | ~$0.21 | $25 plan (inside quota) |
| 1,000 members | 235 GB | 200,000 | ~$3.38 + $5 Workers | ~$175 |
| 10,000 members | 2.35 TB | 2,000,000 | ~$35 + $5 Workers | ~$1,740 |
| One song, 1M plays | — | 1,000,000 | ~$0 (reads inside 10M free) | ~$850 |

R2 egress is free; storage is $0.015/GB-month with 10 GB free, reads $0.36/million Class B with 10 million free.
Workers Paid ($5) includes 10M requests and 30M CPU-ms a month. **Playback is nearly free; storage is the bill** — which
is why §5 is still open.

## 5. WAV storage: decided in part, open in part

**Decided:** embedding a WAV is unlimited, and downloading it again is unlimited. Both run in the browser, so they cost
us nothing to serve. No plan caps them.

**Not decided:** how many WAV masters we keep, and whether keeping them is included or paid for. Today the app still
stores them, with no stated limit — that is a draft state, not an offer, and the copy says nothing about a limit in
either direction.

The arithmetic the decision turns on, for 4-minute 24-bit masters at ~63 MB each:

| WAV masters kept | Storage | R2 cost / month |
|---|---|---|
| 400 (one member's catalog at 16 songs) | 25 GB | ~$0.23 |
| 800 | 50 GB | ~$0.60 |
| 8,000 (ten members) | 500 GB | ~$7.35 |
| 80,000 (a hundred members) | 5 TB | ~$75 |

The three shapes it can take:

1. **Keep storing, unlimited, and eat it.** Cheapest to explain, and the exposure is bounded by how many Management
   members actually upload WAVs — but it is an open-ended bill at $0.015/GB-month that grows with every member and
   never expires.
2. **Keep storing within an allowance** (the shape we sketched and then pulled back): a number per account, no
   deletion, uploads wait past the line, no overage charge. Needs byte accounting the catalog does not have today.
3. **Embed and download, don't store** on the plan, with storage sold as an add-on. Cheapest for us, and it leans on the
   fact that the member already has the file — but it loses the "your vault has the WAV too" story that makes the
   Management tier feel complete.

Whichever is chosen, the meter and the upload gate are the same build: record the byte size at upload, sum the stored
WAVs per account, and show it before it matters. That work inverts if nothing is stored at all.

## 6. Open questions for the founder (before launch)

1. Do we keep WAV masters in the catalog at all, or is embedding-and-downloading the whole offer?
2. If we keep them: an allowance, a paid block, or a flat cap with "keep the rest yourself"?
3. What happens to a paused plan or a plan that ended — 30 days like the rest of the catalog, or Vault-fee coverage?
4. Does an artist seat carry its own storage, or share the owner's?
