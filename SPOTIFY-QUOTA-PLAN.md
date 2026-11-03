# Spotify Extended Quota — the honest plan

**Written 3 November 2026.** Requirement figures come from Spotify's quota modes documentation and the February 2026 migration guide.

---

## Where you actually stand

| Requirement | Status today |
|---|---|
| Registered business | Yes — you have one |
| Launched service at a public URL | Pending — after the Dec 7 Cloudflare cutover to `camethroughaudio.com` |
| **250,000 monthly active users** | No — beta scale. This is the whole gap |
| Privacy policy, ToS, branding compliance | Not built yet |
| Spotify account on Premium | Needed for any app, including Development Mode |

**Read this first:** 250,000 MAU is a distribution milestone, not an engineering one. No amount of build work creates it, and a premature application is more likely to be declined than queued. This is therefore a *growth* plan with an application package prepared in advance, not a form to submit this week.

## What the two limits really mean

The 5-user cap and the 10-result cap get confused constantly. They are unrelated:

| Limit | Applies to | Affects CTA? |
|---|---|---|
| **5 users per app** | Spotify *accounts that authorize your app* (Authorization Code flow) | **No.** CTA calls Client Credentials as the app itself. Your users never log in with Spotify |
| **10 results per search** | `GET /search` page size | Barely. Discography comes from `/artists/{id}/albums`, paged at 50. Search is only the fallback when a link can't be parsed |
| **Rate limit** | Calls per **rolling 30-second window**, stricter in Development Mode | **Yes — this is the real constraint** |
| **Development Mode itself** | Policy: for development, not a public commercial service | **Yes — this is the real risk** |

So: **1,000 CTA users would not consume 1,000 Spotify users.** They would spend *rate limit*, because every lookup leaves from your single app identity. Spotify does not publish the exact dev-mode number and it varies by mode. Extended Quota is how you raise that ceiling — and how you stop running a public product on a development client.

Two architecture facts worth designing around now:

- **Batch endpoints were removed in Feb 2026.** No `/albums?ids=`, no `/tracks?ids=`. One request per album now, which pushes a five-album artist to roughly **7–8 calls** per full discography pull.
- **`/artists/{id}/top-tracks` and the browse endpoints are gone.** Do not design around them.

Caching turns those 7–8 calls per *pull* into 7–8 calls per *artist per refresh window*, not per user. A thousand people checking the same artist costs one pull if the cache is warm. This is the biggest lever available to you and it costs nothing.

---

## Phase 0 — before beta (now → Nov 16)

Goal: make the Spotify question irrelevant to shipping.

- [ ] Deezer carries discography in production (`runSongLookups` already in the codebase, no key)
- [ ] Spotify wired behind `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` **only if** you create the app; treat it as optional enhancement
- [ ] Cache discographies in our own database with a refresh window — 7 days is generous, one row per artist, not per user
- [ ] Handle `429` properly: read `Retry-After`, back off, never hammer
- [ ] Lazy-load: only call when the user actually pastes a link

**Exit criterion:** the fast track works end-to-end with the Spotify keys deleted.

## Phase 1 — beta (Nov 16 – Dec 3)

Goal: generate the number the application asks for.

- [ ] Define MAU the way Spotify means it: **unique users who did something meaningful in a calendar month** — paste a link, run a diagnostic, open a report. Count once per user per month.
- [ ] Store it in our own database (a monthly-active table or a simple event log), not only in a third-party dashboard you cannot export
- [ ] Keep a monthly screenshot/export so the application has evidence
- [ ] Measure lookup volume too: total pulls, cached vs live, `429` count

Realistic beta numbers here are in the tens. That is fine — this phase is about instrumenting, not hitting the target.

## Phase 2 — public launch (after the Dec 7 cutover)

Goal: satisfy the "launched service" criterion.

- [ ] Real domain live: `camethroughaudio.com`, Cloudflare-hosted
- [ ] Privacy policy and Terms of Service published, linked in the footer
- [ ] Spotify branding rules followed — logo usage, attribution, no implied endorsement
- [ ] Public signup, working pricing, support contact

**Exit criterion:** a stranger can find, sign up and use the product without you in the room.

## Phase 3 — the growth ladder

| Milestone | What has to be true | What it buys |
|---|---|---|
| 1,000 MAU | Beta + launch + first outreach | Proof of retention, not just traffic |
| 10,000 MAU | Distribution partnerships: distributors, producer communities, PRO educator channels | A number worth mentioning in an application |
| 100,000 MAU | Repeatable acquisition channel, paid or partnered | Near threshold; finalise the package |
| **250,000 MAU** | Sustainable growth, real business | **Application goes in** |

Track month-over-month growth, not raw totals. Reviewers want to see a service people return to.

## Phase 4 — the application package

Assemble it *before* you cross the line so submission takes an hour, not a month.

- [ ] **Business details**: registered entity name, country, address, tax ID — the legal entity, matching the footer of the domain
- [ ] **Launched service**: public URL, what it does, who uses it
- [ ] **MAU evidence**: your own export plus screenshots, naming the month they cover
- [ ] **Use case statement**, one page: *"Independent artists connect a streaming profile, and we cross-reference their recordings against collection-society records to find unregistered works and unclaimed royalties."* State explicitly that you do not redistribute Spotify content or build a competing player.
- [ ] **Demo video**, 2–4 minutes: real screen recording, signup → paste link → matched results. No slides.
- [ ] **Screenshots** of the actual current UI
- [ ] **Redirect URIs and scopes**: exactly what the app uses, nothing aspirational
- [ ] **Data handling note**: what you store, for how long, and that Spotify metadata is cached with a refresh window rather than mirrored

Submit from the app detail page in the Developer Dashboard via **Request Extension**.

## Record the demo now

Even at low MAU, this is the part reviewers judge:

1. Open the product at the real domain (0:00–0:20)
2. Sign up as a new user (0:20–0:40)
3. Paste a Spotify artist link (0:40–1:00)
4. Discography arrives with ISRCs (1:00–1:40)
5. Composition match: registered, unregistered, unmatched (1:40–2:30)
6. Diagnosis and Royalty Care Plan (2:30–3:10)
7. What the artist does next (3:10–3:30)

Record it at 100 MAU or 200,000 — the flow is the same. Doing it early stops the recording from becoming the bottleneck later.

## If it is declined

Expect it, and let it block nothing.

- Ask for the specific reason in the developer community forum; answers are inconsistent but sometimes actionable
- Reapply only after a material change: a real MAU step-change, a new domain, a new use case
- **The product does not change.** Extended Quota raises a ceiling; caching, Deezer and backoff already keep CTA under the Development Mode ceiling at beta and small-launch scale
- If traffic genuinely outgrows development mode before approval, the honest options are throttling lookups, queueing them, or leaning harder on Deezer — not quietly running a public service on a dev client and hoping

## One-line summary

You cannot buy or build your way to 250,000 MAU, so do not plan around the approval. Plan around a product that works without it: Deezer for discography, The MLC for composition, cache everything, and keep the application package warm so that the week the number arrives, you submit.
