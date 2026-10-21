# PLAN: Tier comparison, badge swaps and sponsored badges

Status: **approved and built (2026-10-19); Option A (in-app Task Bank) chosen. Migrations need applying in Lovable.**

---

## 1. Tier cards become one comparison chart

### Problems today
- Each card lists only *its own* features (3, 3, 4 and 2 items), so the columns end at different heights, and the $89.99 card looks like the *smallest* plan.
- The "Includes everything in…, plus:" lead lines make people add up the cards in their heads.
- The Free card says both "Unlimited Royalty Health Audits" and "Free Royalty Health Check", which is the same thing twice.
- The **Catalog and Collaborate** card is hard-coded as the dark, highlighted card in both `/plans` and the workspace **View Plans** dialog, whatever plan the user is actually on.
- The same card markup is copied in `src/routes/plans.tsx` and `src/routes/workspace.tsx`.

### Design (principles: alignment, repetition, proximity, progressive contrast)
- **One grid, four columns.** The plan headers sit on top, and every feature is a row across all four columns, so each benefit lines up horizontally and prices read left to right ($0 → $89.99).
- **Cumulative checkmarks.** Each column shows everything that plan includes. Catalog Management gets a check on every row, so the $89.99 plan visibly has the most.
- **Grouped rows** (proximity), with short group labels: Royalty health · Catalog & metadata · Collaboration & registration · Business & education.
- **Equal header blocks** (repetition): plan name → price → "Only $X / month" → small **Billed annually** → button. Every header is the same height, so the buttons line up.
- **Highlight = the user's plan.** Signed in: their current plan's column gets the Cobalt top border and tint plus a "Your plan" tag. Signed out on `/plans`: Catalog and Collaborate keeps a "Most popular" tag.
- Hover tooltips on each feature stay as they are.
- **Mobile:** the chart becomes four stacked cards, each with the full list (included = ✓, not included = dimmed –), so the comparison still works on a phone.

### Preview (desktop, signed in on Catalog Plus)
```
                         ┌─────────────┬━━━━━━━━━━━━━━━┬─────────────────┬────────────────┐
                         │ Free        ┃ Catalog Plus  ┃ Catalog and     │ Catalog        │
                         │             ┃  YOUR PLAN    ┃ Collaborate     │ Management     │
                         │ $0          ┃ $24.99/yr     ┃ $44.99/yr       │ $89.99/yr      │
                         │ Free forever┃ Only $2.08/mo ┃ Only $3.75/mo   │ Only $7.50/mo  │
                         │             ┃ Billed annually┃ Billed annually │ Billed annually│
                         │ [Included]  ┃ [Current plan]┃ [Upgrade]       │ [Upgrade]      │
ROYALTY HEALTH           ├─────────────╂───────────────╂─────────────────┼────────────────┤
Unlimited Royalty Health Checks    ✓   ┃      ✓        ┃       ✓         │       ✓        │
Unlimited Split Sheet Signatures   ✓   ┃      ✓        ┃       ✓         │       ✓        │
CATALOG & METADATA                     ┃               ┃                 │                │
Unlimited Core Metadata Embedding  –   ┃      ✓        ┃       ✓         │       ✓        │
Unlimited Asset Cataloging & Storage – ┃      ✓        ┃       ✓         │       ✓        │
COLLABORATION & REGISTRATION           ┃               ┃                 │                │
Unlimited Collaborative Split Sheets – ┃      –        ┃       ✓         │       ✓        │
Unlimited Collaborator E-Signatures  – ┃      –        ┃       ✓         │       ✓        │
Unlimited 1-Click Agency Exports     – ┃      –        ┃       ✓         │       ✓        │
Unlimited Royalty Utility Suite      – ┃      –        ┃       ✓         │       ✓        │
BUSINESS & EDUCATION                   ┃               ┃                 │                │
Unlimited Contract Blueprints        – ┃      –        ┃       –         │       ✓        │
Unlimited Industry Masterclasses     – ┃      –        ┃       –         │       ✓        │
```

### Copy changes
| Where | Before | After |
| --- | --- | --- |
| Plans data (global) | Unlimited Royalty Health Audits | **Unlimited Royalty Health Checks** |
| Free tier | "Free Royalty Health Check" (second row) | removed, because it repeats the row above |
| `/plans` and View Plans footer | "Free plans include unlimited royalty audits & unlimited split sheet signatures. Billed annually." | **removed**; "Billed annually" appears under each paid price instead |
| Home page "includes" strip | Unlimited Royalty Audits | Unlimited **Royalty Health Checks** |
| Home page note | "…unlimited royalty audits & unlimited split sheet signatures." | "…unlimited royalty health checks & unlimited split sheet signatures." (kept, reworded) |

### Files
- `src/lib/plans.ts`: replace `FREE_CARD`/`PLAN_CARDS` with `PLAN_TIERS` (price, monthly, priceId) and `PLAN_FEATURES` (title, tip, group, `from: Tier`). "Included in a plan" is just `hasTier(plan, feature.from)`, the same rule the app already uses for access.
- `src/components/PlanComparison.tsx` (new): the shared chart, with props `currentTier?` and `onSelect`.
- `src/routes/plans.tsx`: use the chart, and read the signed-in user's tier with `useBilling`.
- `src/routes/workspace.tsx`: the View Plans dialog uses the chart with the current tier (including the sandbox preview tier).
- `src/routes/index.tsx`: the copy changes above.
- No change to price IDs, Paddle, billing or access rules.

---

## 2. Badge swaps

- **Producer profile badge:** `bedazzled_mpc.png` → `playful/producer/platinum_laptop.png` (the laptop and beat box, with no trademark).
  - Users who already picked the old badge have that path saved. `ArtistAvatar` will map the old path to the new one, so their avatar updates automatically and no saved data is changed. `bedazzled_mpc.png` is then deleted from the repo.
- **Party popper:** `.cta-party` switches to your updated `playful/party_popper.png`. The older `party_popper_bedazzled.png` becomes unused and is deleted (per "remove duplicates").
- Files: `src/components/ArtistOnboarding.tsx`, `src/lib/badges.ts` (legacy alias), `src/came-icons.css`.

---

## 3. Sponsored badges plan, saved to the Marketing task bank

There is **no task bank in the app yet.** The Marketing & Sales department exists in `/admin`, but it has no tools ("No dashboard tools for this department yet"). See question below.

### Plan content (goes in as the first task bank entry)
**Goal:** music companies sponsor CTA badges. Musicians unlock discount codes and perks, CTA earns sponsorship revenue, and sponsors reach independent artists in a channel that feels like a reward, not an ad.

1. **Trademark rule:** never use a company's name, product name or logo in a badge without a signed co-branding license. Default badges stay generic, like the new laptop and beat box.
2. **Badge formats**
   - *Presented-by profile badges*, for example a Producer badge co-designed with a beat-machine or DAW maker.
   - *Sponsored achievements*: hitting a milestone (first 10 embeds, first split sheet) unlocks the sponsor's perk.
   - *Limited-time challenge badges* tied to a sponsor's product launch.
3. **Perks:** unique single-use discount codes per user (preferred, because it's trackable) or a shared code, plus free trials, sample packs and contest entries. Every perk has an expiry and redemption tracking.
4. **Guardrails:** sponsored badges never use Gold or Platinum (those are reserved for CTA prestige awards). Sponsors get aggregate numbers only, never names, emails, PRO/IPI or split data, unless a user opts in. Every sponsored badge carries a visible "Sponsored" label (FTC disclosure).
5. **Target sponsor categories:** beat machines and controllers, DAWs and plugins, microphones and interfaces, headphones and monitors, sample libraries, distributors, mastering services.
6. **Pricing models to test:** a flat fee per badge per quarter, a cost per redeemed code, or a hybrid with a minimum guarantee.
7. **Phases**
   - 0, Research: list 20 targets and draft a one-page pitch with user stats.
   - 1, Pitch kit: badge mock-ups, the audience profile, and a perk menu.
   - 2, Pilot: one sponsor and one badge, for 90 days, measuring unlocks, redemptions and conversion.
   - 3, Productize: sponsor and perk-code tables, a sponsor report, and an in-app perk wallet.
8. **Success metrics:** badge unlock rate, code redemption rate, sponsor renewal, and upgrades from users who earned a sponsored badge.
9. **Legal checklist:** co-branding license, data-sharing terms, disclosure wording, and an expiry/refund policy for codes.

### Option A (recommended): a real Task Bank in `/admin`
- Migration: new `public.department_tasks (id, department, title, body, status [idea | planned | in_progress | done], created_by, created_at, updated_at)`, with RLS through the existing `in_department()`, so Marketing staff and super admins see Marketing tasks only.
- New **Task Bank** tab in `/admin`, shown for each department, where tasks can be added, edited and given a status.
- Seed the sponsored-badges plan above as Marketing & Sales' first task (status: idea).
- Files: a new migration, `src/routes/admin.tsx`, a new `src/components/admin/TaskBankPanel.tsx`, and a staff-verified server function, matching the existing admin pattern.

### Option B: a document only
- `docs/marketing/task-bank/sponsored-badges.md` in the repo now. It moves into the app when a task bank is built.

---

## Questions before I start
1. Approve the chart design and copy changes in section 1?
2. Should Option A (an in-app Task Bank) or Option B (a doc) house the sponsorship plan?

---

# Round 2: awaiting approval

## A. Share images on Facebook, X, Threads and WhatsApp (bug)
Cause: those sites only accept a link and build the preview from the page's `og:image`. The site has no `og:image` tags, and the teaser card only exists in the browser.
Fix:
- Saving the share also uploads the card PNG to a new public `share-cards` bucket, under the user's own folder (they can only write their own).
- A new `/share/$owner/$card` page carries `og:image` set to that card plus the caption title, then sends visitors to sign up.
- Every share button uses that link. The native Share button keeps attaching the file.
- Add a default `og:image` (brand card) to every page.

## B. Enforce paid tiers in the database, not just the UI (security)
Today a Free user could bypass the UI and insert split sheets or contracts directly.
- `public.user_tier(uid)` reads verified Paddle subscription rows (active, trialing, or past_due before period end), counting only the site's configured payment environment (stored in `site_settings`), so sandbox test purchases never unlock live access.
- RLS `WITH CHECK` on inserts: `catalogs` needs Plus, `split_sheets` needs Collaborate, `contracts` needs Management. Existing rows are untouched, and invited signers keep signing for free.
- Agency exports are built in the browser from the user's own catalog, which is already owner-only.
- Limitation: embedding runs in the browser, so it can only be gated in the UI.

## C. Split Sheets layout
- Top row (desktop): Contributor Library (2 columns wide, description kept) | Pending Signatures | Signed Vault.
- Pending and Signed become compact summary cards with counts and a scrollable list.
- Below that: "Choose a song → Generate" full width, then the editor.

## D. Embed page redesign: a "studio session" for embedding song after song
- Dark Studio Mode for the workspace (Primary Black #0b0b0b base, charcoal panels, white text, Electric Cobalt accents), with a light toggle.
- Three zones:
  - Left: session queue. Drop several MP3s at once, and each song shows a completeness ring.
  - Center: track sheet with collapsible cards (Basics, Credits, Lyrics & Art, Identifiers).
  - Right: live "now playing" preview of exactly what gets embedded, plus registration readiness.
- After each embed: "Next song" with "carry over album, artist and writers" chips, Cmd/Ctrl+Enter to embed and go to the next song, and a session counter tied to award progress (Marathon, In the Quiet).

---

# Round 3: awaiting approval (built items are listed at the end)

## E. Artist accounts (one artist per login, add-on artists)
- **Account owner** = the person who signed up. Their catalog, embeds and splits use **their registered artist name**.
- **Artist name lock:** the Embed "Artist name" field becomes a choice of the account's registered artists (featured artists stay free text). The database refuses catalog songs whose artist isn't registered to the account. Renaming a registered artist goes through a support review, so a name can't be swapped per song.
- **Add-on artists** (paid by the owner, yearly): $19.99 Catalog Plus · $36.99 Catalog and Collaborate · $69.99 Catalog Management. Each needs a Paddle price you create (`artist_seat_plus_yearly`, `artist_seat_collaborate_yearly`, `artist_seat_management_yearly`).
- **Each add-on artist gets their own login** (invited by email). They see only their own catalog, splits and contracts, at their seat's tier. The owner sees and manages all of their artists' catalogs, switching with an "Artist" selector.
- **Schema:** `artist_accounts (id, owner_id, artist_name unique per owner, member_user_id, seat_tier, status)`. Every catalog row gets an `artist_account_id`, and existing songs are moved to the owner's primary artist by a data-preserving migration. RLS: the owner reads all their artists; a member reads only rows for their artist account.
- **Questions:** (1) Can an add-on artist upgrade their own seat, or only the owner? (2) If the owner cancels, do add-on artists keep their seats until the end of the period? (3) Should the owner see an add-on artist's contracts and split sheets, or only their catalog?

## F. Finance Center (super admin only; Finance sees its working files)
- **Super admin:**
  - Sales today, month and year; MRR/ARR; refunds; Paddle fees; net income.
  - Projected sales (renewals on the calendar plus a growth slider).
  - Expenses by vendor and category; profit.
  - An upcoming fees calendar, and an **upgrade watch**.
- **Finance department:** the expense ledger, receipts, the upcoming fees calendar and exports (CSV for the accountant). No customer-level data and no projections, unless you want them to have those.
- **Upgrade watch** (one row per vendor: Supabase, Vercel, GitHub, Resend, storage, Daily.co, Claude/Anthropic, Lovable, Paddle, domain):
  - Plan, cost, renewal date, plan limit, current usage, and **% of limit**, with a warning at 75% and an alert at 90%.
  - Usage we can measure ourselves: database size, file storage, emails sent, video minutes logged, users.
  - Usage for the rest: the provider's usage API where one exists (needs an API key per vendor), otherwise a monthly manual entry with a reminder.
- **Schema:** `vendors`, `vendor_usage_snapshots`, `expenses` (with receipt upload to a private bucket), `finance_settings`. Sales come from the existing Paddle webhook rows.
- **Questions:** (1) Which vendors and plans are you on today, and what do they cost? (2) Should Finance see revenue totals, or expenses only?

## G. Time clock that measures real work
- **Clock in and out in /admin**, plus **activity heartbeats.** Real work actions count: a ticket answered, a registration moved, a task updated, a page of the queue worked through.
- **Idle rule:** no work actions for 10 minutes means the clock auto-pauses and asks "Still working?". Paused time isn't paid time unless a lead approves it.
- **Each shift shows:** clocked time, active time, idle time and work completed. Shifts with lots of clocked time but little activity are flagged for review. It never records keystrokes, screens or webcams (privacy and labor law).
- **Weekly timesheet:** employees review and submit, the department lead or HR approves, and it exports to payroll.
- **Before turning it on,** give staff a written notice of what is tracked (and check Georgia and federal wage rules for paid breaks and overtime).
- **Question:** do employees work only inside /admin, or also in outside tools (email, Slack, phone)? Outside work needs a "log offline work" entry with a note.

## H. Royalty Utility Suite redesign (from your mockup)
1. **Split & Share Calculator:** contributor cards (Name, Role, PRO, IPI, Writer %, Publisher %) with live checks that turn green or red ("Writer shares total 100% ✓", "Publisher shares total 100% ✓"). A **No publisher (self-published)** box fills the publisher share from the writer share and names it "[Writer] Publishing".
2. **BMI vs ASCAP view:** the same split shown on BMI's 200% scale and on the 100% scale (ASCAP, SESAC, The MLC, SoundExchange).
3. **Earnings estimator** with plain-language rate inputs.

Accuracy notes before building:
- BMI's 200% is a *reporting scale*, not double money. 100% writer + 100% publisher on BMI's scale is the same income as 50% + 50% on ASCAP's. The page will say this plainly, so nobody thinks BMI pays twice.
- PPL, SoundExchange and The MLC aren't PROs for songwriters, so the dropdown will group them separately (neighbouring rights and mechanicals).
- "W-9" is a US tax form, so the split sheet PDF will skip that label.

I'll show a preview first.

## Built in round 3
- Photo, Video & Testimonial Release blueprint
- Embed and My Catalog locked for Free, enforced in the database too; Free accounts open on the Quick Check
- Contract signers get the 30-day trial
- Fraud guard on trials: confirmed email, no throwaway inboxes, paying inviters only, 10 per inviter and 2 per network per 30 days
- Invite cap of 50 per day
- Forgot password and reset page, plus a live password checklist with a strength bar and a show/hide toggle
- Founding 100 milestones and the testimonial gift program in the Marketing Task Bank

---

# Round 4 — founder answers (2026-10-19)

## E. Artist accounts — decided
- Typing a different artist name in Embed opens an "Add an artist" upgrade offer instead of saving under that name.
- Artist name changes: limited (recommended 30 days; first fix within 7 days of setup is free; staff can override). Existing songs keep the name they were embedded under.
- Add-on artists can buy their own plan and "go independent": their catalog moves to their own account and the owner's seat frees up.
- Owner cancels → add-on artists become independent automatically, keep their seat tier until the owner's paid period ends, then drop to Free (data kept, nothing deleted).
- Owner never sees an add-on's contracts or split sheets unless both are parties who signed from their own accounts.
- Access requests: owner asks, artist grants per document or "all", revocable anytime, every grant logged.

## F. Finance Center — vendors today
- Paid: Lovable $25/mo ($300/yr), Claude Pro $20/mo ($240/yr). Free: Vercel, GitHub, Supabase, Resend, Cloudflare.
- Upgrade-watch triggers to seed: Supabase Free (500 MB DB, 1 GB storage, pauses after 7 idle days) → Pro $25/mo; Resend Free (3,000/mo, 100/day) → Pro $20/mo; Vercel Hobby is non-commercial → Pro $20/mo if the live site runs there. Verify current limits before seeding.

## G. Time clock — decided
- Add "Log outside work" (Canva, email, outreach): tool, start/end, what was done, link or file as proof. Lead approves; shown separately as self-reported time.

## H. Royalty Utility — decided
- Its own area (route + nav item), dark Studio surface (ink background, white text, cobalt accents).
- Teaser for lower tiers: real calculators visible behind a lock overlay with an upgrade button.
- Preview before building.

## Fixed this round
- Agency exports: SoundExchange percent (was 10000%), mixed tiny fonts/formats in data rows, clipped rows, IPI leading zeros (MLC + CSV), MLC opening scrolled to column L, featured artists, self-released label, P-line, blank inception dates.
- Still open: per-writer publisher linking (needs a writer-field change → plan first).

---

# Round 5 — Health Checklist, name-change limit, catalog entry (2026-10-19, awaiting approval)

## Artist name changes
- Typo window: unlimited edits for the first 72 hours after signup.
- After that: one change per 7 days (founder's pick), capped at 3 changes per 12 months, so names can't be rotated to run several artists on one plan.
- Each change is logged; songs keep the artist name they were embedded under. Staff can override.
- Typing a new artist name in Embed offers "Add an artist" (artist seats, plan E).

## Song Health Checklist (Royalty Health Check)
- Every song gets its own checklist: Fix details → Register (PRO, The MLC, SoundExchange) → Confirm it shows up. Each step has 2–3 plain steps, an official portal button and a "Why it matters" line.
- Users tick steps themselves; % = ticked steps / total. Detail fixes are checked automatically from the shared readiness module (no separate writer logic).
- "Not showing up yet? Relax, this is common." per step, fact-based only:
  - PRO: still processing (ASCAP's public ACE database updates weekly); Songview lists reconciled works where BMI and ASCAP data agree; different spelling/"feat."; co-writer registered it differently.
  - The MLC: recording not yet matched to a registered work; shares claimed under 100%; fix with the Claiming/Matching Tools. Unmatched royalties are held at least 3 years (MLC FAQ), so money isn't lost while you fix it.
  - SoundExchange: only rights owners/distributors submit ISRCs; recently released or not yet delivered; search by ISRC.
- Three lists: Needs attention · Saved for later (with "waiting on…" note and optional reminder date) · 100% Healthy (celebration + share card).
- Free tier: songs entered in the Quick Song Inspector are saved to their checklist (new table `health_songs`, owner-only RLS); on upgrade, "Move these into My Catalog".
- Paid tiers: every embedded/cataloged song gets its checklist automatically. Free screens show "On a paid plan this runs itself."
- New tables: `health_songs` (free entries), `health_steps` (user_id, song ref, step_id, done_at), song state (active/later/healthy, note, remind_on). No changes to writer fields.

## Adding songs to My Catalog
- Recommendation: My Catalog gets "Add song" with two options:
  1. Upload an MP3 you already embedded: tags are read, the form pre-fills, it saves to the catalog with no re-download.
  2. Add without audio (manual entry) for songs where they don't have the file handy.
- Embed Metadata stays the place for new masters. Both paths run the health check automatically.

Preview: scratchpad health-preview.png (dark Studio surface).

---

# Round 6 — WAV masters (proposal, not built)
- DSPs get audio from the distributor, and the distributor takes metadata from its own upload form, not the file. Embedded tags matter for files you send directly (supervisors, DJs, radio, sync libraries).
- Proposal: accept WAV (16/24-bit, 44.1–96 kHz) in Embed. Write an "id3 " chunk (read by most DAWs, Apple Music, Serato, Rekordbox) plus a RIFF INFO chunk (title, artist, genre, copyright) into the WAV, in the browser, without re-encoding, so the audio stays bit-for-bit lossless.
- Catalog stores the WAV master next to the MP3 (storage cost: a 24-bit/48 kHz 3:30 song is about 60 MB vs ~8 MB MP3; consider Plus = MP3 only, Collaborate+ = WAV masters).
- Also: a "Distributor-ready sheet" export (title, ISRC, UPC, writers, explicit, genre, release date) to copy into DistroKid/TuneCore/CD Baby forms.

## Round 6 — founder direction (2026-10-19)
- Catalog Plus: unlimited **MP3** embedding, download and storage (the headline feature).
- Catalog and Collaborate: adds unlimited **WAV** embedding and download, **not stored** (embedding runs in the browser, so this costs nothing to serve).
- Catalog Management: adds **WAV storage** in the catalog (the WAV master with its info and album art).
- Mitigations proposed (awaiting answers): fair-use WAV storage allowance with a meter, per-file size cap, daily WAV download cap with short-lived links, one WAV per song, Supabase Pro before launch, a policy for what happens to stored WAVs after a downgrade.
