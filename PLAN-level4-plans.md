# PLAN — Level 4: new features and business plans · v1

Status: **plans for review (2026-10-27). For after the build is wrapped; nothing here is built yet.**
Source: founder testing list, 2026-10-27. Each section ends with what it needs from you.

---

## 1. More Branding Kits ($13.99 per kit per year)

- A user can own several kits (one per business or project). Each kit has its own logo, colors, font, tagline,
  contract style (Level 3 #23) and term header color.
- Catalog Management includes one kit; every extra kit, and any kit on other plans, is $13.99 a year.
- Offered at the right moments: in the Contract Generator after a $3.99 contract is made, and in Contracts &
  Blueprints. Edit kits in Profile or from the Contracts tab; pick the kit for each contract before generating it.
- Build: a kits table (several per user), Stripe price `branding_yearly` with quantity, a kit picker on contracts and
  split sheets, the PDF uses the chosen kit. **Needs:** nothing new from you (price decided).

## 2. Split sheet trial offer

- Keep the 30-day Catalog & Collaborate trial. Right after someone accepts it, offer **10% off a yearly plan, good
  for 14 days**, shown in the trial welcome, the trial emails and Profile, with a countdown.
- Build: a Stripe coupon (10%, once) applied at checkout when the offer is still open. **Needs:** create the coupon
  in Stripe (I'll give the exact clicks).

## 3. Badge system overhaul (after the build wraps)

- **Fix the lyric badges:** "First Lyric Entry" is being given again on later entries and shows the wrong count. Each
  lyric milestone (1, 5, 25, 40, 50, 100) is awarded once, at its own count.
- **Audit every badge rule** against its art and description; repeating badges (like Marathon) count correctly.
- **Royalty Health badges, rethought:** your tier series (25% Checkup Started → 50% Steady Pulse → 75% Fully Fortified
  → 100% Clean Bill of Health, plus Critical Care / Resuscitated) replaces the current health badges.
- **Badge creation process:** your notes (flat magenta background, chroma-key cut, mask fallback, 1600×1600 transparent
  PNG with a white outline, `cta-` file names) saved as `BADGE_PROCESS.md` in the repo, word for word.
- **Badge prompt library in Admin** (super admins and Marketing): your master prompt formula, the brand guidelines
  "training" prompt and every series prompt (Lyricist, Songwriters, Live Musicians, Split Sheets, Contracts &
  Blueprints, Hip-Hop, Spiritual Rapper, Royalty Health tiers), with a Copy button on each.
- **React launcher:** a button next to the prompt library that opens React (your free AI badge tool), for super
  admins, Marketing and Branding. Free-plan users get a short how-to guide for making their own share art.
  **Needs:** the React web address.

## 4. Branding & 1-on-1 coaching

- **Branding session:** a guided worksheet in Admin. The employee asks each question on a call and types the
  answers. From the answers the system drafts a **brand guide**, a **branding bible** (voice, visuals, do's and
  don'ts), a **One Sheet** and an **Artist Menu** (services and rates), in the artist's Branding Kit style, for the
  employee to polish and send.
- **Branding Power Session walkthrough:** booking slots, plus short walkthrough videos made with a video tool from
  scratch for each step of the worksheet.
- **Consultation / email consultation** (later): a paid 30-minute call or a written answer within 2 business days,
  booked and paid in the app, routed to the right department.
- **Needs:** prices for each, and your worksheet questions (I can draft a first set).

## 5. Registration account setup intake

Help for people who don't have PRO, MLC or SoundExchange accounts yet: a short intake (which accounts they have, legal
name, writer vs publisher, release status), a checklist per agency with links, and an optional paid "we walk you
through it" session. Builds on PLAN-registration-intake.md. **Needs:** whether it's free or paid, and the price.

## 6. Homepage features program

- Users can apply to be featured on the homepage. To qualify they must: sign the perpetual photo/video release
  (Company Contracts already has it), submit a testimonial, choose the Came Through badge that matches how we helped
  them, upload a clear or professional photo, and enter their city and artist name.
- Staff approve in Admin → Homepage; approved features rotate on the homepage.
- **Needs:** nothing; ready to build.

## 7. Came Through Rank and shout-out campaigns

- Every 6 months, a shout-out campaign with its own limited badges.
- Each share raises the user's **Came Through Rank**. Rank steps (3–4 shares each) unlock: (1) a feature in an email
  blast, (2) a video testimonial spotlight, (3) a review on Google or another trusted site, (4) a share code with Came
  Through branding.
- Each rank unlocks a profile look in CTA style that they can adjust: a bedazzled artist name header, a gold or
  platinum background, blue accents turning gold and silver.
- **More ideas:** a yearly "Came Through Wrapped" recap card; referral badges when a friend signs up; a public rank
  page for the top supporters each campaign.
- Keeps the brand rules: gold and platinum stay on badges and these earned profile looks only.

## 8. 1,000 SEO blogs, subdomains and review sites

- **Blog plan:** 1,000 articles over about a year, each answering one real question musicians search for (how to
  register a song with BMI, what an ISRC is, how splits work, how to get mechanical royalties…), each ending with the
  Came Through service that solves it. Grouped into topic clusters with one main guide per cluster linking to its
  articles. Builds on PLAN-blog.md.
- **Subdomains vs blogs:** keep the blog on the main domain (camethroughaudio.com/blog), not on 100 subdomains. Search
  engines treat each subdomain as a separate site, so posts on subdomains don't build up the main site's ranking.
  Having up to 100 subdomains available at GoDaddy doesn't affect the blog either way.
- **Review and rating sites:** claim a Google Business Profile (the most important), then Trustpilot, Yelp, the BBB
  and Capterra/G2 for software; link them in the footer and ask happy users for reviews after a milestone.
- **Needs:** OK to start with the first 50 articles (I'll send the list of titles).

## 9. Social media keyword DMs (@camethroughaudio and @karma_came)

Use Instagram's own auto-replies or ManyChat (free plan): when someone comments or DMs a keyword, they get the matching
message. Links go to the free account or the right page.

| Keyword | Message |
| --- | --- |
| REGISTER | Came Through Audio Came Through for you! Here's how to make sure every song is registered so you get paid: [link to Expert Registration]. Start with a free account and see what's missing in minutes. |
| EMBED | Your song info belongs inside your music file. Embed your credits, ISRC and artwork for free: [free account link]. Your first stop before distribution. |
| LEARN | Music business made simple. Free guides on royalties, splits, PROs and more: [learn link]. Save this one 📌 |
| CATALOG | Keep every song, split and code in one place: [free account link]. Your catalog, organized and ready to register. |
| SIGNUP | Welcome in! Create your free Came Through Audio account here: [free account link]. Tell me what you're working on and I'll point you to the right tool. |
| ME | Hey, it's Karma Came 👑 Thanks for reaching out. What can I help you with: beats, music business, or getting your songs registered? |
| CROWN | Crown keepers stay protected 👑 Don't let em knock you out cho'crown. Start here: [free account link]. |
| MERCH | The merch is here: [shop link]. Tag us when yours arrives 👑 |
| BEATS | Looking for beats by @karma_came? Browse and buy here: [beat store link]. Questions about a lease or exclusive? Reply here. |

Crown lines are used only on @karma_came and the CROWN/ME keywords, so crowns stay a subtle touch (BRANDING §4).
**Needs:** the shop, beat store and learn links; which keywords go on which account.

## 10. AI department: training with entertainment lawyers

- Hire one or two music entertainment lawyers part-time (contract basis) to review and improve: the contract
  blueprints, the Contract Generator's instructions, the help chat's answers, and every disclaimer.
- Process: they review a fixed set each month and log changes; nothing the AI says about contracts changes without
  their sign-off; their review is noted on each blueprint ("Reviewed by counsel, [month]").
- Where to find them: state bar entertainment law sections, Volunteer Lawyers for the Arts, music business programs.
- **Needs:** a monthly budget.
