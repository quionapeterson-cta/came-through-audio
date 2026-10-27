# PLAN — Founder testing list, sorted by urgency · v1

Status: **Level 1 done; Level 2 done (legal applied, password manager approved); Level 3 preview and Level 4 plans written, awaiting approval (2026-10-27).** Drop box built (Level 0).
Source: founder testing notes, 2026-10-27. Every item from the list is here once; nothing was dropped.

How to read this: work goes top to bottom. **Level 1** is broken or wrong data, so it's fixed first. **Level 2** is
setup and legal answers you need before launch (mostly answers from me, not code). **Level 3** is layout and wording
polish; each change gets a preview before it's built. **Level 4** is new features and business plans for after the
build is wrapped. Items marked ❓ need a decision from you first.

---

## Level 0 — Drop box (done 2026-10-27)

- [x] A private upload shelf on GitHub that works in any browser and is **not connected to Lovable**:
  https://github.com/quionapeterson-cta/came-through-audio/tree/dropbox → **Add file → Upload files** → drag files in
  → green **Commit changes** → tell Claude. 25 MB per file; bigger videos go by Google Drive link.
  Why the old way failed: the `incoming/` and `screenshots/` folders only exist inside the Codespace, so anything put
  somewhere else (Lovable, GitHub's main page) never reached them.
- [ ] Waiting on you: new browser icon, app icon and embed icon; updated photos, badges, music and videos.

## Level 1 — Broken or wrong data (fix first)

Writer and readiness code is involved, so per the project rules I list the files and findings before editing.

**Items 1–5 built 2026-10-27** (findings approved): typed songs link to their order by title, every order song stays listed, catalog songs in an order show what's left with Continue Expert Registration; saved writers/publishers/producers fill in by name in Embed and My Catalog; a restored Embed draft takes current profile details + Start fresh; Embed shows no split warnings; Contributor Library gains usual role + split, fills itself from saved songs (blanks only) and is in My Catalog. Needs migration 20261027180000. Item 6 (HFA): closed 2026-10-27, nothing counts it (founder confirmed; HFA stays optional).

**Items 7–14 built 2026-10-27:** master share capped at 100; badge celebration fits the screen and scrolls from the top; sharper pop-up text and smaller ⓘ icons; confirm boxes sized to the message; Change email / Change password need the current password, new email confirmed from its inbox; Support tickets need sign-in (Contact Us stays open); MLC and SoundExchange exports checked against the official templates (match), MLC AKA titles filled; The MLC no longer needs an ISWC in the health score, duration hint and auto-read durations as mm:ss (03:45), MLC Member Settings tip, Agent tips in Admin → Registrations.

1. **Expert Registration lost a song.** Two songs submitted; the fully cataloged one was marked registered and the other
   disappeared. Fix: a song that isn't ready stays in the request with "Fix and continue", and its catalog entry shows a
   notice linking back to finish the registration.
2. **A writer added to your artist profile doesn't fill into catalog entries.** Check `withProfileFilled` and the
   profile → catalog path.
3. **Catalog updates don't show up in the embed form ("pre-embeds").**
4. **False splits warning when embedding.** With 75/25 set in the catalog, the embed said "Writer splits total 75%" even
   though splits aren't shown or entered there. Splits never embed, so the embed step shouldn't warn about them; the
   catalog is where they're fixed.
5. **Writer flow audit, Embed → Catalog → exports.** Walk every step, report findings, then fix: past writers, credits
   and contributors (with PRO, IPI and publisher) should be remembered, offered as suggestions on new entries, saved to
   the Contributor Library automatically, and the Contributor Library should be usable from My Catalog.
6. **HFA P# should not count against readiness or health.** It's optional (Harry Fox only).
7. **"Share of the master you usually own" can go above 100%.** Cap it at 100.
8. **Profile badge cut off at the top** when clicked next to the artist name in Embed and Catalog.
9. **Blurry text** in profile info boxes and info-tip pop-ups; make the info icons smaller so they sit right on the
   field below.
10. **Pop-ups bigger than their message** (delete boxes especially). Already a global rule in BRANDING.md §3; find
    the boxes that still break it and fix them all.
11. **Account security:** changing the email or password needs the current password; a new email must be verified.
    Users can also change their username.
12. **Support form requires sign-in** (stops spam and fake tickets).
13. **Agency exports match each agency's own template format** — check every export against the current templates.
14. **The MLC findings (from your call):**
    - The MLC matches on artist name, song title and ISRC; release date, duration and other recording data come from
      the stores (DSPs). Rethink how the health check scores release date and duration so it measures what the
      agencies actually use, and say so plainly to users.
    - ISWC is not required to register at The MLC; it can be added after the PRO assigns it. Say this in the app.
    - Duration shown and pre-filled as **mm:ss** (e.g. 03:45) to match agency forms.
    - Agent tips: Member settings is at the bottom left of the Members Hub; if a field shows red, check for spaces
      before or after the text; bulk registration needs a laptop or desktop, not a phone.

## Level 2 — Setup and legal answers before launch (answers, small edits)

**Stripe** — answered 2026-10-27 in PLAN-stripe-setup-guide.md (Branding Kit price set to $13.99 site-wide):
- Which service type to pick for Stripe branding.
- Sales tax code for each product (Georgia).
- Lookup key: what goes in the key field vs the value field.
- A plain-language table of every Stripe product: name, price, description, lookup key, tax code, what to attach.
- Products only exist in one sandbox: how to copy them to the live account.
- Where to set the receipt email (support email already moved to billing@).
- A free, Wi-Fi-based support phone number that also works for two-step verification codes.

**Legal and business:**
- **Approved and applied 2026-10-27: PLAN-legal-updates-preview.md** (record label disclaimer, short names, AI Protection, DBA answer).
- Global disclaimer: Came Through Audio is a record label offering independent label services; not currently signing
  other artists. Check every disclaimer so none contradicts a service we sell.
- AI Protection wording: best practice for saying certificates help show proof, while keeping the company out of
  people's personal disputes.
- Add "Came Through" and "Came Thru" to the short company names in the legal documents. ❓ Whether a nickname needs a
  DBA: I'll explain the difference; a lawyer or the Georgia Secretary of State gives the final word.
- Super Admin and Security can edit the legal documents from Admin. **Built 2026-10-27:** Admin → Legal, section by section, history kept (migration 20261027200000).
- Launch day: remove pre-launch wording and confidentiality notices everywhere (one switch). **Built 2026-10-27:** removing SITE_PASSWORD now also drops the pre-launch section from company agreements (the gate, homepage notice and registration agreement already followed it).

**Hosting and domain:**
- Lovable's free plan limits once your domain is connected vs moving to Cloudflare — **done 2026-10-27: PLAN-hosting-comparison.md** (recommends Cloudflare Workers Paid, $5/mo).
- Calendar reminder: renew camethroughaudio.com on GoDaddy every week from Jan 1 to May 16, 2027; checking it off
  marks it complete. Notes: $341.82 for 9 years or $37.98 for 1 year. **Built 2026-10-27** (Finance task with weekly reminder emails; done tasks show crossed off on the calendar; migration 20261027190000).
- Subdomains (up to 100) vs blogs: do they affect each other? (Short answer coming with the SEO plan.)

**Registration agents** — **built and written 2026-10-27: PLAN-registration-agent-process.md** (🔒 who's working each order, legal name on each order, step-by-step; team password manager approved 2026-10-27, no in-app vault):
- A foolproof agent process so no data or users get mixed up: one queue item per user, the user's name and song list on
  screen while working, checkboxes per step.
- Passwords for agency accounts made for users: a new password per user, kept in a staff-only, encrypted field on that
  user's registration record, never shown to other users. **Approved 2026-10-27.**
- Two-step verification: choose email; the code arrives at registrations@.
- Making sure we're linked to the right user when they add us as their representative: a per-user reference code to
  include, checked by the agent.

## Level 3 — Layout and wording polish (preview before building)

**Preview ready 2026-10-27: PLAN-level3-preview.md** (all items below, with mockups). "Copyright Owner listed twice" fixed as a bug.

**Homepage**
- Move "Who it's for" above "How it works".
- Take the icons off "Who it's for" and use them as animated badges.
- Move the composer icon to the bottom right of the picture.
- Help chat bubble: small, bottom right, with a help/chat icon.
- Help box answers: "How much is AI Protection" found nothing. Teach it prices and common questions. I'll send you a
  list of questions to approve answers for.

**Share card**
- The top gets cut off in Facebook previews. Show the whole card, or a close-up — preview both (PLAN-share-cards).

**My Catalog**
- Put "I'm self-published" and "BMI pays me" above the Writers section, and explain the BMI exception right there
  (you reached 100% by ticking BMI without knowing why).
- "Recorded in" with neighboring rights doesn't fit — reword.
- © and ℗ symbols in a clear font (an exception to Poppins).
- Remove "Instrument players"; add instruments to the performers list instead.
- Copyright owner listed only once in "How you usually hold the master".
- A much longer genre list, including popular subgenres.
- What the Recheck button does now that MusicBrainz is out — fix or remove it.

**Split Sheets** — move "Generate split sheet" above the boxes (Contributor Library, pending signatures…).

**AI Protection Hub** — lay it out like the Split Sheets hub: a "Protect" dropdown under the description to pick songs
by single, EP or album (or one by one), then boxes left to right: Create your certificates · How your certificates
protect you · My certificates.

**Contracts & Blueprints**
- The contract generator gets its own tab right before the contract.
- Show the contract first (step 1 is Read), then the details to fill in.

**Profile and badges**
- Account section: replace "25 days left to ask for a full refund" with the prorated upgrade offer during the 30 days.
- Profile badges: one step to share, like the profile badge share screen, with the description underneath; repeat
  badges stack like coins with a count (5×).

**Branding Kit** (preview as one design pass)
- After purchase: instructions on how to use it (Profile → scroll to Branding Kit…).
- Enter an exact hex in the color picker.
- Default font Arial, not Poppins.
- Footer tagline matches the generated text color so it blends with any brand.
- Contract term headers default to black #0b0b0b when a kit is chosen; users can pick their own header color
  (dark recommended).
- Four contract template styles to choose per kit (some with clean side designs) — previews coming.
- Edit kits and pick the kit for the next contract from the Contracts tab.
- Other simple ways to customize — ideas in the preview.

**Share caption generator** — more promotional captions, and ideas for varying them by user activity.

## Level 4 — New features and business plans (after the build is wrapped)

**Plans written 2026-10-27: PLAN-level4-plans.md** (every item below, with the social DM keywords and messages).

- **More branding kits:** **$13.99 per kit per year** (founder, 2026-10-27), offered from the contract generator and the
  Contracts & Blueprints tab with every $3.99 contract; users can add as many kits as they need.
- **Split sheet trial:** keep the 30-day trial; add **10% off, good for 14 days** after accepting it (approved 2026-10-27).
- **Badge award system overhaul**, including the lyric badge bug (First Lyric Entry given every time, showing 5),
  new Royalty Health badges (your tier series), the badge creation process written up as BADGE_PROCESS.md, and the
  badge prompt library saved in Admin for super admins and Marketing. The founder's badge notes (Oct 27 list: CTA Badge
  Creation Process + Prompt Guide) are the reference for how the original badges were made.
- **React in Admin:** React is the free AI tool the founder uses to make badges. Plan: a launcher in Admin for super
  admins, Marketing and Branding, with the badge prompt library next to it, and a how-to for free-plan users.
  ❓ Send the React link so the launcher opens the right place.
- **Branding & 1-on-1 coaching:** guided worksheet staff fill in with the user, then generated brand guidelines, a
  branding bible, a One Sheet and an Artist Menu. Branding Power Session walkthrough slots with a video engine.
- **Consultation and email consultation service** (plan for later).
- **Registration intake plan** for account setup assistance (update PLAN-registration-intake).
- **Homepage features program:** users can be featured if they sign a perpetual photo/video release, submit a
  testimonial, give a Came Through badge, a clear photo, city and artist name.
- **Came Through Rank:** shout-out campaigns every 6 months with special badges; each share raises rank and unlocks
  profile designs (bedazzled header, gold or platinum background, gold/silver accents). More ideas included.
- **1,000 SEO blogs** that each lead to a service (builds on PLAN-blog), plus review sites people may look us up on.
- **Social media DM automation** for @camethroughaudio and @karma_came: keywords (registrations, embedding, education,
  cataloging, sign up, me, crown keepers, merch, beat videos) and matching messages leading to free accounts and beats.
- **AI department:** plan to hire music entertainment lawyers to train the AI.
