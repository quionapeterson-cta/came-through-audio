# PLAN — Founder to-do list (as of 2026-10-25) · v1

Status: **Open. Your checklist from the last few days; tick items off here or tell me what's done.**

Everything below is built and pushed; nothing goes live until you do these. Work top to bottom.
All GitHub links need you logged in to GitHub (the repo is private). On each file, use **Copy raw file** (two squares, top right).

## 1. Start here (order)
1. Run the database updates (section 2).
2. Create the two new Stripe prices and check the settings (section 3).
3. Find your `CRON_SECRET`, then add the new hourly cron job (section 4).
4. Add the two Cloudflare AI secrets in Lovable (section 4).
5. Publish in Lovable, then test each feature (section 6).
6. Send me test results with the exact error text, and answer the open decisions (section 8).

## 2. Database (Supabase)
- [ ] Paste [db-check.sql](https://github.com/quionapeterson-cta/came-through-audio/blob/main/db-check.sql) into Supabase → SQL Editor → Run. It lists each file as applied or MISSING.
- [ ] Run every MISSING file, oldest first (open it, Copy raw file, paste, Run):

| Order | File | What it turns on |
| --- | --- | --- |
| 1 | [20261025090000 founding-upgrades](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025090000_e4b8c2d6-founding-upgrades.sql) | Founding 100 seats |
| 2 | [20261025100000 agency-exports](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025100000_f2a9d4c7-agency-exports.sql) | Agency export history |
| 3 | [20261025110000 site-media](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025110000_a3c7e5b9-site-media.sql) | Testimonial photo uploads |
| 4 | [20261025120000 task-priority-alerts](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025120000_b6d2f8a4-task-priority-alerts.sql) | Task Bank priority, deadlines, reminders |
| 5 | [20261025130000 trial-per-email](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025130000_c8e1a4f7-trial-per-email.sql) | One split sheet trial per email |
| 6 | [20261025140000 brand-kits](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025140000_d4f9b2e6-brand-kits.sql) | Personal Branding brand kits and logos |
| 7 | [20261025150000 contract-generations](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025150000_e7a3c1d9-contract-generations.sql) | Contract Generator daily limit |
| 8 | [20261025160000 paid-contracts](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025160000_f3b8d2a6-paid-contracts.sql) | $3.99 contracts on any plan |

- [ ] Run db-check.sql again; send me a screenshot if anything still says MISSING.
- [ ] Also run [20261025180000 beta-feedback](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025180000_b3e7f1a5-beta-feedback.sql) (beta checklist results).
- [ ] Also run [20261025170000 launch-department](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025170000_a9d4e2c7-launch-department.sql) (pre-launch milestones), then Admin → Task Bank → Load pre-launch milestones.
- [ ] Refresh Admin → Plans (this list shows there too): open `plans-load.sql` in the Codespace file list (kept out of GitHub on purpose), select all, paste in SQL Editor, Run.

## 3. Stripe
Create each price in the **sandbox first**, test it, then in **live**. Until they exist, checkout says "This item isn't available to buy yet."

| Product name | Price | Type | Lookup key (exact) |
| --- | --- | --- | --- |
| Personal Branding (any plan) | $14.99 | One-time | `branding_yearly` |
| Contract Generator contract | $3.99 | One-time | `contract_generator` |

- [ ] Sandbox: Product catalog → Add product → name, price, One-off → More options → Lookup key → save. Repeat.
- [ ] Live: the same two, once the sandbox tests pass.
- [ ] Check the existing lookup keys are on both accounts: `catalog_plus_yearly`, `catalog_collaborate_yearly`, `catalog_management_yearly`, `ai_protection_single`, `ai_protection_ep`, `ai_protection_album`, `ai_protection_plus`, `vault_month`, `expert_setup_single`, `expert_setup_album`, `expert_per_song_agency`.
- [ ] Customer emails: support and receipts email = billing@camethroughaudio.com (after the mailbox exists).
- [ ] Turn off Stripe's own renewal reminder emails (ours send instead).
- [ ] Customer portal: turn cancellation off (our cancel offers handle it).
- [ ] Checkout: add the Terms and Privacy Policy links.
- [ ] Later, when Stripe Tax is active: tell me and I'll switch `STRIPE_TAX` on.

## 4. Secrets and cron jobs
**Find your CRON_SECRET**
- [ ] Easiest: cron-job.org → open an existing job (catalog-lapses) → Advanced → Headers. The value after `Bearer ` is your CRON_SECRET.
- [ ] Or Lovable → Cloud → Secrets → `CRON_SECRET`, if it lets you view it.
- [ ] Lost in both places? Make a new long random value, save it in Lovable as `CRON_SECRET`, then update the header on all 4 jobs. Tell me and I'll walk you through it.

**New job on cron-job.org**

| Setting | Value |
| --- | --- |
| Title | Task reminders |
| URL | https://pixel-perfect-studio-382.lovable.app/api/public/cron/task-reminders |
| Schedule | Every hour |
| Method | POST |
| Header | `Authorization` = `Bearer ` + your CRON_SECRET |

- [ ] Create it, then Test run: it should answer 200, not 401.
- [ ] Check the other 3 jobs still show green: catalog-lapses (daily), trial-reminders, registration-reminders.

**Contract Generator (Cloudflare, free)**
- [ ] dash.cloudflare.com → AI → Workers AI → Use REST API → copy the Account ID.
- [ ] Same page → Create a Workers AI API Token → copy it (shown once).
- [ ] Lovable → Cloud → Secrets: add `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_AI_TOKEN`. Until then the generator only suggests the closest blueprints.

**Backups (new)**
- [ ] Set up the weekly backup: 4 steps in [PLAN-backups.md](https://github.com/quionapeterson-cta/came-through-audio/blob/main/PLAN-backups.md) (R2 bucket, database address, passphrase, GitHub secrets), then Run workflow once.

## 5. Email, accounts and settings
- [ ] Create the billing@camethroughaudio.com mailbox (billing emails send from it; refund requests go to it).
- [ ] Supabase → Authentication → set the minimum password length to 12, to match the sign-up form.
- [ ] Demo account: in the Codespace terminal run `DEMO_PASSWORD=your-demo-password npx vitest run scripts/demo/seed.test.ts --environment node`.
- [ ] Check Admin → Homepage shows your new testimonial (it needs name, quote, service, photo, release signed date and Published ticked).

## 6. Publish and test
Publish in Lovable first, then test on the published site in the sandbox (card 4242 4242 4242 4242). Send anything that breaks, with the exact error text or a screenshot.

**New this week**
- [ ] Embed: press Ctrl+Enter with no file (a pop-up should say so), then embed a song and check the checklist (embedded, downloaded, not in My Catalog yet), then Save to My Catalog and check the saved checklist.
- [ ] Embed: tick AI Protection, Save to My Catalog: the $2.99 checkout should open.
- [ ] Homepage: "What does embed mean?" story and the smaller badges on the Who It's For photos (phone and computer).
- [ ] Embed Defaults: add a contact email, embed a song, check it shows in the file's comments.
- [ ] Personal Branding: on a Free or Plus account buy the $14.99 add-on, set up Profile → Brand kit, download a split sheet PDF and a generated contract PDF.
- [ ] Personal Branding on Catalog Management (included): contract PDF and the PDF a signer downloads.
- [ ] Contract Generator: describe a deal, check the match, pay $3.99, open it from My Contracts, send it for signature.
- [ ] Contract Generator for company: Admin → Company Contracts → describe an agreement → Open my draft (free).
- [ ] Company signature block: Company Name / By / Printed Name / Title in the editor and PDF.
- [ ] Contract lists: search, type and date filters.
- [ ] AI Protection: add draft dates with the calendar, issue a certificate, download the .txt and .ots separately, scan the QR on your phone and try Open your certificate / Download proof files.
- [ ] Disclaimers: read them where they appear (list in section 8) and tell me anything to change.
- [ ] Badges: Sound Sealed after your first Bitcoin-stamped certificate.
- [ ] Royalty Utility Suite: converter with a song picked, and the earnings calculator.
- [ ] Task Bank: a Top priority task shows the alert at Admin sign-in; the bell lists due tasks.

**Still waiting from 10/23**
- [ ] Stripe sandbox: Renew now, Need more time, Pause → Resume, cancel offers, Expert Assistance checkout.
- [ ] Company testimonial release signed logged out (6-digit code), then grant the launch gift.
- [ ] Customer contract end to end with a second email.
- [ ] Royalty Health Report: organs, scans, PDF, My reports, agency list upload.
- [ ] Co-writer IPI request between two accounts.
- [ ] Catalog Plus lock on a free account; install the app on your phone (CTAudio).

**Beta (from Nov 9)**
- [ ] Admin → Company Contracts → Templates → Beta Tester Agreement: have your lawyer read it, then send it to each tester.
- [ ] Testers sign, make a free account with the same email, and use yourdomain/beta for their checklist.
- [ ] After the beta: Company Contracts → Beta testers → Grant lifetime access. Read the results there.

## 7. Art and content you owe
- [ ] Badge art: the code-drawn badges are placeholders (19 customer, 33 staff). File names in [PLAN-badge-art-placeholders.md](https://github.com/quionapeterson-cta/came-through-audio/blob/main/PLAN-badge-art-placeholders.md); a new file with the same name and folder swaps in.
- [ ] App icon: send the new icon and I'll make every size.
- [ ] How It Works photos for the homepage.
- [ ] Founding Member badge art (not made yet).

## 8. Decisions waiting on you
- [x] Refunds for the new buys: decided 2026-10-25, same 30-day full refund for the $14.99 Personal Branding and the $3.99 contracts. Refund Policy updated.
- [ ] Cursive signatures: typed signatures on every contract PDF now use the same legible cursive as the company block. Keep, or company only?
- [ ] Proof videos: certificates record both fingerprints (original and our stored copy). Okay, or also keep full originals up to 1 GB (storage cost)?
- [ ] Help chat: start with the free search-based answer bot, or wait?
- [ ] Lyrical Legacy badge: change the line "didn't just write 100 lyrics"?
- [ ] Disclaimers: a lawyer should review every disclaimer and the Terms before launch.
- [ ] What's next: pre-distribution health analysis, or a Phase 4 plan first (pre-launch milestone list, outreach kit, beta testing, admin calendar)?

## 9. Before launch
The Cloudflare move is planned for the week of Nov 3 and must be done before Nov 11. Step by step: [PLAN-cloudflare-hosting.md](https://github.com/quionapeterson-cta/came-through-audio/blob/main/PLAN-cloudflare-hosting.md).
- [ ] Move hosting to Cloudflare: secrets (now including the 2 Cloudflare AI ones), Stripe webhook URLs, the 4 cron job URLs.
- [ ] Point camethroughaudio.com at the site, then tell me so I switch every email and certificate link to it.
- [ ] Stripe live: live lookup keys, live secret key and live webhook.
- [ ] Lawyer review: contract blueprints, company agreements, AI certificate wording, the Registration Authorization, every disclaimer and the Terms.
- [ ] Grant launch gifts to testimonial signers (Admin → Company Contracts → Launch gifts).
- [ ] Representative logins for SoundExchange Direct and The MLC Portal.
- [ ] ISRC registrant ($95): confirm the ISRC Manager terms.
- [ ] Run Lovable's security scan once more.
- [ ] Launch day: tell me to remove the passcode gate and let search engines in.
