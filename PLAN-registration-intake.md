# PLAN — Expert Registration Assistance: working checkout and a proper intake flow · v3

Status: **approved 2026-10-21 (Q3–8 answered). PRIORITY 1. §7 preview approved and BUILT 2026-10-22 (migration 20261023090000 must be run).** Build order: catalog fields + organized form first (DONE 2026-10-21) (with PLAN-catalog-organization §1), then readiness targets, then checkout fix + intake.
Source: founder testing notes, 2026-10-21. v2 (2026-10-21): founder answered Q1 (draft the agreement) and Q2 (users may pay for songs that aren't ready, but must complete and submit them before work starts); agency checklists researched (§5). v3 (2026-10-21): the system checks every paid song right after payment and alerts the user immediately with what to provide; agents register the songs themselves, no live assistance (§3). v4 (2026-10-21): founder approved the agency checklists, the 5 catalog fields, song swaps, the agreement wording with the pre-launch clause, and the reminder schedule; uncataloged songs can be bought (§1); no turnaround promise (§3 step 6).

---

## 0. Bug: "Pay & reserve my session" shows a Supabase publishable key error

- The button calls `openCheckout({ kind: "expert", … })` (`src/components/ExpertAssistance.tsx:60`). The other checkouts work, so the error is specific to this path.
- Expert Assistance is sold **outside Stripe Managed Payments** (Stripe excludes human-delivered services), so it builds its session differently from plan purchases (`src/lib/stripe-mapping.ts`).
- The message comes from our Supabase helpers (`src/integrations/supabase/client.ts`, `auth-middleware.ts`), which throw when `SUPABASE_PUBLISHABLE_KEY` can't be read on the server. The likely cause is that this path runs a server function without the signed-in session or the server environment variables.
- **Fix:** reproduce it in the preview, read the server log, and fix that path so it uses the same signed-in server call as plan checkout. Add a test for the expert checkout input.
- **Founder check after the fix:** sandbox purchase with card 4242 4242 4242 4242.

## 1. Songs not in the catalog yet (v4)

- Founder (v4): **songs that aren't cataloged yet can still be bought**, but they must be cataloged before we register them.
- The order form lists catalog songs (§2) plus **"+ A song that isn't in my catalog yet"**: the user types its title (and artist, prefilled). Each one counts and is priced like any other song.
- After payment these songs show ⚠️ **Add this song to My Catalog** (instant alert, §3 step 2), linking to Add song with the title filled in. Saving it links the new catalog song to the order, then it gets the normal readiness check.
- If the catalog is empty, the order form still works; it shows a short note: "Registration runs from your catalog. You can pay now and add the songs to My Catalog right after."

## 2. Pick songs from the catalog (replaces the number box)

- The "number of songs" box becomes a **song picker** filled from the user's catalog, grouped Singles / EPs / Albums (collapsible).
- **Any catalog song can be picked and paid for, ready or not** (founder decision, v2). Each song shows ✓ Ready to submit or ⚠️ N items to complete, based on the agencies checked (§5), so the user knows what's ahead before paying.
- Song count and price update from the songs checked. The chosen song IDs are saved with the purchase (`purchases.details.track_ids`) so the agent sees exactly which songs were paid for.

## 3. After payment: step-by-step intake

**Done-for-you service (founder, v3): our agents register the songs themselves. There is no live call or live assistance.** The current flow's live-session pieces go: "Pay & reserve my session", the "I can log into each registry account… the live call is used for data audit" confirmation (`expert_gateways`), and "Schedule your live session". The button becomes **Pay & start registration**. (Live time stays a separate, later product in PLAN-live-registration.md.)

A numbered checklist that unlocks in order (later steps stay locked until earlier ones are done):

1. **Payment confirmed** ✓
2. **Automatic readiness check, the moment payment confirms.** The system runs the shared readiness check (§5) on every paid song, for every agency in the order. Nothing waits for an agent.
   - **All ready:** the user sees "All N songs are ready ✓" and moves straight to step 3.
   - **Any not ready:** the user is **alerted immediately**, on the payment-confirmed screen (not a toast that disappears) and by email (`emailLayout()`), e.g. "2 of 5 songs need a few details before our agents can register them", listing each song, each agency and exactly what to provide. In the app every ⚠️ item links straight to the field in My Catalog; the email links to this checklist (no raw-link fallback).
   - The check re-runs on every save in My Catalog. A song flips to ✓ as soon as it's complete; the user doesn't have to re-submit anything.
   - **Reminder** if songs are still incomplete after 3 days, then weekly, same email (stops once everything is ready). The 30-day refund window keeps running; the email says so.
3. **Confirm and submit your songs.** One review card per song (title, writers and splits, publishers, ISRC, the agencies). **Submit for registration** is only available once every paid song passes; it saves a registration copy of each song with the order, so later catalog edits don't change what the agent registers (the agent can unlock a song if the user needs a fix). This is when work starts, so the refund window ends here (refund policy: refundable until our team starts work); the button says so.
4. **Sign the Registration Authorization agreement** (§6). Signed in-app, saved like other contracts.
5. **Add Came Through Audio as your representative/user.** One card per agency picked, with plain-language steps:
   - **ASCAP / BMI:** add us as an authorized user or representative in the member portal.
   - **The MLC:** invite us as a user on the MLC Portal (Account → Users).
   - **SoundExchange:** add us as an authorized representative (SoundExchange Direct; a Letter of Direction may be needed).
   - Each card has a "Done" button and a "Need help?" link. Exact steps will be checked against each agency's current portal before this ships.
   - **Details users enter (founder, 2026-10-22):** email **registrations@camethroughaudio.com**, first name **Came**, last name **Through Audio**. Shown on step 5 with copy buttons (`REPRESENTATIVE` in `src/lib/registration.ts`).
   - **Checked against each agency's help pages (2026-10-22):**
     - **ASCAP:** Member Access → Profile → Designated Users → Add, then tick the permissions (register works; no banking). The designated user gets an email invite and sets its own password; its 2FA codes go **by email only**, and only the account holder can change its email.
     - **BMI:** BMI Online Services → Third Party Permissions → add user, then Save Application Permissions (it isn't finished until saved). Fallback: ols.bmi.com/assistance or 844-BMI-4255.
     - **The MLC:** Member Hub → Member Settings → User Permissions → Add User (Super Users only). Choose **Copyright User** (registers works, no banking). A non-Super User must pass identity verification (Profile → Get Verified) before adding Members.
     - **SoundExchange:** SX Direct → Settings → Registrant Details → Guest List → Add Guest: name, email, permission **View with repertoire** (lets us submit recordings/claims; guests can never change payments). The guest needs its own SX Direct profile: if the email has none, the invite links to sign up first.
   - **What Came Through Audio needs on its side:** (1) a working registrations@camethroughaudio.com mailbox our agents check (invites, ASCAP 2FA codes, agency notices); (2) its own SX Direct profile and MLC Portal user under that email (MLC may ask the agent to Get Verified with a real person's ID); (3) accept each ASCAP/BMI invite and set a password; (4) the customer must already be a member of each organization (the agreement says we don't sign up memberships for them).
6. **Status tracker:** Waiting on you → Pending → In progress → Registered, per song and per agency, updated by the agent. **No turnaround promise** (founder, v4): submitted songs show **Pending**, with "We register songs in the order they're submitted and email you as each one is filed." The user gets an email when each agency's registrations are done. Admin queue flags any order Pending for more than 30 days (internal target only, never shown to users).

## 4. Agent side: one-click agency exports

- Admin → Registration queue: one row per paid order showing the user, songs (ready x of y, submitted?), agencies, agreement signed?, representative access confirmed?. Orders stay in "Waiting on customer" until every song is submitted, the agreement is signed and access is confirmed; then they move to "Ready to register".
- Before exporting, the server re-runs the same readiness check on the submitted copies (never trusts the browser), so an agent never receives an incomplete song.
- **One-click export** per agency for the session's submitted songs, using the existing export templates and shared readiness check (no template-specific writer fields).
- The agent marks each song/agency registered; the user's tracker updates.
- Staff-only through staff-verified server functions.

## 5. What each agency needs before we start (research, 2026-10-21)

Readiness stays in ONE module (`src/lib/readiness.ts`). Today it has three targets: `pro`, `mlc` and `soundexchange`. **Proposal:** add `ascap` and `bmi` as targets (both include `pro`) and extend each target with the items below. Every checklist is a superset of the current rules (author or instrumental, composer, legal name for every writer). Writer splits and publisher shares must total 100% for every agency except SoundExchange (unchanged).

Legend: **Required** = blocks Submit song. *Recommended* = shown as a tip, never blocks.

### ASCAP (musical work: Member Access → Works → Register a Work)
- **Required:** title · every writer's legal name, role, PRO affiliation and share · IPI for every writer who belongs to a PRO · publisher name, PRO and share for each publisher, or "Self-published (no publisher)" checked · "Uses a sample or is based on another song?" answered (if yes: original title and writers).
- *Recommended:* alternate titles (AKA) · performing artist · ISRC (helps ASCAP match streams to the song) · duration.

### BMI (musical work: Online Services → Title registration, 5 screens)
- **Required:** title · duration · genre · every writer's legal name, role, PRO affiliation, IPI and share · each publisher's name, PRO, IPI and share, or "Self-published (no publisher)" checked (BMI then pays the publisher half to the writers) · "Uses a sample or is based on another song?" answered (screen 2; public-domain sources too) · "Written for a film, TV show, stage show or ad?" answered (if yes: production title).
- **Required once released:** performing artist, label, release date (screen 4 can be left for later on unreleased songs).
- *Recommended:* alternate titles (AKA) · ISWC if one exists.

### The MLC (mechanical: MLC Portal → Register work)
- **Required:** title · every writer's legal name and role (MLC roles A / C / CA) · IPI for every writer who has one · who collects the publishing: each publisher with its collection share, or the user's own MLC membership for self-administered songwriters (collection shares 0.01–100%) · **at least one recording: ISRC, recording title and recording artist**. The MLC pays by matching streams to songs through recordings, so a song without its ISRC earns nothing until it's matched.
- *Recommended:* ISWC · alternate titles (MLC only accepts language, live or remix variations here).

### SoundExchange (sound recording: SX Direct → My Catalog → Submit Recordings)
- **Required:** ISRC · track title · artist · claim basis (I own the master / I'm an authorized collection designee) · **% of the master claimed** · rights start (default: from release) and end (default: forever) · at least one release: release artist, album or single title, UPC (or EAN), label (self-released: the rights owner's name).
- *Recommended:* release date · country of recording (`recordedIn`, already in the catalog; helps international collection).
- Writers, splits and PRO info aren't needed (it registers the recording, not the song).

### What the catalog already has vs. what's new
- **Already in the catalog:** title, artist, featured artists, writers (legal name, role, PRO, IPI, share), publishers (name, PRO, IPI, share), ISRC, UPC, ISWC, label, release date, duration, genre, album, ℗ line, country/year recorded.
- **New catalog fields (5)**, all optional in Embed Metadata and never embedded in the MP3 (catalog only, like `recordedIn`):
  1. **Alternate titles** (list).
  2. **Self-published (no publisher)** checkbox, under Publishers.
  3. **Samples / based on another song**: Yes / No, then original title, original writers, source.
  4. **Written for film, TV, stage or an ad**: No / type + production title.
  5. **Master ownership**: % claimed (default 100%), claim basis (owner / authorized designee), rights start (from release / date) and end (forever / date). Today's SoundExchange export assumes 100% from inception, forever; it would read these instead.
- Each new field gets a plain-language help tooltip. No existing writer data changes. The metadata is stored as JSON, so new fields need no data migration; old songs simply show them as "to complete".
- Writer IPI and PRO stay **optional for saving and embedding** (AGENTS.md); they only become required when the song is submitted for registration with an agency that needs them.

Sources: [The MLC: How to register works](https://help.themlc.com/en/support/how-to-register-works-in-the-mlc-portal) · [SoundExchange: Submit Recordings guide](https://www.soundexchange.com/2019/11/04/mastering-my-catalog-a-guide-to-submit-recordings/) · [BMI Work Registration Form](https://cdn.bmi.com/pdfs/work-reg-e.pdf) · [BMI online screens (LegalHelp)](https://legalhelp.us/how-to-fill-out-the-bmi-work-registration-form-screens-and-200-split/) · [ASCAP: Registering Your Music](https://www.ascap.com/help/registering-your-music) · [ASCAP registration walkthrough (Mogul)](https://help.usemogul.com/en/articles/9504967-how-to-register-your-music-at-ascap). ASCAP's and BMI's current online forms are behind member logins; the agent will confirm the exact fields on our first live registration with each and update this list.

## 6. Registration Authorization agreement (DRAFT for founder review)

A customer agreement signed at intake step 3, built like the company templates (`src/lib/contract-blueprints.ts`). Came Through Audio, LLC is the party; it's auto-signed for the company. **Have a lawyer review it before launch.** {{…}} fills in automatically.

> **REGISTRATION AUTHORIZATION**
>
> This agreement is made on {{effectiveDate}} between Came Through Audio, LLC ("Came Through Audio") and {{party:Client}} ("Client").
>
> **1. WHAT CLIENT AUTHORIZES**
> Client authorizes Came Through Audio to register the songs and recordings listed in Schedule A with the organizations listed there ({{agencies}}), acting as Client's authorized user or representative in Client's own accounts. This includes entering, checking and submitting registration details, and reading Client's registration status.
>
> **2. WHAT CAME THROUGH AUDIO WILL NOT DO**
> Came Through Audio will not: (a) take or claim any ownership, copyright, writer share or publisher share in Client's music; (b) collect, receive or hold royalties for Client; (c) change Client's payment, bank or tax details, contact email, password or membership; (d) sign up for new memberships or agreements on Client's behalf; or (e) register anything not listed in Schedule A.
>
> **3. CLIENT'S INFORMATION**
> Client confirms that the details submitted for each song (titles, writers, roles, shares, publishers, IPI numbers, recordings and ownership) are true and complete, that every co-writer and co-owner has agreed to the shares submitted, and that Client has the right to register them. Came Through Audio registers exactly what Client submitted and is not responsible for errors in it. If an organization reports a conflict or asks for proof, Came Through Audio will tell Client, and Client will provide what's needed.
>
> **4. ACCOUNT ACCESS**
> Client will add Came Through Audio as an authorized user or representative in each account, as the organization allows, and will not share passwords. Client may remove that access at any time. Came Through Audio will stop using an account once its work for that account is done, and asks Client to remove its access then.
>
> **5. NO GUARANTEE OF RESULTS**
> Each organization decides on its own whether and when to accept a registration and pay royalties. Came Through Audio does not guarantee acceptance, timing or any amount of royalties.
>
> **6. FEES AND REFUNDS**
> Fees are listed in Schedule A. Refunds follow Came Through Audio's Refund Policy: a full refund within 30 days of purchase, as long as work on Client's registrations hasn't started. Work starts once Client has submitted every song in Schedule A and signed this agreement.
>
> **7. PRIVACY**
> Came Through Audio uses Client's information only to complete these registrations, as described in its Privacy Policy, and keeps PRO, IPI and share details private.
>
> **8. ENDING THIS AUTHORIZATION**
> This authorization ends when every registration in Schedule A is complete, or earlier if either side ends it in writing. Registrations already submitted stay in place.
>
> {{PRE-LAUNCH CONFIDENTIALITY, while the site is pre-launch only, using the existing PRELAUNCH clause}}
>
> **9. GENERAL** (the existing `general()` clause: entire agreement, independent parties, governing law, severability, e-signatures. Governing law fixed to the State of Georgia, where the LLC is based)
>
> **SCHEDULE A:** filled in automatically: each song (title, ISRC), each organization, the purchase date and the amount paid.

## 7. Build preview: §0–4 and §6 (2026-10-22, for approval before building)

Catalog fields, organized form and per-agency checks (`registrationCheck`) are already built. This is what the rest looks like.

### §0 checkout bug: what I found
- Expert checkout runs through the **same signed-in server call** as plan checkout (`createCheckoutSession`), which works. The only differences are its 3 Stripe prices (`expert_setup_single`, `expert_setup_album`, `expert_per_song_agency`) and that it's sold outside Managed Payments.
- The server replaces every Stripe error with a generic message, so the real cause stays hidden. **Fix:** (1) log the full Stripe error and show a specific reason ("price not set up yet", "sign in again"), (2) check on the server that the 3 expert lookup keys exist and name the missing one in the log, (3) add a test for the expert checkout input with picked songs.
- **Founder, if you can:** press the button once more and paste the exact error text here. That tells me whether it's the sign-in or a missing Stripe price.

### Order form (replaces the number box)
```
Expert Registration Assistance            Done-for-you: our agents register your songs.

▸ Singles · 4      ☑ Midnight Run   ✓ Ready to submit
                   ☑ Gold Rush      ⚠️ 3 items to complete
▸ EPs · 1          (collapsed)
▸ Albums · 0
+ A song that isn't in my catalog yet   [Title______] [Artist: {your artist name}]

Agencies   ◉ ASCAP  ○ BMI  (one PRO only)   ☑ The MLC   ☐ SoundExchange
           Base Fee                    $14.99
           2 songs × 2 agencies × $4.99 $19.96
           Total                       $34.95
[ Pay & start registration ]   Refundable for 30 days, until our team starts work.
```
- Single/EP vs album is set from the songs picked (1–6 = Single/EP, more = album), so the user never picks it.
- The song IDs go to Stripe and back into `purchases.details` the same way the AI Protection Hub does it (`tracks_1`, …). Uncataloged titles go in as `new_1`, ….

### After payment: the intake checklist
```
① Payment confirmed ✓
② Readiness check         ⚠️ 2 of 5 songs need a few details
     Gold Rush   ASCAP: ⚠️ Add Maya's IPI number →   The MLC: ⚠️ Add the ISRC →
     New Song    ⚠️ Add this song to My Catalog →
③ Confirm and submit      🔒 unlocks when every song is ready
     one card per song: title · writers & splits · publishers · ISRC · agencies
     [ Submit for registration ]  Work starts here, so the 30-day refund ends.
④ Sign the Registration Authorization   🔒
⑤ Add Came Through Audio as your representative   🔒   one card per agency · [Done] · Need help?
⑥ Status   Gold Rush · ASCAP Pending · The MLC Pending
     We register songs in the order they're submitted and email you as each one is filed.
```
- Every ⚠️ opens the song in My Catalog at the right dropdown and field. Saving in My Catalog re-runs the check; nothing to re-submit.
- Swap a song: a "Swap" link on each song until it's submitted (same price).
- Emails (all through `emailLayout()`): "N of M songs need a few details" right after payment, reminders after 3 days and then weekly until ready (says the refund window is still running), and "Your songs are filed with {agency}".

### Admin → Registration queue (staff only)
```
User        Songs        Agencies         Agreement  Access  Status               Oldest
Artist A    5/5 ✓ sub.   ASCAP, The MLC   ✓          ✓ ✓     Ready to register    2 d
Artist B    3/5          BMI              –          –       Waiting on customer  6 d
```
- Open an order → per song: the submitted copy, **Export for ASCAP / BMI / The MLC / SoundExchange** (existing templates, re-checked on the server), mark Pending → In progress → Registered, Unlock for a fix. Orders Pending over 30 days are flagged (staff only).

### Database (one new migration, nothing existing changed)
- `registration_songs`: one row per paid song: purchase, user, catalog song (or the typed title until it's cataloged), agencies, submitted copy + submitted time, status per agency. Written only by server functions (submit, swap, staff updates); users read their own, staff read all.
- `registration_orders`: per purchase: agreement contract, representative access confirmed per agency, last reminder sent.
- The agreement is saved in the existing `contracts` table, like company contracts. `expert_gateways` and its rows stay, just no longer written.

### Files
Changed: `ExpertAssistance.tsx` (rebuilt as order form + checklist), `stripe-mapping.ts` (expert input takes songs), `payments.functions.ts` (real error reasons), `plans.ts` (type from song count), `routes/api/public/payments/webhook.ts` (creates the order, runs the check, sends the alert), `contract-blueprints.ts` (Registration Authorization), `routes/workspace.tsx` (opens a song at a field from the checklist), admin route + nav. New: `registration.functions.ts` (submit / swap / access / staff actions, server re-check), `registration-email.ts`, `routes/api/public/cron/registration-reminders.ts` (needs a daily cron, like trial reminders), the migration, tests. Readiness rules in `readiness.ts` are **not** changed; everything calls `registrationCheck`.

**Founder:** reply "approved" (or tell me what to change) and I'll build it. You'll need to run one migration in the Supabase SQL editor afterwards.

## Files
`src/components/ExpertAssistance.tsx`, `src/lib/stripe-mapping.ts`, `src/lib/checkout.ts`, **`src/lib/readiness.ts` (new `ascap` / `bmi` targets and agency items, per §5; rule change, needs approval)** + `readiness.test.ts`, `src/lib/metadata.ts` (5 new catalog-only fields), the My Catalog / Embed Metadata form (new fields + tooltips), `src/lib/agency-export.ts` (SoundExchange reads master ownership), `src/lib/contract-blueprints.ts` (Registration Authorization), admin route + new `registration_sessions` migration (status per song/agency, submitted snapshots, server-written), the payment webhook (runs the readiness check when an expert purchase confirms) + a new "songs need details" email through `emailLayout()`, a reminder job (run beside `src/routes/api/public/cron/trial-reminders.ts`). Live-session removal: the gateway confirmation and scheduling step in `ExpertAssistance.tsx`; the `expert_gateways` table and its existing rows are kept, just no longer written. AGENTS.md "Registration readiness" section gets the per-agency items added once approved.
Touches writer/readiness/export code paths, so per AGENTS.md: confirm this file list before editing.

## Questions (all answered 2026-10-21)
1. Agreement wording: **draft it** (§6).
2. Pay for songs that aren't ready: **yes; each must be completed and submitted before work starts.**
3. Agency checklists (§5): **approved.**
4. 5 new catalog fields (§5): **approved**, placed in the organized catalog form (PLAN-catalog-organization §1).
5. Swap a paid song before submitting: **yes.** Uncataloged songs can be bought too; they must be cataloged before we register (§1).
6. Agreement wording: **approved, include the pre-launch confidentiality clause** while pre-launch.
7. Reminders after 3 days, then weekly: **approved.**
8. Turnaround: **no promise; submitted songs show Pending** (§3 step 6).
