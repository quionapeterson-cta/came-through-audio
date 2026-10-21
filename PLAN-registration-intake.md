# PLAN — Expert Registration Assistance: working checkout and a proper intake flow · v3

Status: **awaiting approval. PRIORITY 1.**
Source: founder testing notes, 2026-10-21. v2 (2026-10-21): founder answered Q1 (draft the agreement) and Q2 (users may pay for songs that aren't ready, but must complete and submit them before work starts); agency checklists researched (§5). v3 (2026-10-21): the system checks every paid song right after payment and alerts the user immediately with what to provide; agents register the songs themselves, no live assistance (§3).

---

## 0. Bug: "Pay & reserve my session" shows a Supabase publishable key error

- The button calls `openCheckout({ kind: "expert", … })` (`src/components/ExpertAssistance.tsx:60`). The other checkouts work, so the error is specific to this path.
- Expert Assistance is sold **outside Stripe Managed Payments** (Stripe excludes human-delivered services), so it builds its session differently from plan purchases (`src/lib/stripe-mapping.ts`).
- The message comes from our Supabase helpers (`src/integrations/supabase/client.ts`, `auth-middleware.ts`), which throw when `SUPABASE_PUBLISHABLE_KEY` can't be read on the server. The likely cause is that this path runs a server function without the signed-in session or the server environment variables.
- **Fix:** reproduce it in the preview, read the server log, and fix that path so it uses the same signed-in server call as plan checkout. Add a test for the expert checkout input.
- **Founder check after the fix:** sandbox purchase with card 4242 4242 4242 4242.

## 1. Songs must be in the catalog first (friendly redirect)

- Registration assistance only works from catalog songs, because agents export straight from the catalog.
- If the catalog is empty: a friendly card instead of the order form:
  > **Let's get your songs in first.** Registration starts from your catalog, so our agents have every detail in one place. Add your songs in My Catalog, then come back here.
  > [Go to My Catalog]

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
6. **Status tracker:** Waiting on you → Queued → In progress → Registered, per song and per agency, updated by the agent. The user gets an email when each agency's registrations are done.

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

## Files
`src/components/ExpertAssistance.tsx`, `src/lib/stripe-mapping.ts`, `src/lib/checkout.ts`, **`src/lib/readiness.ts` (new `ascap` / `bmi` targets and agency items, per §5; rule change, needs approval)** + `readiness.test.ts`, `src/lib/metadata.ts` (5 new catalog-only fields), the My Catalog / Embed Metadata form (new fields + tooltips), `src/lib/agency-export.ts` (SoundExchange reads master ownership), `src/lib/contract-blueprints.ts` (Registration Authorization), admin route + new `registration_sessions` migration (status per song/agency, submitted snapshots, server-written), the payment webhook (runs the readiness check when an expert purchase confirms) + a new "songs need details" email through `emailLayout()`, a reminder job (run beside `src/routes/api/public/cron/trial-reminders.ts`). Live-session removal: the gateway confirmation and scheduling step in `ExpertAssistance.tsx`; the `expert_gateways` table and its existing rows are kept, just no longer written. AGENTS.md "Registration readiness" section gets the per-agency items added once approved.
Touches writer/readiness/export code paths, so per AGENTS.md: confirm this file list before editing.

## Questions
1. ~~Agreement wording: draft or lawyer?~~ **Answered: draft it** (§6, needs your review).
2. ~~Pay for songs that aren't ready?~~ **Answered: yes, but every song must be completed and submitted before work starts** (§3 step 2).
3. Approve the per-agency checklists in §5, especially the **Required** items (for example: BMI requires duration and genre; The MLC requires an ISRC).
4. Approve the 5 new catalog fields in §5.
5. Before submitting, may a user swap a paid song for a different catalog song (same price)? Recommended: yes, until it's submitted.
6. Agreement §6: any changes to the wording? And should the pre-launch confidentiality clause be included while we're pre-launch?
7. Not-ready reminders: after 3 days, then weekly, until the songs are complete (§3 step 2). OK, or a different schedule?
8. Turnaround: what should the status tracker promise after submission (for example "registrations are filed within 5 business days")?
