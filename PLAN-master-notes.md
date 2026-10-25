# PLAN — Founder master notes (2026-10-25): exports first, then design, then functions · v1

Status: **awaiting approval.** Nothing in this file is built yet unless it says ✅.
Source: founder master notes, 2026-10-25. Order (founder): **Phase 1** 1-click agency exports (what sells the tier) →
**Phase 2** design and layout (user experience) → **Phase 3** functions (so everything can be retested) →
**Phase 4** admin, team and future plans. Each phase is approved and built on its own; questions are at the end of each.

Already done today (publish in Lovable to see them): ✅ WAV embedding (catalog and Embed) · ✅ company-contract signers no longer
land on the passcode page · ✅ First Lyric Entry on every lyric · ✅ share links use the published site + og:url + Copy link ·
✅ billing@ routing · ✅ Founding 100.

---

## PHASE 1 — 1-click agency exports · ✅ approved and BUILT 2026-10-25 (migration 20261025100000 agency_exports to run)

### 1.1 Export your whole catalog, a release, or picked singles (one clear button)
Today: exports exist per song, per release (Export Release on each EP/album card) and for checked songs (checkbox on each row →
bar at the bottom), but they're easy to miss, so it feels like one song at a time.
- ✅ **Export whole catalog** button next to Add song (founder, 2026-10-25): one click → pick the agency → every song in its template.
- Then an **Agency Export** box for choosing a release or picked songs. It opens a 3-step box:
  1. **Which agency?** The MLC · SoundExchange · ASCAP/BMI cheat sheet (each with its ⓘ required fields).
  2. **Which songs?** (•) Whole catalog ( ) A release: [EP/Album list] ( ) Pick songs: checklist grouped Singles · EPs · Albums,
     with "Not exported yet" filter (we record each song's last export per agency, so after registering the whole catalog they
     can export just the new album).
  3. **Check and download:** "12 songs ready · 2 need writer info ⚠️ (fix links) · 1 split warning". Download goes out with
     the ready songs (same shared readiness check, no new rules).
- Plain help line: "One file, every song filled into the agency's own template. Upload it once instead of typing each song."
- Files: `src/components/MetadataUploader.tsx` (button), new `AgencyExportDialog.tsx`, `src/lib/agency-export.ts` (unchanged
  rules; adds an `exported_at` record), migration for `agency_exports (user_id, track_id, agency, exported_at)`.

### 1.2 The MLC: release date and duration aren't in the bulk template
Info box on The MLC export (polished): "The MLC's bulk file has no place for the recording's release date or duration. Have them
ready: after the upload, open each song in The MLC Portal and add them under Recordings. Tip: close the song in My Catalog to
see all its details on one row."

### 1.3 BMI writers with no publisher, and HFA-only publishers (founder's verified scenario)
Facts confirmed by the founder: The MLC bulk upload needs a publisher name + IPI; a BMI writer without a publishing company
still gets 100% of the publisher share from BMI; an HFA-only publisher can upload by entering a placeholder IPI
`123456789`, then deleting it in The MLC Portal once the upload is accepted.
- **Royalty health:** BMI writers with no publisher already count as covered (57b46fe). I'll re-check every path (catalog
  meter, Health Check, Royalty Inspector, report) so none of them takes points off. *Founder saw "Self-published" not clearing
  the hub issue: I'll reproduce it and fix it in the same pass (the hub reads saved songs, so it may be a refresh issue).*
- **MLC export for HFA-only publishers:** when a publisher row has an HFA P# but no IPI, the export fills **123456789** in the
  IPI column and the export box says: "Publisher with HFA only and no other publishing company? We entered the placeholder IPI
  123456789 so The MLC accepts the file. After the upload works, open each song in The MLC Portal and remove that IPI."
- BMI-only writers with no publisher at all: the MLC export lists the writer as publisher (their legal name) with the
  placeholder IPI, same note. *Question 1.*
- Readiness stays the single shared module; this only changes what the MLC file writes and the wording.

**Phase 1 answers (founder, 2026-10-25)**
1. BMI writer with no publisher and no HFA account: the MLC file lists the writer as their own publisher with the placeholder
   IPI 123456789, and the export box says clearly it's a placeholder to remove in The MLC Portal after upload. (The MLC bulk
   template marks PUBLISHER NAME * and PUBLISHER IPI NUMBER * as required, which is why the file needs them.) Founder will log in
   to The MLC to triple-check the process.

---

## PHASE 2 — Design and layout

### 2.1 Global rules (added to BRANDING.md once approved)
- Every email header (logo + name) links to the CTA homepage.
- Every pop-up/message box is only as big as its message (no oversized boxes).
- Every list of contracts, songs and records is alphabetical by default, with filters (type, name, date, signer, email).

### 2.2 Homepage
- **Sales copy review (plan first, you review before any change):** I'll mark the "leaky" spots (where a visitor can leave
  without a reason to stay) and propose sensory, story-led rewrites using pricing psychology: anchoring (show the time an
  agency export saves next to the price), loss aversion ("royalties you're not collecting"), social proof near each CTA,
  one clear next step per section, risk reversal (30-day refund line by the buttons). Delivered as before → after for approval.
- **How it works + Who it's for:** royalty-free photos of real people doing each step (e.g. uploading from a phone), with the
  real CTA screen shown in the photo, toned to CTA colors and dimmed behind the existing animated icons and text so it stays
  easy to read. Sources: Unsplash/Pexels (free commercial licence) + our own screenshots composited in. Titles and text get
  re-spaced around the images.
- **Testimonials:** Admin → Homepage editor (Super admin + Marketing) to swap photo, quote, artist name and location, with
  guard rails (photo crop preview, character limits, can't publish an empty card, undo). One font and size for every card.
- **Tier cards (polished copy, for approval):**
  - *1-Click Agency Exports:* "Export your whole catalog, a release or chosen songs into each agency's own template and
    register in minutes. Save hours of retyping."
  - *Royalty Utility Suite:* "Pick a song and the converters turn your catalog splits into the exact numbers ASCAP, BMI and
    SESAC ask for (each counts shares differently), plus a projected earnings calculator by platform and country."
  - *Collaborator E-Signature Requests:* add "Download signed split sheets".
  - *Catalog Management:* add "Brand your contracts: your logo, colors, tagline and font on every contract you send."
- **Sign-up buttons:** each tier card's button reads **Sign up now** and goes straight to that tier's checkout (account
  creation inside it); only **Sign up free** goes to the free signup.
- **FAQ:** more questions on the homepage in the same space (accordion), plus a full **/faq** page with a search box.
- **Representative email:** mention in one FAQ answer ("after you buy, your agent sends you the email to add CTA as your
  representative"); the step-by-step stays in the registration checklist after purchase. It answers the question early
  without adding steps before they buy.

### 2.3 Profile, onboarding, Edit profile
- ℗ is cut off in the ℗ line circle: fix the field's left padding.
- © / ℗ protection: the symbol sits outside the input as a fixed prefix (can't be deleted), with a hint in the field:
  "2026 Your Name or company".
- Catalog Profile "Rights start / Rights end (blank = …)": use the same **Inception** / **Perpetuity** checkboxes the song
  form already has (built 2026-10-22), with "when to choose them" explainers.

### 2.4 Badges
- Earned badges can be used as the profile picture (picker in Profile). *Avatar on both sides of the artist name: I'd keep one
  avatar on the left and the next-badge card on the right; two avatars compete with the name. Question 2.*
- Badges section: dropdowns by category with earned/total counts.
- Click a badge → it opens large in the middle of the screen with no box, gently floating, description underneath,
  ← → arrows (and swipe) to browse every badge.
- Wording makes it about the user: "You Came Through…" (e.g. "You Came Through: your first master is embedded.").
  I'll send the full rewrite as a list for approval.
- **Master badge list** (how users see them, in awarding order): generated from `badges.ts` as a page in Admin → Badges and
  a PDF (the existing Badge Reference PDF, reordered).

### 2.5 Embed and Catalog layout
- Your new upload icon on the Upload song fields, browser tab icon and app icon (you upload sizes to Lovable; I wire them in).
- In My Catalog, "Replace audio (optional)" becomes **Re-embed**: opens Embed Metadata with this song's details loaded, so
  they add identifiers or producer credits and download a fresh master, with a short note explaining it.
- Artist name in Embed and Catalog: locked; clicking it shows "Your artist name comes from your profile. Change it in Edit
  profile" with a button there.
- "Recorded in" added to Embed Defaults.
- Session area gets **Clear session** (with a confirm).

### 2.6 Royalty Health Hub layout
- Royalty Inspector header: **Royalty Inspector**, description: "Check a song that isn't in your catalog."
- Inspected songs shown clearly (own list with a count), each removable.
- Song Inspector: writer legal name on the same line as the other writer fields.
- **Inspector look:** a detective-gadget character (original, not the TV character) whose tools change with the score: magnifier
  and clues when low, doctor's tools as fields fill in, report treatments near 100%.
- **Celebration at 100%:** I recommend both: the report's score ring pulses and glows green for one beat (green = yes, a
  universal signal), then the CTA night sky fills with stars and shooting stars, some lining up into the song title, with a
  short "the stars aligned" message. Same moment in the Inspector. Respects reduced-motion settings.

### 2.7 AI Protection Hub layout
- "Create a certificate" becomes a dropdown section like My certificates.
- Simple protection symbols (shield-note, human-hand, timestamp) to show what they get.
- The old explainers come back as a step-by-step dropdown under the certificates, with visuals, plus "Are certificates legal
  proof?" in plain words (see 3.8).
- Check a proof manifest: "Your manifest is in AI Protection Hub → My certificates → Bitcoin proof (inside the ZIP)."
- Draft tip: "Drafts days or weeks apart are strong evidence."

### 2.8 Contracts layout
Above each contract's fields, a numbered how-it-works strip: 1 Read the contract · 2 Fill in your details (they fill the
contract) · 3 Adjust the wording if you need to · 4 Sign · 5 Send for signatures.

**Phase 2 answers (founder, 2026-10-25)**
2. The next badge sits in a **circle like the profile picture, on the left** of the artist name; when it's earned, the badge is
   revealed there (locked badges show dimmed/silhouetted until then).
3. Yes: free stock photos (Unsplash/Pexels) composited with our screenshots.

---

## PHASE 3 — Functions

### 3.1 Embed
- Details typed in Embed disappear when you leave the tab: keep the tab mounted and save a draft in the browser until saved.
- Ctrl+Enter: works on PC (Ctrl) and Mac (⌘) only while the cursor is inside the form; make it work anywhere on the tab and show
  "Ctrl+Enter (⌘+Enter on Mac)".
- Album/EP queue: sort dropped files by track number in the tags, then by number in the file name, then name; first song first.
- WAV ✅ (publish to see it in My Catalog).

### 3.2 Catalog
- Prorated upgrade countdown: "N days left to upgrade at the prorated price" in Profile, the plan banner and every upgrade pop-up;
  upgrade prompts wherever a higher-tier feature is tapped (already locked features show the pop-up; I'll add the countdown).
  *Question 4.*
- Delete-song pop-up sized to its message (global rule 2.1).

### 3.3 Royalty Health Hub
- Remove MusicBrainz from the checks and the score (most independent artists aren't listed).
- Bug: 1 song shows as 2. Reproduce and fix.
- Delete Royalty Health reports (My reports → Delete, with confirm).
- Writers and publishers must have a PRO (except BMI no-publisher rule and Self-published, which stay as built).
- Bug: Inspector reached 100% without a duration; duration becomes required for 100%.
- **Generate a Royalty Health Report** button in the Inspector too, so free users get reports.
- Song Health Checklist: covers catalog songs and inspected songs (I'll confirm and label each source).
- Copy section: BMI search by title and performer (not writer); SoundExchange public repertoire link at "confirm it shows up".

### 3.4 Calculators and converters
- Country setting switches the calculator to that country's society and split rules.
- Add SESAC to the formula converter.
- "Choose a song" picker above the Share-on-scale dropdown fills shares from the catalog; manual entry stays.
- Short instructions under it: why each agency counts shares differently, and that results are estimates (no liability for
  miscalculations; Terms already cover estimates, I'll add the line).
- Projected earnings by platform (Spotify, Apple Music, YouTube, YouTube Music, Amazon Music, Pandora, TIDAL, Deezer,
  SoundCloud, Audiomack, TikTok, Instagram/Facebook, plus SiriusXM/radio as performance) and by territory, using published
  per-stream averages with sources and a "rates vary" note.

### 3.5 Split sheets
- Status says **Not yet requested** until a request is sent; **Not signed** only after sending.
- Trial guard: one free Catalog & Collaborate trial per email per rolling year (today the limits are per account, per inviter
  and per network each month; I'll add the per-email yearly rule, which also stops a deleted-and-recreated account). After the trial: can view and download what they entered and still sign what they're sent, but can't add songs
  to split sheets or send new requests.

### 3.6 Personal branding add-on (contracts and split sheets)
- Catalog Management: brand kit in Profile (logo, two colors, tagline, font from a short list); their header replaces CTA's on
  contracts they send.
- Footer: "Generated on camethroughaudio.com · YOUR FIRST STOP BEFORE DISTRIBUTION" (link). Management users and add-on buyers can
  turn it off in settings.
- Catalog & Collaborate add-on: **Personal Branding on split sheets, $14.99/year** (new Stripe price `branding_yearly`).

### 3.7 Badges
- Lyrics: every lyric earns First Lyric Entry ✅; the description counts: "Your 1st lyric", "your 2nd", … "your 100th".
- Same idea for: each album art uploaded, each completed catalog entry, each 100% healthy song, each AI-protected song (Time
  Witness already repeats), each signature (High Five already repeats).
- AI Protection Hub badges: Time Witness exists; I'll add a small AI set (first certificate, 5, 25, first Bitcoin seal).
- Badge art: the code-drawn 4K bedazzled set (instruments, Unbreakable 2–5, Full EP/Album, Checkup Champ, 33 staff badges) is
  rendering now; you approve it before it goes live. New badges in this plan get art the same way.
- Share cards on Facebook: fixed links pushed today; after Publish, test one link in the Facebook Sharing Debugger.

### 3.8 AI Protection Hub
- Draft dates: **Add dates** button with a calendar; add as many as the proof shows (you chose user-entered dates).
- **Fingerprint must match the copy we keep.** Today the certificate fingerprints the original; our backup is compressed
  (720p) so its fingerprint differs. Fix: the manifest stamps **both** fingerprints, the original (the user keeps it) and our
  stored copy, so either one verifies. Keeping every original up to 1 GB is the alternative (storage cost). *Question 5.*
- A Lovable link flashed before the certificate loaded: send certificate/QR links through the published site only (same fix
  as 185eb86) and check the loading screen.
- Verify on Bitcoin: download the .ots **and** the manifest .txt separately, not only as a ZIP.
- QR on the same phone: the certificate page shows "Open your certificate" and "Download proof files" buttons, so no QR scan is
  needed when they're already on their phone.
- Are certificates legal proof? Plain answer for the page (lawyer to review): "Your certificate is evidence, not a court
  ruling. It shows your files existed in this exact form by this date: the Bitcoin timestamp can be checked by anyone, and any
  change to a file changes its fingerprint. Courts decide how much weight evidence gets. Keep your originals."

### 3.9 Contracts and Admin
- Company contract signature block (from Super Admin, every new agreement):
  Company Name: Came Through Audio, LLC · By: (signature, cursive-style but legible) · Printed Name: Qui-Ona Peterson ·
  Title: Founder & CEO. Pre-filled; you sign right before sending.
- Admin contracts: grouped by type, filters (type/name, date, signer, email), alphabetical.
- Signature links landing on the passcode page ✅ fixed today.

### 3.10 Help center
- Automatic chat that answers from our FAQ and docs (trained on our own content), hands over to a live agent when one is
  online, and offers a support ticket when none is. Needs an AI provider and a chat backend (cost to decide). *Question 6.*

### 3.11 Security
- Passwords: 12 characters minimum. Two places: our sign-up/reset forms (I change), and Supabase → Authentication → Providers →
  Email → Minimum password length = 12 (you change; it's the real lock).

**Phase 3 answers (founder, 2026-10-25)**
4. Prorated upgrade window: **30 days** (countdown from purchase).
5. Stamp both fingerprints. It's still **one certificate and the same proof download** (manifest .txt + .ots + how to verify):
   the one manifest simply lists two fingerprints (the original the user keeps, and the copy CTA stores), and the single Bitcoin
   timestamp covers that manifest. No extra certificates or files.
6. Help chat moves to Phase 4 (later).

---

## PHASE 4 — Admin, team and future plans (plans to write, then build)
- **Pre-launch milestone list** in Super Admin (Task Bank, super admin only), seeded with everything I've asked you to remember:
  switch SITE_URL to camethroughaudio.com · remove the passcode gate and `noindex` · Cloudflare move before Nov 11 (cron jobs,
  Stripe webhook URL, secrets) · Stripe live lookup keys + Terms/Privacy links in Checkout + support/receipt email = billing@ ·
  STRIPE_TAX on once Stripe Tax is active · turn off Stripe's own renewal emails · lawyer review (contracts, blueprints, AI
  certificate wording, authorisation agreement) · grant launch gifts · new app icon · SX Direct + MLC Portal rep logins ·
  re-run Lovable security scan · run db-check.sql and every missing migration · create billing@ mailbox.
- **Company outreach kit:** contracts and email templates for labels, music-tech and music-creation companies (mutual NDA,
  partnership/referral agreement, co-marketing, data-sharing addendum, sponsored badge licence, pilot agreement, API/integration
  agreement, letter of intent) plus cold, follow-up and demo-invite emails. Signed from Super Admin with the block in 3.9.
- **Market Research team** (new department): weekly industry news digest, monthly society-policy review (ASCAP, BMI, SESAC,
  GMR, The MLC, SoundExchange, HFA, global PROs) with "what changes for us" notes, quarterly competitor and pricing review,
  milestones and owners; second plan for **AI protection research** (new tools, partners, standards like C2PA, legal updates).
- **Admin calendar:** private super-admin entries, department calendars shared within each department, leads see each other's,
  super admin sees all, and a new **Project Manager** role that sees every team.
- **First employees** (registrations + live chat): one queue where they can pause a registration, answer a chat, then resume;
  virtual handbook, tutorial videos, searchable answer library.
- **Beta testing:** 2 weeks, Mon–Thu 12–2 PM; lifetime membership as compensation; agreement sent from Super Admin; **Grant
  lifetime access** (any tier) for Super Admin and the Head of Marketing; a tester checklist page (worked / didn't / notes); a
  tier-by-tier test plan proving each tier sees only its features.
- **Department plan generator:** tasks → metric goals → milestone deadlines → progress bars; each 100% task earns a badge.
- **Help chat (native, later):** our own chat window inside the site (no outside chat product), answering from our FAQ, docs,
  guides and plan pages (we feed it our content and it quotes it; nothing is trained from scratch), with live-agent handoff in
  the staff queue and a support ticket when no agent is online. Needs an AI model API (e.g. a small, low-cost Claude model)
  for the answers; content updates go live as soon as the pages change.
  **Without an AI model (founder asked, 2026-10-25): yes, possible.** Version 1 can be a search-based answer bot: it matches the
  question's words against our FAQ and docs and replies with the best-matching answer and a link (plus "Was this helpful? /
  Talk to an agent"). Free to run and never makes things up, but it can't understand unusual wording or combine two answers.
  Start there; add the AI model later only if unanswered questions pile up (the staff queue shows which ones).
- **Employee badges:** the 33 staff badges rendering now, then milestone badges per department.
- **Backups and rebuilding:** the code is safe in GitHub (rebuild = clone, `bun install`, set secrets, deploy to Cloudflare per
  PLAN-cloudflare-hosting). What isn't safe yet: the database and stored files. Plan: a weekly automatic database dump and
  storage copy to a private backup (GitHub Action + a storage bucket you own), a written list of every secret in a password
  manager, and a tested restore drill once before launch.

---

## Answers to direct questions in the notes
- **Representative email on the homepage?** One FAQ line, details after purchase (2.2).
- **Ctrl+Enter on Mac vs PC?** Mac uses ⌘+Enter; both already work inside the form; 3.1 makes it work anywhere and shows both.
- **Stars or green?** Both: one green pulse for "yes", then the stars (2.6).
- **Are certificates legal?** They're evidence of existence and timing, not proof of ownership by themselves (3.8).
- **Rebuild from source code?** Yes, plus the database and files backups in Phase 4.
- **Password length?** 3.11.
