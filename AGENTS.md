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

- Keep metadata embedding in a browser-safe utility using browser-id3-writer; the uploader creates local MP3 downloads without changing catalog persistence or database permissions.
- Embeds never carry publisher information (no TPUB or publisher tags), nor the ℗ line or language: those stay catalog-only. PRO affiliations, IPI numbers and splits are never embedded either.
- Catalog entries fill their blanks from the profile (Embed Defaults + Catalog Profile, incl. writer PRO/IPI/share matched by name) via withProfileFilled in src/lib/artist-profile.ts; never overwrite what a song already has.
- Use shared semantic primary, accent and ring tokens for brand accents, so all controls follow the global theme.

- Paid access comes from payment-provider webhook rows (Stripe; subscriptions for yearly tiers, purchases for one-time buys) keyed by human-readable price IDs in src/lib/plans.ts (Stripe lookup keys); the client never writes them, so payment state cannot be forged.
- Staff roles live in public.user_roles (checked via is_staff/has_role); profile role/tier are trigger-protected from self-edits, so admin access cannot be self-granted. Admin reads go through staff-verified server functions.
- All outgoing email HTML must be wrapped with emailLayout() from src/lib/email-layout.ts — keeps branding and legal-footer compliance in one place.
- Badge artwork is served from the Cloudflare R2 bucket (founder, 2026-11-04): the 512px web-ready copies mirror public/icons/<serious|playful>/<set>/ and public/art/clinic/ at the bucket root, and the original 4K masters stay in the bucket's separate 4k/ folder, which the app never requests. Paths stay literal in the data (badges.ts, eagle-status.ts, ClinicArt.tsx); they become a URL in exactly one place, `artUrl()` in src/lib/art-url.ts, which adds `VITE_ART_BASE` and swaps .png/.jpg for the .webp copy. Never hard-code the bucket address anywhere else and never render a raw art path, so the art can move again without a sweep. With `VITE_ART_BASE` unset (local dev, tests) the same paths load from public/, which is the fallback copy. The 4K masters under `art/badges-4k/` are NOT tracked in git (founder, 2026-11-04): they live only in the bucket's `4k/icons/` folder, because they are print archives that the site never loads and they bloat every clone and deploy. Re-rendering them writes to the local folder, which stays ignored. A build with `VITE_ART_BASE` set also drops `public/icons` from `.output` (`scripts/prune-served-art.mjs`, run by `npm run build`), because a deploy that reads the bucket should not ship 179 MB of unused copies; without the variable the folder ships as the fallback.

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
  hand: the mark there is sized in em so it stays on the name's baseline on a phone instead of drifting.
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
