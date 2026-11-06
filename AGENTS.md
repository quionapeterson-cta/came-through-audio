<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Nothing Is Official Until It's Approved (always follow)

- Never write a number, allowance, limit, price, date or promise into the product, the plan chart, a Stripe product
  description, a policy document, an email or a support script as if it were settled unless the founder has approved
  that exact value (founder, 2026-11-05). Propose it in a plan document, mark it **undecided**, and wait.
- Anything shipped that the founder has not confirmed is a **draft, not an entitlement**: say so plainly, keep the copy
  free of the unapproved value, and change it the moment the decision lands. Where a value is approved, keep it in one
  constant and quote it everywhere; where it is not, the copy does not carry it at all.
- Current example: **WAV master storage**. Embedding and downloading a WAV is unlimited; how much we store, and whether
  we charge for it, is not decided. No GB figure and no "unlimited WAV storage" claim is official yet.

- Keep metadata embedding in a browser-safe utility using browser-id3-writer; the uploader creates local MP3 downloads without changing catalog persistence or database permissions.
- Embeds never carry publisher information (no TPUB or publisher tags), nor the ℗ line or language: those stay catalog-only. PRO affiliations, IPI numbers and splits are never embedded either.
- Catalog entries fill their blanks from the profile (Embed Defaults + Catalog Profile, incl. writer PRO/IPI/share matched by name) via withProfileFilled in src/lib/artist-profile.ts; never overwrite what a song already has.
- Use shared semantic primary, accent and ring tokens for brand accents, so all controls follow the global theme.

- Paid access comes from payment-provider webhook rows (Stripe; subscriptions for yearly tiers, purchases for one-time buys) keyed by human-readable price IDs in src/lib/plans.ts (Stripe lookup keys); the client never writes them, so payment state cannot be forged.
- **Paying never waits for the email confirmation** (founder, 2026-11-05, replacing the 2026-11-03 rule): someone who picks a plan signs up and reaches Stripe in the same sitting. Supabase sends no session while "Confirm email" is on, so `SignupCard` signs the brand-new account straight in (the project allows unverified sign-ins) and the confirmation email travels alongside it; `EmailConfirmBanner` then reminds them in the workspace, with a resend and an "I've confirmed" re-check, until the address is confirmed. Never put a confirmation check back in front of checkout, and never describe an unconfirmed account as unable to pay.
- Staff roles live in public.user_roles (checked via is_staff/has_role); profile role/tier are trigger-protected from self-edits, so admin access cannot be self-granted. Admin reads go through staff-verified server functions.
- All outgoing email HTML must be wrapped with emailLayout() from src/lib/email-layout.ts — keeps branding and legal-footer compliance in one place.
- Badge artwork is served from the Cloudflare R2 bucket (founder, 2026-11-04): the 512px web-ready copies mirror public/icons/<serious|playful>/<set>/ and public/art/clinic/ at the bucket root, and the original 4K masters stay in the bucket's separate 4k/ folder, which the app never requests. Paths stay literal in the data (badges.ts, eagle-status.ts, ClinicArt.tsx); they become a URL in exactly one place, `artUrl()` in src/lib/art-url.ts, which adds `VITE_ART_BASE` and swaps .png/.jpg for the .webp copy. Never hard-code the bucket address anywhere else and never render a raw art path, so the art can move again without a sweep. With `VITE_ART_BASE` unset (local dev, tests) the same paths load from public/, which is the fallback copy. The 4K masters under `art/badges-4k/` are NOT tracked in git (founder, 2026-11-04): they live only in the bucket's `4k/icons/` folder, because they are print archives that the site never loads and they bloat every clone and deploy. Re-rendering them writes to the local folder, which stays ignored. A build with `VITE_ART_BASE` set also drops `public/icons` from `.output` (`scripts/prune-served-art.mjs`, run by `npm run build`), because a deploy that reads the bucket should not ship 179 MB of unused copies; without the variable the folder ships as the fallback.

## Badge Art Protocol (always follow)

- Only the founder uploads badge art to the R2 bucket (founder, 2026-11-05). No other person, and no script, puts an
  object in the bucket: staff file ideas, a super admin approves, the founder copies the file to the key the queue prints.
- Every new badge goes through Admin → Badges → Badge Protocol (`BadgeProtocolPanel` + `badge-submissions.functions.ts`).
  Branding, Marketing & Social Media and Support submit (public.can_manage_badges); only the FOUNDER approves, rejects
  or marks the art uploaded (`public.is_founder`, one account claimed once from the panel — never a role check, and never
  a department). A super admin who is not the founder reads the queue but cannot decide it. Never let the submitter
  approve their own idea.
- **Every badge upload has a transparent background** (founder, 2026-11-05): no white box, no solid plate, no baked
  shadow or gradient behind the art, and no cropping the glyph to fill the canvas. A badge sits on the app's dark
  surface, so anything opaque reads as a square behind it. The same rule covers badge art on the homepage and in emails.
- Naming is fixed by `src/lib/badge-protocol.ts` and enforced in the database too: lowercase words joined by single
  hyphens, starting with a letter, 48 characters at most. The web copy is 512×512 transparent WebP under 120 KB at
  `icons/<serious|playful>/[<set>/]<slug>.webp`; the 4K master is a transparent PNG at `4k/icons/…/<slug>.png`. The
  badge's `src` in badges.ts uses the same slug, and the picture is only ever a URL through `artUrl()`.
- Art is submitted to the private `badge-submissions` bucket and read through a signed link a super admin asks for, so a
  rejected badge is never a public picture. Art in the bucket is not a live badge: the badge still needs its `BadgeDef`,
  a real `metric` in badge-rules.ts, and one earned run before it ships (see the engineering steps in the panel).

## Staff Idea Box (always follow)

- Admin → Idea Box (`StaffSubmissionsPanel` + `staff-submissions.functions.ts`) is where any staff member sends an idea,
  paperwork, a video, music, a photo or a project to a super admin (founder, 2026-11-05). Every staff member gets the
  tab because `visibleTabs` appends it to whatever departments they hold; don't gate it to a department.
- Files never travel through a server function's payload: the server issues a signed upload URL for the submitter's own
  folder in the private `staff-submissions` bucket, and the browser uploads straight to it. Keep the path check in
  `submitStaffIdea` (`startsWith(userId)`) — it is what stops a row pointing at someone else's file.
- Limits live in `src/lib/staff-submissions.ts` and are enforced in the database too: 25 MB for ideas, photos and other,
  50 MB for paperwork, video, music and projects (Supabase's own project limit). Bigger files go as a link. A new kind
  needs its label, hint, limit, accepted types and an entry in the table's `kind` check constraint.
- Only a super admin reads other people's submissions or downloads a file; the submitter sees their own rows and the
  note left on them. Never make the bucket public.

## Billing Console (always follow)

- Refunds and plan cancellations are done in Admin → Billing (`BillingConsolePanel` + `billing.functions.ts`), not in
  the Stripe dashboard (founder, 2026-11-05). Billing, Finance and super admins only; the browser names the target and
  nothing else. Never add a second refund path.
- The server decides, every time: `requireBilling` (super_admin, or the billing or finance department, mirroring
  `public.can_see_billing`) and never more than was paid minus what already came back. **There is no fixed per-refund
  ceiling** (founder, 2026-11-05): the payment is the ceiling, because a $500-style cap blocked legitimate refunds on
  the largest orders while doing nothing about the real risk. The rules live in `refundVerdict` in
  `src/lib/billing-console.ts` with its test — never inline in a component.
- The 30-day Refund Policy window is not a wall (founder, 2026-11-05): past it a refund is still allowed and needs a
  written note, because a chargeback costs more than most refunds. **A plan cancelled past the window refunds the unused
  time only** — `proratedRefundCents` in `src/lib/billing-console.ts`, and the server refuses more than that. One-time
  purchases stay a judgement call. `refundVerdict` returns `discretionary: true` for those and the server refuses one
  without a note. Never turn that back into a hard block.
- Paid-for time is capped at five years (`MAX_PREPAID_YEARS` in `src/lib/retention.ts`, enforced by
  `withinPrepayCap`). Today every payment buys one year and early renewal only reaches a renewal inside a year, so the
  cap is a guard for a future multi-year product, not a limit anyone meets now.
- The company policy staff are trained on is `BILLING-POLICY.md`; change it in the same commit as any rule here.
- The card statement descriptor and its card prefix live in `src/lib/plans.ts` (`STATEMENT_DESCRIPTOR`,
  `STATEMENT_DESCRIPTOR_PREFIX`) and are shown in Admin → Price List (founder, 2026-11-05). Stripe keeps only the first
  ten characters as the card prefix unless a shortened descriptor is set, so the prefix is what stops the name printing
  as `CAME THROU`. Keep both an exact substring of the business name — never invent a DBA, never put a service
  description there — and keep every Stripe product name and description in `STRIPE-PRODUCTS.md`.
- Pausing is never presented as cancelling (founder, 2026-11-05): the pause dialog says the plan renews by itself, Resume
  now says it ends the pause rather than the plan, and a member who thought a pause cancelled gets the prorated refund.
  The renewal reminder email always carries the Cancel-or-change link and that same warning.
- Money must be idempotent: the panel sends a fresh `requestId` per confirmed action and the server uses it as Stripe's
  idempotency key, so a double click or a retry never refunds twice. Keep that when adding an action.
- Every attempt writes a `billing_actions` row — refusals and Stripe errors included — with the actor's email. Never
  edit or delete those rows: that log is the audit trail that replaces Stripe's dashboard history.
- Stripe is called through `createBillingStripeClient`, which prefers `STRIPE_BILLING_LIVE_SECRET_KEY` /
  `STRIPE_BILLING_SANDBOX_SECRET_KEY` (restricted key: Refunds write, Charges and Subscriptions read) and falls back to
  the account key. Never widen that key to Payouts, and never put it in the browser.
- A "duplicate" refund is **verified, never taken from a screenshot** (founder, 2026-11-05): `src/lib/duplicate-charges.ts`
  reads a payment as settled, a hold, a refund or nothing, groups same-amount payments within 72 hours, and tells staff
  which one (if any) to refund. The server refuses a `duplicate` refund unless all four `DUPLICATE_CHECKS` are ticked and
  Stripe says the payment settled; a hold that never captured clears by itself (7 days typical, 30 at the outside), so
  never refund it and never tell the member to dispute it. Keep the rules and their test there, not in a component.

## Support Scripts & Ticket Routing (always follow)

- Support is its own department and owns the ticket queue (founder, 2026-11-05). `TICKET_DEPARTMENTS` in
  `src/lib/departments.ts` gives Admin → Support Tickets to Support and Billing; a **billing ticket** is one whose category
  starts with `BILLING_AREA` ("Account & billing"), the same prefix the inbox routing uses. Support sees every ticket,
  Billing only its own — enforced in `ticketScope` (`src/lib/support.functions.ts`) and again by RLS
  (`20261105170000_support-ticket-routing.sql`). Never widen Billing to the whole queue.
- The words staff send live in `src/lib/support-scripts.ts`: one catalog for every department, readable by **every** staff
  member from Admin → Support Scripts (`SupportScriptsPanel`), whatever department they hold. A new script needs its
  department, a "when to use" line and placeholders from `SCRIPT_VARIABLES`; a change to what we promise (refund window,
  proration, seats) changes `BILLING-POLICY.md` in the same commit. Staff-only wording sets `internal: true` and must
  never be sent to a member. A ticket carries its own copy of them (`TicketScripts` in `SupportTicketsPanel`): one click
  opens the queue owner's scripts — Billing's on a `BILLING_AREA` ticket, Support's otherwise — with the member's first
  name and the subject filled in. That is the shortcut, not a second catalog: the words still live in
  `src/lib/support-scripts.ts`.
- **Reply time is a typical wait, not a promise** (founder, 2026-11-05): member-facing copy says most replies go out in
  about 48 hours and that high-volume days and holidays take longer. Never turn that into "we will reply within …", a
  fixed date or a service-level guarantee, in a script, an email, the handbook or a policy page. The scorecards may keep
  an internal 48-hour target; the copy members read never promises one.
- **Holiday breaks are announced, not silent** (founder, 2026-11-05): the team takes Christmas and New Year, Thanksgiving
  and spring break off. `support-holiday-break` and `support-holiday-open-ticket` in `src/lib/support-scripts.ts` tell a
  member we are away, name the day we reopen (`{{date}}`, never a date the founder hasn't set) and give a typical wait
  of about 30 days after reopening, saying a busy week can take longer. That is timing, not a guarantee.
  `support-holiday-internal` is the staff checklist to run before each break: post it on every open ticket, switch on
  the auto-reply, and hand anything urgent to the founder before closing.

## Account Help & Holiday Cover (always follow)

- **Who may touch a member's account** (founder, 2026-11-05): Support and super admins correct the person (stage name and
  legal name via Admin → Accounts, `src/lib/member-account.ts` + `member-account.functions.ts`); Billing and super admins
  handle payment details. Never a plan change, a tier or a role from here: plans come from Stripe, roles from Admin →
  Staff. PRO, IPI numbers and splits stay the member's own to edit. The rules live in `accountScope` with their test.
- **Staff never type a card number** (founder, 2026-11-05): the card is changed on Stripe's own page, opened either by the
  member in Profile → Manage billing or through a card-update link Billing sends from Admin → Accounts. The steps are one
  constant (`CARD_UPDATE_STEPS`) and appear in the renewal reminder email too. Never build a card form in the app.
- **Holiday cover is a rota with undecided pay** (founder, 2026-11-05): one or two department leads work each break, and
  any employee who wants the extra earnings can ask; overtime and holiday work are approved on a need basis. The plan in
  `src/lib/holiday-coverage.ts` (Admin → Holiday Cover, super admins and department leads only) carries **no rate, no
  hours and no bonus** until the founder approves them. Never write a holiday figure into the plan, a script or an email.

## Staff Invites & Benefits (always follow)

- **One email, one identity** (founder, 2026-11-05): staff sign in with their own address, never the member account they
  may already have. `inviteStaff` refuses an address that already belongs to an account (`billing_find_user`) and one
  already on the team; the rule and the wording live in `src/lib/staff-invites.ts` with its test. Do not add a bypass —
  this is what stops an employee answering their own ticket or refunding themselves.
- **The invite lands on our page, not a sign-up form** (founder, 2026-11-05): `generateLink` redirects to
  `/reset-password?invite=1`, which asks for a password and says what happens next. The invite email repeats the same
  steps (`ACCEPT_STEPS`) and states that the staff login is separate from any member account.
- **Every account email is branded and sent by us** (founder, 2026-11-05): password resets go through
  `sendPasswordResetEmail` in `src/lib/auth-emails.functions.ts` (our link, `emailLayout`, admin@ as the sender), never
  the provider's default template and never `supabase.auth.resetPasswordForEmail` from a component. The same applies to
  invites, which are already ours. Any new auth mail follows that pattern.
- **The email header is smaller than it was** (founder, 2026-11-05): `EMAIL_LOGO_WIDTH`, `WORDMARK_FONT_PX` and
  `WORDMARK_MARK_PX` in `src/lib/email-layout.ts` are the only sizes; change them there, never inline in a template.
- **The staff plan is Catalog Management, free** (founder, 2026-11-05): `public.user_tier` returns `management` for any
  account with a staff role (`public.is_staff`) and for any account holding a live `staff_plan_grants` row. Do not gate
  staff access with a second, separate check: brand kit and contract generator follow the tier, so they come with it.
  `useBilling` reads `user_tier` too, so a page can never show a staff member as Free.
- **A reported member account keeps its paid year** (founder, 2026-11-05): staff report the email they already use as an
  artist in Admin → Staff Plan; a super admin or HR marks it staff. `staffPlanWindow` (`src/lib/staff-plan.ts`) starts the
  free year when any paid period ends and measures it from that cycle's start, so nothing is refunded mid-term. The grant
  is reviewed yearly; nothing renews it automatically.
- **The staff credits are one album of AI Protection and two albums of registrations a year** (founder, 2026-11-05): one
  album is `packageSongs("Album")` — 12 songs, the Album package's own size, never a new number. Registrations are spent
  one song at a time and a single batch is capped at one album (`registrationBatchAllowed`). The founder issues the
  credits; there is no automatic spend path, so the copy says to ask rather than promising an instant balance.
- **Pay and extra benefits stay undecided**: never write a wage, a holiday rate, a bonus or an extra perk into the
  handbook, the plan or an email until the founder approves it. The Handbook section says that out loud.
- **Leaving inside 90 days ends access the same day** (founder, 2026-11-05): `departureOn` in `src/lib/offboarding.ts`
  returns `immediate: true` and a deletion date 30 days out for anyone whose last day is within their first 90 days of
  work. `removeStaff` calls `recordStaffDeparture`, which ends the staff grant on that account and on any member account
  they reported, writes `staff_departures` and schedules the deletion. Never delete an account from a trigger or an
  admin panel action: `runStaffOffboarding` (daily cron) is the only path, it skips anyone who holds a staff role again,
  and it writes `deleted_at` once.
- **The 30 days are a chance to pay, not just a download window** (founder, 2026-11-05): paying for any plan before the
  date cancels the deletion and keeps the account and its assets. Say that first and give the deletion date as the
  outcome of not paying (`SECURE_COPY`, `keepsAccountOnPayment`); the job re-checks the tier on the day, so a late
  payment still wins and the row is cancelled instead of deleted. Never invert that order in an email or a panel.
- **Past 90 days nothing is deleted and nothing is cut short** (founder, 2026-11-05): `departureOn` returns
  `deleteOn: null`, the grant is left to run to the end of its period, and the plan then bills as a normal paid plan
  (`planRecycles`). Do not add a grace period, a different window or a silent deletion for them.
- **The rule covers staff-plan accounts** (founder, 2026-11-05): accounts created under the staff plan, and staff who
  claim the offer inside their first 90 days. It is not a retroactive rule for older member accounts that were never on
  the staff plan.
- **Catalog emptying is not account deletion**: `runCatalogLapses` removes a member's songs and files 30 days after a
  plan ends and keeps the account. Nothing in the app deletes an account except the staff offboarding job above, so
  never describe a canceled plan as "the account is deleted".

## Admin Hub & Team Culture (always follow)

- **Navigation is grouped, not a flat tab list** (founder, 2026-11-05): `groupTabs` in `src/lib/admin-nav.ts` puts every
  tab into Operations, Roster & Revenue, Legal & Intellectual Property or HR & Internal Knowledge. `visibleTabs` in
  departments.ts still decides who sees what, so a group never shows a tab the permissions refuse — and an unknown tab
  falls into a final "More" group rather than disappearing.
- **My Queue is the primary hub** (founder, 2026-11-05): three columns (Working On Now, Waiting, Completed) and a bar that
  fills from ticked steps (`queueProgress` in `src/lib/queue-board.ts`), counting items only until steps exist. Real work
  is still finished in its own tab; the queue tracks it.
- **A step belongs to whoever does the work**: the owner writes, edits, deletes and ticks their own steps. A super admin
  or department lead can set one to `locked` or `approval` (`canLockSteps`); the owner still ticks it, because a lock
  protects the plan, never the work — and a wording change then goes through `step_change_requests` for a lead to decide.
  Never add a second lock path in a component.
- **Finishing is a team win** (founder, 2026-11-05): `recordWin` writes `staff_wins`, the finisher gets `Confetti`, and
  every signed-in staff member sees the toast from the polled header feed (`WinFeed`). Sound is optional; the visual is
  not — never add a setting that hides other people's wins.
- **Team Board is cross-department** (founder, 2026-11-05): per-department in-progress counts plus the `team_notices`
  micro-chat. Leads, super admins and Project Managers post (`canPostNotice`); everyone reads, so a dependency is written
  down where the other team already looks.

## Catalog Playback & WAV Storage (always follow)

- The catalog play button is a **check-the-version preview, not a listening player** (founder, 2026-11-05): one button
  per song in My Catalog, so a member can hear that it is the right version and that the file is whole — not cut off,
  wrong mix, silent tail — from their own computer. No queue, playlists, background or lock-screen playback, share
  links, or playing outside My Catalog. Never grow it into a listening app unless the founder asks.
- **The bytes never touch the Worker** (founder, 2026-11-05): the server verifies the member owns the path and returns
  a short-lived signed R2 URL; the browser streams straight from the bucket's custom domain. Never proxy audio through
  a server function, never cache a private master at the edge, and never transcode or draw waveforms in the Worker
  (30 s CPU ceiling, 128 MB memory, no ffmpeg). Signed URLs expire in minutes and are issued per play. See
  `PLAN-catalog-playback.md`.
- **WAV: unlimited embedding and download, storage not yet promised** (founder, 2026-11-05): embedding a WAV into a
  master and downloading it again is unlimited, and it runs in the browser, so it costs us nothing. Masters are still
  stored today, but **the storage limit is undecided** — whether we keep them as they are, cap them, or charge extra to
  store them is settled before launch. Until the founder approves a number, never write a GB figure or "unlimited WAV
  storage" in copy, a Stripe description, a support script or an email. When it lands, put it in one constant and quote
  it from the plan chart, the price list, the FAQ and `STRIPE-PRODUCTS.md`.

## Writer Credits & Registration Rules (always follow)

### Core principle
Embedding is forgiving; registration is strict. Never block a user from saving or embedding a song because of incomplete writer info. Only block songs from entering registration sessions or agency exports.

### Writer data
- Every writer has: legal_name (their only name, used for credits and registration; optional until registration), role, plus PRO affiliation (worldwide list), IPI name number and share. There is no credited or stage name for writers.
- Roles are exactly: "Author", "Composer", "Author/Composer". Do not add, rename, or remove roles without asking.
- "Author/Composer" counts toward BOTH author and composer coverage everywhere: validation, catalog, exports, reports.
- Songs can have unlimited writers.
- Songs can be marked Instrumental, which removes the author requirement.

### Registration readiness (single source of truth)
- A song is "Ready" only when: (has an author OR is instrumental) AND has a composer AND every writer has a legal_name.
- Splits are checked by the same module as `warnings`: they never hold back an agency export (it goes out with a warning), but they DO block registration assistance, because splits must be settled before registering: writer splits must total exactly 100%, and if any publisher is listed, publisher shares must total exactly 100% (shares are entered as 100% of the publisher half, not of the whole song). Exports still go out, with a warning naming the songs to fix. SoundExchange skips the split check because it registers the recording, not the song.
- This logic lives in ONE shared function/module. Every feature (embed indicator, catalog badge, export gate, any future agency template) must call it. Never re-implement readiness checks anywhere else.
- Readiness returns a list of specific missing items, not just true/false, so the UI can tell users exactly what to fix.
- Registration assistance (our agents registering for the user) uses the stricter per-agency check `registrationCheck` in the same module, never the export gate. It builds on the core rules, always blocks on splits, and adds each agency's requirements (PLAN-registration-intake §5):
  - **ASCAP:** writer PRO + IPI, publisher (PRO + share) or Self-published, samples answered.
  - **BMI:** the ASCAP items plus publisher IPI (except that a song with no publisher needs neither a publisher nor Self-published when its writers are with BMI, whatever their role: BMI pays them the publisher share too), duration, genre, "written for film/TV/stage/ad" answered, and a label once released.
  - **The MLC:** IPI for writers in a PRO, publisher or Self-published (the exception: a song whose writers are all with BMI and has no publisher needs neither; the bulk file lists the writer as publisher with the placeholder IPI 123456789, removed in The MLC Portal after upload), ISRC.
  - **SoundExchange:** recording only, with no writer checks: ISRC, master share, UPC.
  - **ASCAP and BMI never require an ISRC** (founder, 2026-11-05): a PRO registers the composition, not the recording, so a
    songwriter who writes for other artists, a composer selling scores or an unreleased work all register without one. At
    ASCAP a missing ISRC is a tip; BMI does not ask. Only The MLC and SoundExchange block on it.
  - Saving, embedding and the user's own exports are never held to these.
  - A song's "I'm a BMI writer with no publishing company" choice (`bmiWriterPublishing`) states the BMI no-publisher case out loud; it only counts when every writer is with BMI.

### Data flow
- Embed → Catalog → Agency export templates. Changes to writer fields must be carried through all three.
- Exports and registrations always use legal_name.
- When adding a new agency/PRO export template, it must use the shared readiness check and the existing writer fields. Do not create template-specific writer fields.

### UX conventions
- Missing writer info shows as a warning (⚠️) with a direct link to the field that needs fixing, never a dead-end error.
- Any new form field related to writers gets a help tooltip in plain language.

### Before making changes
- If a change touches writer fields, roles, readiness logic, or export templates, explain the plan and list affected files before editing.
- Never delete or overwrite existing writer data. Any schema change needs a migration that preserves current data.
  - Exception (approved 2026-10-21): a catalog is emptied 30 days after its plan ends, as the Refund Policy states (`runCatalogLapses` in src/lib/retention.server.ts). Signed split sheets, contracts, AI Protection certificates and agency registration records are kept.

## Personal Branding Rules (always follow)

Personal Branding is one kit that replaces the Came Through Audio header on everything the member hands out. These
rules keep it consistent as features are added.

### Which documents carry it
- `BrandUse` in `src/lib/brand-kit.ts` is the complete list of places a kit may appear: `contracts`, `splits`, `lyrics`
  and `catalog`. A new branded document adds a `BrandUse` entry, is allowed by `brandAccess()`, and is described on the
  plan chart and in Profile → Brand kit in the same change. Never gate branding with a second, separate check.
- Every PDF the app builds for a member goes through `newBrandedPdf(brand)`, `brandHeader(..., brand)` and
  `brandFooter(pdf, brand)` from `src/lib/brand-pdf.ts`, with the kit fetched by `myBrand(use)` (or `contractBrand()` for
  a contract the member owns or was sent). Never hard-code the Came Through Audio header in a new PDF.
- Split sheets always show the artist's stage name, never a kit's business or DBA name: a split sheet records who owns
  the song. Contracts show the kit's name. Company agreements always keep the Came Through Audio header.
- Emails are not branded by a kit. Outgoing email stays wrapped in `emailLayout()` (see the rule above).

### Who decides
- The server decides, every time a download is made: `getMyBrand` / `getContractBrand` check the plan and verified
  add-on purchases. The browser may only ask for a kit ID it already owns; it never passes an "on" flag, and a saved
  kit never switches itself on.
- Branding is never global. It applies on exactly two grounds and no others: the account is on Catalog Management
  (which includes one kit), or it has paid $13.99 for a kit for the year (`BRANDING_PRICE`, one purchase per kit, on any
  plan including Free). A lower plan, a seat, a trial or an invitation never turns a kit on.
- One paid kit covers every `BrandUse` at once for its own year. A refund ends that kit immediately for new documents
  and never alters documents already sent.
- A paid kit runs its own twelve months, independent of the plan (founder's decision, 2026-11-04). Cancelling or
  refunding a plan, inside the 30-day window or after it, never ends a paid kit or shortens its year. Only a refund of
  the kit itself ends it. The kit included with Catalog Management is not a separate purchase, so it follows the plan.
- Several kits are allowed (one per business or project): the oldest is the default, and a document that picks a kit
  gets that one only if it is within the member's allowance.

### When it fails
- A missing, unreadable or unavailable kit never blocks a download: the document simply keeps the Came Through Audio
  header. Never turn a branding lookup into an error the member sees.

## Plan Chart Marks (always follow)

- The eagle icons replace check marks. Any row the chart marks with eagle art shows only that eagle: never a check, tick
  or badge on top of it, and never a check beside it in the same cell.
- Contracts Delivery (`EAGLE_ART.contractsDelivery`) marks the paperwork and signing rows, and 1-Click Agency Exports,
  wherever those rows are included.
- Eye on the Prize (`EAGLE_ART.eyeOnThePrize`) marks the rows Catalog Management alone has, plus the rows marked
  `prize: true`, which carry it on every tier that includes them (Royalty Utility Suite on Catalog & Collaborate). Any
  other row that starts on a lower tier keeps the check it shows there, on every tier above it.
- A spotlit row may also carry a faint accent tint across the whole row (`highlight: true` on the feature), which is
  only a background: the row keeps its eagle mark and never gains a second one.
- New rows pick their mark by that rule inside `Mark` in `src/components/PlanComparison.tsx`. Never add a per-feature
  exception to it without the founder asking for one.

## Brand Lockup (always follow)

- Wherever the brand appears as a lockup, the name comes first and the slogan follows immediately: "Came Through
  Audio", then "Your first stop before distribution" (`SLOGAN` in `src/lib/social.ts`). Never the other way round, and
  never the slogan as the lockup on its own. Draw it with `BrandLockup` in `src/components/BrandLockup.tsx`, never by
  hand: the mark there is sized in em so it stays on the name's baseline on a phone instead of drifting. The mark picture
  carries 14 of its 256 px as empty margin on the right, which is what put daylight between the C and "ame" (founder,
  2026-11-05): wherever the mark stands in for the C, apply `MARK_TUCK` from `BrandLockup.tsx` and no hand-picked margin.
- The home-screen name is "Came Through" (`short_name` in `public/manifest.webmanifest` and
  `apple-mobile-web-app-title` in `src/routes/__root.tsx`); the full name stays "Came Through Audio".
- Social accounts: Instagram and TikTok are @camethroughaudio. They are edited in Admin → Homepage → Social, stored in
  `site_settings` under the id `social_links`, and read through `src/lib/social.functions.ts`. The footer draws only
  the platforms switched on with an address. A new platform is added to `SOCIAL_PLATFORMS` in `src/lib/social.ts` plus
  an icon in `src/components/SocialLinks.tsx`, never hard-coded in the footer.

## PDF Output (always follow)

- Text in a PDF the app builds is drawn as text, never rasterized: `pdf-lib` `drawText` with an embedded font (see
  `buildPdf` in `src/lib/pdf-tools.ts` and `brand-pdf.ts`). Never screenshot a page into an image to "flatten" it, and
  never downscale an upload before writing it back: the original pages are kept as they are.
- A placed signature is a PNG at roughly 5x the width it is drawn at (a 900px canvas for a 180pt signature, about
  360 DPI), so it stays sharp when printed. Keep that ratio when changing the signature pad.
- Downloads keep the `.pdf` name the member expects (`signedFileName`), and a document with no changes comes back byte
  for byte, so an untouched upload is never recompressed.

## Deploy Size & Old Deployments (always follow)

- A build must not ship badge art. `scripts/prune-served-art.mjs` runs from `npm run build` and drops `icons/` from
  `.output/public` (plain Nitro build) and `.vercel/output/static` (the path Vercel actually serves) whenever
  `VITE_ART_BASE` is set. A prune that covers only `.output` silently does nothing on Vercel: the build-log line
  starting `[art]` is the only proof it ran, so check it after changing the build.
- Old deployments are the other half of the storage bill: one pre-R2 build was ~224 MB, and 123 of them held ~27 GB
  against a 10 GB allowance. `scripts/delete-vercel-deployments.mjs` clears them. It reads the token from
  `VERCEL_TOKEN` only (hand-pasted into the ignored `.vercel-token`, never committed), always keeps the promoted
  production deployment plus the newest 40, and dry-runs unless `--delete` is passed. The Vercel connection available
  to the agent cannot delete deployments, so this always needs a founder-created token.

## Downloads: One Click, Our Branding (always follow)

- **A download is the product, not a per-song chore** (founder, 2026-11-06): My Catalog offers one click for the whole
  catalog and one per album or EP. `downloadWholeCatalog`, `downloadRelease` and `groupReleases` in `src/lib/catalog.ts`
  build the ZIP (masters, artwork, lyrics PDFs, catalog PDF) through one shared path; never add a second downloader.
- **Every download button must actually fire** (founder, 2026-11-06): saving a file goes through `saveBlob`, which puts
  the anchor in the document before clicking it, because a detached anchor is ignored in Safari and the button looks
  stuck. A failed build must say what failed — never a generic "could not build" toast.
- **Our branding is on every file, on every plan** (founder, 2026-11-06): all downloads carry
  `MADE_ON_LINE` — "Made on Camethroughaudio.com — Your first stop for distribution" — in Primary Black #0b0b0b. The
  word "Generated" never appears on a download, and no generation date is printed. Only Catalog Management (which
  includes a kit) or a paid `branding_yearly` add-on replaces our header, and a kit that isn't set up yet
  (`kitReady`) still gets our default header.
- **Only Catalog & Collaborate and Catalog Management may cut the footer off** (founder, 2026-11-06): `brandFor` in
  `src/lib/brand-kit.functions.ts` forces `showFooter: true` on any lower plan, whatever the saved kit says. Never move
  that check into a component.
