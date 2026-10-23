# PLAN — Simpler contracts: fewer fields, * for required, cautions only when you sign · v1

Status: **Awaiting founder approval (2026-10-23). Nothing built yet.**
Source: founder request, 2026-10-23: "the written testimonial says optional but it's acting as a requirement", "the process is a little tedious", clean up the 107 uploaded files in resources/contracts_blueprints, "get user input fields down to a minimum", "* next to the required field", cautions pop up only when clicking sign, "all admin contracts are governed in the state of Georgia".

---

## 0. What's wrong today

- **Optional isn't optional.** Every blank field leaves a `[Label]` gap in the text, and *any* gap blocks **Lock & request signatures**. So "Written testimonial (optional)" blocks the release. Same for every field on every contract.
- **A wall of ⚠️** under the contract lists every blank before the person has even started.
- **Too many clicks:** fill details → parties → read text → Lock → then email each party one by one → then sign yourself.
- **The 75 uploaded contracts are one generic template** with a different 6-line "Deal Schedule" pasted in. Each has about **30 blanks** (`[SPECIFY]`, `[DATE]`, `[NUMBER]`, `[NEGOTIATED TERMS]`…), says "Party A / Party B", and leaves the real deal terms (who owns what, when money is paid, what happens if someone cancels) for the musician to write. The 22 blueprints and 10 cheat sheets are the same: blueprints are 8 generic steps with "Action: ____ Owner: ____" lines that say nothing specific to the topic.

---

## 1. The new form rules (every contract, customer and admin)

1. **Only a few fields are required, marked with \*.** Usually the song or project, the money, and the date it happens. Everything else is **pre-filled with a sensible, common default** you can change, or is optional.
2. **Optional fields never block anything.** If left blank, the contract uses fallback wording instead of a `[gap]`. Example: testimonial left blank → *"Any written testimonial Participant approves in writing later."*
3. **No ⚠️ list while you're filling in.** Required fields just show a small \*.
4. **Cautions appear only when you click Sign & send**, in a short pop-up:

```
┌──────────────────────────────────────────┐
│  Almost there: 2 things to add           │
│                                          │
│  • Song title            Take me there → │
│  • Producer's email      Take me there → │
│                                          │
│  Everything else is optional.            │
│                       [ Keep editing ]   │
└──────────────────────────────────────────┘
```
   "Take me there" scrolls to the field, opens its section and puts the cursor in it. Only required items and party name/email ever appear here.
5. **Effective date defaults to today.** Pick another date only if needed.
6. **Admin (Company) contracts: governing law is fixed to the State of Georgia** and the field is removed. *Your title* is pre-filled from the last one you used (first time: "Founder & CEO").
7. **Customer contracts: governing law** is pre-filled with the state/country the user last used and remembered for next time; if left blank, the text reads "the laws of the state where {first party} lives". Not required.

### Before → after (Photo, Video & Testimonial Release in Admin)

| Before | After |
| --- | --- |
| 8 fields, all must be filled to lock | **0 required details**: name + email of the participant only |
| Your title, Effective date, Materials, Testimonial "(optional)", What they receive, Where it may appear, How credited, Governing law | Your title (pre-filled), Date (today), Materials (pre-filled), Testimonial (optional), What they receive (pre-filled: the 3-month launch gift), Where it may appear (pre-filled), Credit (pre-filled "First name and city"). Georgia fixed. |

---

## 2. Fewer steps

The editor becomes three titled, collapsible sections (BRANDING §3), with a one-line summary when closed:

```
▸ Details · 2 of 2 required filled ✓
▸ Who's signing · You + Jordan Smith ✓
▸ Read the contract · 2 pages
                                   [ Save draft ]  [ Sign & send ]
```

**Sign & send** (one click, replacing Lock → Email each → Sign):
1. checks the required items (pop-up above if anything's missing),
2. locks the text (same frozen text + SHA-256 as today),
3. emails every other party their request at once (company contracts: the private link + code email, as now),
4. opens your signature box right there so you sign immediately.

Copy link / Resend stay on each party afterwards. Nothing about the signature evidence changes.

---

## 3. The 75 contracts, rewritten

Each one becomes an app blueprint (fill in, e-sign, PDF), written the way the current 8 are: plain language, named roles (Artist, Producer…) instead of Party A/B, real terms already decided, numbered clauses, with a "When to use" line and 4–6 "Key terms" explained in plain words. Common music-business norms are written in so the user doesn't have to invent them: payment timing, credit, who owns the master/composition, no uncleared samples, cancellation, confidentiality, no AI training on the other side's material without consent, the shared General Terms and the e-signature clause.

Where an existing app blueprint covers the same deal (Producer, Exclusive and Non-Exclusive Beat License, Featured Artist, Session Musician, Videographer, Photo/Video Release, Label License), the two merge into one under the existing id, so saved drafts still open.

Shown in My Catalog → Contracts as 10 collapsible categories (Music Production, Management, Rights & Distribution, Visual, Fashion & Beauty, Influencers & Brands, Podcasting, Live Performance, Business, Events), with search.

**\* = you fill in. Everything else is pre-filled and changeable.** Parties (legal name + email) are always required and not listed. Song/catalog pickers fill titles from My Catalog.

| # | Contract | You fill in (\*) | Pre-filled (change if you want) |
| --- | --- | --- | --- |
| 1 | Music Producer | Song\*, Fee\* | 50% on signing / 50% on delivery; 3% producer points from first stream; producer 50% of composition; "Produced by {Producer}"; WAV mix, instrumental + stems in 30 days; artist owns master |
| 2 | Exclusive Beat License | Beat title\*, Fee\* | Unlimited streams/sales, worldwide, forever; 0% points; earlier leases: none; producer 50% publishing; no Content ID by producer |
| 3 | Non-Exclusive Beat License | Beat title\*, Fee\* | 500,000 streams, 5,000 sales, 1 video, 3 years; upgrade to exclusive any time at producer's price; no sync; producer 50% publishing |
| 4 | Beat Buyout & Rights Assignment | Beat title\*, Price\* | All master + producer's share of composition transferred unless "keep writer share" is ticked (default ticked: producer keeps 50% writer share); stems in 7 days |
| 5 | Songwriter Collaboration & Split | Song\* | Writers, roles and shares pulled from the song's writers in My Catalog (split must total 100%, shown as ⚠️ only at sign); each registers their own share |
| 6 | Featured Artist | Song\*, Fee (optional, default "no fee") | One verse/hook delivered in 14 days; main artist owns master; feature credit "feat. {Featured}"; feature may post the song once released; feature's writer share per split sheet |
| 7 | Recording Session Musician | Instrument\*, Rate\* | Work-for-hire: artist owns the recording; paid within 7 days of session; credit in liner/metadata; no royalties |
| 8 | Background Vocalist | Song\*, Fee\* | Same as 7; edits/tuning allowed; credit "Background vocals by…" |
| 9 | Recording Studio & Engineer | Session date\*, Hourly rate\* | 50% deposit to book; overtime at the same rate; cancel 48 h before or lose deposit; raw files + session backup given at end; artist owns recordings |
| 10 | Mixing & Mastering | Song(s)\*, Fee\* | 2 revision rounds; WAV 24-bit + MP3 + instrumental; 50/50 payment; delivery 14 days; artist owns |
| 11 | Remix | Song\*, Fee or split\* | Original artist owns the remix master; remixer credit "{Remixer} Remix"; release only with original artist's approval |
| 12 | Sample Clearance & Interpolation | Sampled song\*, Fee\* | Master + publishing cleared together; original owners' share of new composition 25%; worldwide, forever |
| 13 | Artist Management | Commission %\* (default 15%) | 1-year term, renews yearly unless ended with 30 days' notice; excluded: past deals, songwriting already signed; sunset: 50% commission for 1 year after ending on deals made during the term; manager can't sign for the artist without written OK; expenses over $250 need approval |
| 14 | Booking Agent | Commission %\* (default 10%) | Non-exclusive, artist's home country; only bookings the agent secures; cancellations: no commission on unpaid shows; agent can't accept a show without artist approval |
| 15 | Publicist & PR | Monthly fee\* | 3-month campaign; no guaranteed coverage; artist approves every press release; expenses over $100 need approval; monthly report |
| 16 | Music Marketing & Promotion | Fee\*, Ad budget | No guaranteed streams/followers; no bots or fake streams (agency pays if the distributor penalizes); artist approves creatives; weekly report |
| 17 | Social Media Management | Monthly fee\* | Artist owns accounts and content; manager added as a team member, never given the password; artist approves posts 24 h before; 30-day notice to end |
| 18 | Independent Contractor | What they'll do\*, Rate\* | Contractor, not employee; paid within 15 days of invoice; hiring party owns the work once paid; confidentiality |
| 19 | Confidentiality (NDA) | — (nothing) | Mutual; covers unreleased music, business and personal info; 3 years; normal exceptions |
| 20 | Music Distribution | Release(s)\* | Non-exclusive; worldwide; artist keeps 100% ownership; distributor's share as stated by them (field, default 15%); takedown within 30 days of request; data export on request |
| 21 | Publishing Administration | Admin fee %\* (default 15%) | Artist keeps copyright; 3 years + 1 year collection; songs listed from My Catalog; statements twice a year; songs revert at end |
| 22 | Music Catalog Administration | Fee\* | Songs from My Catalog; admin can register but never change bank/tax/password; handoff of all records on ending |
| 23 | Sync License (composition) | Song\*, Project\*, Fee\* | Non-exclusive; all media; worldwide; perpetual; cue sheet filed by licensee |
| 24 | Master Use License | Song\*, Project\*, Fee\* | Same as 23 for the recording; no remix or edits beyond length |
| 25 | Copyright Assignment | Work\*, Payment\* | Full assignment, worldwide, forever; assignor keeps credit; both sign anything else needed to record the transfer |
| 26 | Music Video Director | Song\*, Fee\*, Shoot date\* | 50/50 pay; 2 revisions; final cut by artist; raw footage delivered; credit "Directed by"; director gets cast/location releases |
| 27 | Photography Services | Shoot date\*, Fee\* | 20 edited photos in 14 days; artist may use for all promotion and covers forever; photographer may use in portfolio; credit where practical |
| 28 | Graphic Design & Cover Art | Project\*, Fee\* | 3000×3000 JPG + PNG + source files; 2 revisions; artist owns once paid; designer confirms fonts/stock are licensed |
| 29 | Photo & Video Model Release | — (nothing) | See §4 sample |
| 30 | Video Production Crew | Role\*, Day rate\*, Shoot date\* | Overtime 1.5× after 10 h; artist owns footage; confidentiality; crew follows safety lead |
| 31 | Video Location Release | Address\*, Shoot date\*, Fee | Leave as found; damage repaired at producer's cost; may show the property in the video forever |
| 32 | Video Editor & Post-Production | Project\*, Fee\* | 2 revisions; 1080p + 4K MP4 + project files; 14 days; artist owns |
| 33 | Fashion Designer Collaboration | Collection name\*, Revenue split\* (default 50/50) | Costs split same as revenue; each keeps own trademarks; co-owned designs |
| 34 | Custom Wardrobe & Costume | Item(s)\*, Price\*, Due date\* | 50% deposit; 2 fittings; artist owns the pieces once paid; designer may photograph for portfolio |
| 35 | Wardrobe Stylist | Date\*, Fee\* | Wardrobe budget needs approval; rentals returned by stylist; damage paid by whoever caused it; credit "Styled by" |
| 36 | Hairstylist | Date\*, Fee\* | Call time set by artist; cancel 48 h before or 50% due; stylist brings own products and tools |
| 37 | Makeup Artist | Date\*, Fee\* | Same as 36; allergy check before; kit fee included |
| 38 | Merch Design & Licensing | Design\*, Royalty %\* (default 10%) | Products: apparel and accessories; worldwide; artist approves samples |
| 39 | Merch Manufacturing & Fulfillment | Product\*, Unit price\*, Quantity\* | Sample approved before run; defects replaced free; ships in 21 days |
| 40 | Influencer Collaboration | Fee\*, Posts\* | #ad disclosure; artist may repost for 1 year; post within 14 days |
| 41 | Brand Sponsorship & Endorsement | Brand\*, Fee\* | No exclusivity unless set; #ad disclosure; brand approves posts within 48 h |
| 42 | Social Promo Campaign | Fee\*, Posts\* | Same as 40 with links/hashtags field |
| 43 | UGC Creator | Videos\*, Fee\* | Paid-ad rights 1 year; no whitelisting unless ticked; 1 revision; raw files |
| 44 | Affiliate & Referral | Commission %\* | 30-day tracking window; paid monthly over $25; no false claims; #ad disclosure |
| 45 | Brand Ambassador | Brand\*, Fee\* | 6 months; category exclusivity only in the brand's product type |
| 46 | Social Content License | Content\*, Fee\* | Organic + paid use 1 year, worldwide; no edits that change meaning |
| 47 | Podcast Co-Host | Show name\*, Revenue split\* (default 50/50) | Co-owned show; decisions together; leaving host keeps archive share, can't take the name |
| 48 | Podcast Guest Release | — (nothing) | Free appearance; editing allowed without changing meaning; worldwide, forever |
| 49 | Podcast Producer & Editor | Fee per episode\* | 3-day turnaround; 1 revision; show owns everything |
| 50 | Podcast Sponsorship & Ads | Fee\*, Episodes\* | Host-read; sponsor approves script; makegood episode if missed |
| 51 | Interview & Media Release | — (nothing) | Same as 48 for interviews/press |
| 52 | Live Performance Booking | Venue\*, Date\*, Fee\* | 50% deposit; 45-minute set; rest paid before going on stage; cancel 14 days out = deposit kept; no recording without OK |
| 53 | Technical Rider | — (nothing; checklist with ticks) | Stage plot, inputs, monitors, backline, power, soundcheck pre-filled for a typical small band; edit lines |
| 54 | Hospitality Rider | — (nothing; checklist) | Private room, water, meals, guest list 2, parking pre-filled |
| 55 | Touring Band Member | Tour dates\*, Show fee\* | Rehearsals paid at half fee; per diem $30; travel and lodging covered; paid weekly |
| 56 | Live Session Musician | Date\*, Fee\* | Rehearsal included; no recording without OK; credit on socials |
| 57 | Musical Director | Fee\* | Charts and arrangements owned by artist; leads rehearsals; per show/rehearsal fee field |
| 58 | Backup Singer (live) | Date\*, Fee\* | Same as 56 |
| 59 | Dancer & Choreographer | Date\*, Fee\* | Choreography licensed to artist for the show and videos; safety first; rehearsal hours field |
| 60 | Concert Promoter | Venue\*, Date\*, Guarantee\* | Guarantee vs 80% of net door (whichever is higher); settlement on the night; promoter pays marketing |
| 61 | Concert Production & Sound | Date\*, Fee\* | Load-in 3 h before doors; provider insures own equipment |
| 62 | Tour Manager | Weekly fee\* | Spending over $500 needs artist OK; daily settlement report |
| 63 | Artist Collaboration & Joint Release | Song/project\*, Split\* (default 50/50) | Co-owned master; costs split the same; both approve release date; mediation before court |
| 64 | Label Services | Services\*, Fee or %\* | Artist keeps ownership; 2 years; quarterly statements |
| 65 | Business Partnership | Business name\*, Ownership %\* | Equal votes unless set; profits paid quarterly; 90-day buyout right if someone leaves |
| 66 | Venue Rental | Venue\*, Date\*, Fee\* | 50% deposit; renter cleans up; cancel 30 days out = refund minus 10% |
| 67 | Release / Listening Party | Event date\*, Fee\* | Planner handles vendors within budget; artist approves spending |
| 68 | Meet & Greet / Fan Experience | Event\*, Price per fan | No refunds within 48 h; photos allowed; accessibility contact |
| 69 | Special Guest Appearance | Date\*, Fee\* | 1 hour; travel covered; photos/video for promotion |
| 70 | Event Planning | Event date\*, Fee\* | Same as 67, wider scope |
| 71 | Event Photo & Video | Date\*, Fee\*, Hours | Edited gallery in 14 days; client may use everything for promotion |
| 72 | Event Staffing | Role\*, Hourly rate\* | Contractors, not employees; paid within 7 days |
| 73 | DJ Performance | Date\*, Fee\* | 2-hour set; venue holds the music licenses; 50% deposit |
| 74 | Event Sponsorship | Sponsor\*, Fee\* | Logo on flyers and stage; no exclusivity unless set |
| 75 | Event Vendor & Concession | Booth fee\* | Vendor holds own permits and insurance; sales report optional |

The founder's company template "Photo, Video & Testimonial Release" keeps its own wording (incl. §11 launch gift and §12 pre-launch confidentiality) and just gains the new field rules.

---

## 4. Sample: #29 Photo & Video Model Release (complete, as the user would see it)

**Details** (all pre-filled, none required)
- Project: *"{Artist}'s music, music videos, artwork and promotion"*
- What they receive: *"Credit and the chance to appear in the project. No payment."*
- Where it may appear: *"Anywhere, in any media, worldwide"*
- Things it won't be used for (optional): blank → *"Nothing else is excluded."*

**Text**
```
PHOTO & VIDEO MODEL RELEASE

This release is made on {today} between {Artist} ("Artist") and {Model} ("Model").

1. PERMISSION
Model allows Artist to photograph, film and record Model for {project}, and to use Model's
image, likeness, voice and name in those photos and recordings.

2. WHERE IT MAY BE USED
Artist may use the photos and recordings {uses}, forever, including on streaming services,
social media, websites, ads, artwork and press. Artist may edit, crop and combine them with
other material, but will not use them in a way that is sexual, defamatory or suggests Model
endorses something they haven't agreed to. {exclusions}

3. WHAT MODEL RECEIVES
{consideration} No other payment or royalty is owed.

4. OWNERSHIP
Artist owns the photos and recordings. Model does not need to approve the final versions.

5. NO OBLIGATION
Artist may use the material, but doesn't have to.

6. RELEASE OF CLAIMS
Model releases Artist from claims of invasion of privacy, right of publicity or
defamation arising from the uses allowed here.

7. AGE
Model confirms they are 18 or older. If not, a parent or legal guardian signs too.

GENERAL TERMS … (shared, incl. e-signatures)
```

---

## 5. The 22 blueprints and 10 cheat sheets

- **Blueprints:** every one is today the same 8 generic steps. Rewrite each with real, topic-specific steps and links into the app where it helps. Example, *05 Royalty Registration & Collection*: 1) Join a PRO as a writer (ASCAP, BMI or your country's society; link to the worldwide list) 2) Get your IPI 3) Set up a publishing designee or self-publish 4) Register each song with your PRO (My Catalog → Ready to register) 5) The MLC for mechanicals 6) SoundExchange for the recording 7) Check statements every quarter (Royalty Health Check). No empty "Owner/Due/Evidence" lines.
- **Cheat sheets:** already useful; light tidy only (one shared "Starting setup" + the genre-specific tips, consistent headings).
- Shown as **Guides** next to Contracts (titled, collapsible, readable in the app, PDF download), not as fill-in contracts.

---

## 6. Questions for you

1. **Defaults with money terms** (e.g. 3% producer points, 15% manager commission, 50% composition share): OK to pre-fill these common amounts (visible and changeable), or leave money terms blank and required?
2. **Sign & send in one click** (locks, emails everyone, you sign right away): OK to replace the current separate steps?
3. **Where should the Guides (blueprints + cheat sheets) live:** inside Contracts, in Masterclasses, or their own tab? Which plan unlocks them (suggest free, as a reason to sign up)?
4. **The uploaded .docx files:** once converted, remove them from the repo (the app makes the PDFs), or keep them as backups?
5. **Order of work:** suggest (a) form rules + Sign & send + Georgia + testimonial fix first (one push, fixes your release today), then (b) the 75 contracts in batches by category, then (c) guides.

Every template stays a general starting point, not legal advice (CONTRACT_DISCLAIMER stays on every screen). **Have a music attorney review them before launch.**

---

## Files (when approved)
- `src/lib/contract-blueprints.ts`: field `required` + `fallback`, Georgia on company templates, today's date, merged/new blueprints (likely split into `src/lib/blueprints/<category>.ts`).
- `src/components/Contracts.tsx`: \* labels, collapsible sections, Sign & send, missing-items pop-up with "Take me there", category dropdowns + search.
- `src/lib/contracts.ts`, `src/lib/contracts-email.functions.ts`: send all requests in one call.
- New `src/lib/guides.ts` + guide viewer component.
- `src/lib/contract-blueprints.test.ts`: optional fields never block; every blueprint renders with no `[gaps]` once required fields are filled.
- No database change.
