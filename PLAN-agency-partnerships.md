# PLAN — Agency data partnerships (The MLC, ASCAP, BMI, SoundExchange, SESAC) · v1

Status: **approved 2026-10-23**. Nothing is sent until the founder sends it.
Goal: written permission to search each agency's public repertoire from the Royalty Health Check, when the user clicks one button, so the report shows **verified** matches and mismatches instead of catalog-only estimates.

---

## 1. What exists today (checked 2026-10-23)

| Agency | Public data today | What we ask for | Odds |
| --- | --- | --- | --- |
| **The MLC** | Free public works database; the law (17 U.S.C. §115(d)(3)(E)(v)) requires public access and bulk machine-readable copies. It already runs a **Public Search API** (title + writers → ISWC, MLC song code, writers) and a **Bulk Data Access** program. Contact: **bulk.data@themlc.com** | API credentials for user-initiated lookups | **High. Start here.** |
| **ASCAP + BMI** | **Songview**: one free public database of both, and since Sept 2025 adding **SESAC and GMR** works (38M+ works). On ascap.com and bmi.com; no public API we know of | A Songview data license or API access for user-initiated lookups | Medium. Needs a relationship |
| **SoundExchange** | **ISRC Search** (with IFPI): free web lookup by ISRC or artist/track, CSV download | API or data access; a referral partnership (we send artists who haven't registered) | Medium |
| **SESAC** | Through Songview (above); writer membership is invitation-only | Covered by the Songview ask | Low priority alone |

Rule until each yes: **no automated scraping** of any agency site. Users keep clicking the public search links themselves (current behaviour). Breaking terms of use would end a partnership before it starts.

## 2. Why they should say yes (one pitch, tailored per agency)

**Who we are:** Came Through Audio, LLC (Atlanta, GA). YOUR FIRST STOP BEFORE DISTRIBUTION. Independent artists embed their metadata, keep one master catalog, settle splits and get a Royalty Health Check on every song **before** it reaches a distributor or an agency.

**What it does for them:**
- **Cleaner registrations at the source.** Our checks happen before registration: legal names, IPI, ISRC/ISWC and splits that total 100%. Fewer conflicts, fewer unmatched works, fewer support tickets.
- **Fewer unclaimed and unmatched royalties.** The MLC's and SoundExchange's public missions include getting money to the right people. We send them artists who are owed money and haven't registered.
- **It continues their own work.** Songview exists to make ownership data transparent and consistent; we bring that data to the artist at the moment they can still fix it.
- **Read-only, user-initiated, low volume.** A lookup happens only when a signed-in user clicks for their own songs. No resale, no bulk copying, rate limits honoured, attribution shown ("Results from Songview").
- **Members, not just users.** We point unaffiliated writers to join a PRO and register works; agencies gain new, well-documented members.

**What it does for artists:** one click shows which songs are registered, where the data doesn't match, and exactly what to fix, in plain language.

## 3. How a pre-launch startup gets a yes

1. **Lead with The MLC.** The public API is already built for third parties. A yes there becomes proof for the others ("already approved by The MLC").
2. **Ask small.** Ask for a 20-minute call and API terms, not a contract or a press release.
3. **Find the right person.** Use the published data contact where there is one (The MLC). For Songview/BMI/ASCAP/SoundExchange: LinkedIn search for titles like *Data Partnerships, Business Development, Licensing, Member Services technology*; a warm intro (lawyer, distributor contact, PRO writer rep you already know) beats a cold email.
4. **Have the basics ready before sending:** LLC registration, website on camethroughaudio.com (not the lovable.app address), privacy policy, security page (/docs/security), a 60-second demo video using a test catalog, a one-page data-use statement (below).
5. **Confidentiality (pre-launch rule):** share only what's needed and ask for a mutual NDA before the demo, since nothing is public until launch.
6. **Bring numbers after launch.** Anonymous totals from real catalogs ("41% of songs checked were missing an ISWC") are the strongest follow-up.
7. **Show up where they are:** The MLC's data program webinars, ASCAP Experience, BMI and SoundExchange events, Atlanta industry events.
8. **Follow up:** day 7 (short nudge), day 14 (a new fact or the demo link), then once a month. Log every contact in Admin.

## 4. One-page data-use statement (attach to every email)
- Lookups only when a signed-in user requests them, for songs in their own catalog.
- Read-only; no storage beyond the user's own report; no resale or redistribution; no bulk copying.
- Rate limits and terms of use honoured; source attribution on every result.
- Users are pointed to the agency's own portal to fix or register anything.
- Security: encrypted connections, row-level security on every user's data, staff access controlled.
- Contact: registrations@camethroughaudio.com · Came Through Audio, LLC · 789 Garden Walk Blvd, Atlanta, GA 30349

## 5. The email (one template, one paragraph changed per agency)

**Subject:** Partnership request: sending your agency cleaner song data from independent artists

> Hello {First name},
>
> I'm **Qui-Ona Peterson**, known in music as **Karma Came**, founder of **Came Through Audio**, an Atlanta company built to be independent artists' **first stop before distribution**. Before a song reaches a distributor or an agency, our members embed their metadata, keep one master catalog, settle their splits and run a **Royalty Health Check** that shows what's missing before they register.
>
> {Agency paragraph}
>
> **What we're asking:** permission to run read-only lookups in {database} when a signed-in member clicks "Check my songs", for their own catalog only. The results tell them what's registered, what doesn't match, and how to fix it in your portal.
>
> **What it means for {Agency}:**
> - Registrations arrive with legal names, IPI numbers, ISRC/ISWC codes and splits that add up to 100%
> - Fewer unmatched works and unclaimed royalties
> - Artists who haven't registered yet are sent straight to you
>
> I've attached a one-page data-use statement. Could we set up a 20-minute call in the next two weeks? I'm glad to share a short demo under NDA.
>
> Thank you for your time,
> **Qui-Ona Peterson**
> Founder, Came Through Audio, LLC
> registrations@camethroughaudio.com

**Agency paragraphs:**
- **The MLC:** "We'd like to use The MLC Public Search API so members can confirm their songs are registered and linked to their recordings. Our checks already make sure every song has its ISRC, ISWC and shares in place before it's registered."
- **ASCAP / BMI (Songview):** "Songview made ownership data transparent across the PROs. We'd like to bring that data to independent writers at the moment they can still fix it, before conflicting registrations reach you."
- **SoundExchange:** "Many independent artists don't know SoundExchange exists. Our Royalty Health Check flags every artist and master owner who hasn't registered and sends them to you, and we'd like to use ISRC Search data to confirm their recordings."
- **SESAC:** "With SESAC works joining Songview, we'd like SESAC-affiliated writers to see their works in the same check."

Designed HTML version: rendered with the shared `emailLayout()` brand shell (logo, tagline, cobalt accents, legal footer). The founder sends it from registrations@camethroughaudio.com, one agency at a time, never as a bulk mailing.

## 6. Timeline
| When | Step |
| --- | --- |
| Now | Approve this plan and the email; prepare §3.4 basics; demo video on a test catalog |
| Week of Nov 3 | Domain on camethroughaudio.com (Cloudflare move), then email **The MLC** first |
| +2 weeks | ASCAP/BMI (Songview) and SoundExchange, mentioning The MLC conversation |
| Launch +60 days | Follow up everyone with anonymous catalog numbers |
| On each yes | Build that agency's lookup; its organ in the report becomes **Verified** |

## Decisions for you
1. ~~Signature~~ Decided 2026-10-23: sign with the legal name **Qui-Ona Peterson**, stage name Karma Came mentioned once in the opening line.
2. ~~Demo under mutual NDA before launch?~~ Yes (founder, 2026-10-25).
3. ~~Sender address?~~ partners@camethroughaudio.com (founder, 2026-10-25).
