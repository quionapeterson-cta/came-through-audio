# PLAN — Company Contracts in Super Admin, e-signature strength · v1

Status: **§1 v1 built 2026-10-21 (6d1d62e): Company Contracts tab, testimonial release + blank, editable templates. Rest of the plan still pending.**
Source: founder request, 2026-10-19.

---

## 1. Company Contracts tab (/admin → "Contracts", super admin only)

Company documents (testimonial releases, ad-content deals, brand deals) live here and never appear in a customer's Contracts vault.

### How it works
- **Same engine as customer contracts**: frozen text once sent, SHA-256 hash, time stamp, signer must log in with the invited email. Nothing new to trust.
- New column `contracts.is_company boolean default false`. Only super admin can create rows with it (RLS). The public vault hides them; the admin tab shows only them. Existing contracts are untouched (default false).
- New column `contract_parties.offer_trial boolean default false`. When sending, a switch per recipient:
  `☐ Invite them to a free 30-day Catalog & Collaborate trial`
  Off = they create a free account only to sign. The trial fraud guard still applies, except the "10 invites per inviter" cap, which doesn't fit company use.
- Signing page reads "From Came Through Audio, LLC" instead of a customer's name. Email uses `emailLayout()`.
- List view: Draft · Sent (waiting on who) · Signed, with search, and download signed PDF.

### Company blueprints (moved out of / not shown in the public vault)
| Blueprint | Notes |
| --- | --- |
| **Photo, Video & Testimonial Release** | Moved from the public vault. Customers' existing drafts with it stay readable and signable. |
| **Artist Ad Content Agreement** (new) | Studio artists send a commercial or review video; CTA may use it in paid ads. See §2. |
| **Brand Partnership Agreement** (new) | Deliverables, posting dates, fee or product, usage rights, approval, disclosure (#ad), exclusivity window, termination. |
| **Mutual NDA** (new) | For brand talks and partners before details are shared. |
| **Blank company contract** | Your own text, same signing flow. |

Every new blueprint is a starting template, plainly worded. **Have a lawyer review each before first use.**

---

## 2. Artist Ad Content campaign (lifetime membership, up to 5 artists)

### Key terms in the agreement
- **License:** the artist grants CTA a non-exclusive, worldwide, perpetual license to use, edit and run the video in ads on any platform. They keep ownership.
- **Artist promises** they own everything in it: the music/beat, the footage, and permission from anyone who appears (releases attached or confirmed).
- **Payment:** if selected, a lifetime membership at the tier you choose. "Lifetime" defined as: for as long as Came Through Audio operates the service, personal, non-transferable, may end for Terms of Service violations.
- **No obligation to select:** CTA picks up to 5 at its discretion; not chosen = no license used, video deleted on request.
- **Disclosure:** ads using it are labeled as a paid partnership; if the artist posts it themselves, they tag #ad / "Paid partnership". (US FTC endorsement rules: a free membership is payment, so the connection must be disclosed.)
- **Accuracy:** the review must reflect their real experience with CTA (FTC rule: no fake or scripted claims they don't believe).

### Also needed
- **Official campaign rules** page (who can enter, deadline, how 5 are chosen, judging criteria). Selection by judged quality is a contest of skill, not a lottery, but rules must be published.
- **Tax:** a lifetime membership has a cash value; ask your accountant whether it needs a 1099 (US) for winners.
- **Lifetime access in the app:** paid access only comes from verified payment records today. Add a **super-admin-only "Grant lifetime membership"** action that writes a logged grant row (who granted, why, linked to the signed contract). Users still can't grant themselves anything.

---

## 3. Are typed signatures legal proof?

**Yes, in the US.** The federal ESIGN Act and UETA (adopted by Georgia) make an electronic signature, including a typed name, as valid as ink. Most countries do the same (e.g. the EU's eIDAS "simple electronic signature"). A few documents are excluded (wills, some family-law and court papers), none of which CTA uses.

**What makes it hold up is the evidence, not the drawing.** A drawn squiggle on a screen adds almost no legal weight. Courts ask: did this person intend to sign, did they agree to sign electronically, and can you prove it was them and that the document wasn't changed. CTA already has: login with the invited, verified email; frozen text with a hash; a time stamp.

### Proposed upgrades (all signing areas: contracts, split sheets, company contracts)
1. **Consent checkbox** before signing: "I agree to sign electronically and that my typed name is my legal signature."
2. **Record IP address and device** with each signature (hashed IP for privacy; shown in the certificate).
3. **Certificate of completion** page at the end of every signed PDF: each signer's name, email, time, IP, document hash.
4. **Everyone gets a copy:** signed PDF emailed to all parties when the last person signs.
5. **Optional drawn signature** next to the typed name, for people who expect it. It shows on the PDF; the typed name stays the legal record.

This is general information, not legal advice; your lawyer can confirm for your templates.

---

## Files (when approved)
- Migration: `contracts.is_company`, `contract_parties.offer_trial`, signature evidence columns (`consent_at`, `ip_hash`, `user_agent`, `drawn_svg`), `lifetime_grants` table. Adds columns only; no existing data changed.
- `src/routes/admin.tsx` (new tab), new `src/components/admin/CompanyContracts.tsx`
- `src/lib/contract-blueprints.ts` (company list; release moved), `src/lib/contracts.ts`, `src/lib/contract-pdf.ts` (certificate page)
- `src/routes/contract.$partyId.tsx` (consent, optional drawing), `src/lib/collab-trial.functions.ts` (offer_trial)
- Split sheet signing: same consent + evidence

## Founder answers (2026-10-19)
1. Ad-content winners get lifetime **Catalog & Collaborate**.
2. Drawn signature is **optional**.
3. Add blueprints: **Independent Contractor Agreement**, **Beta Tester Agreement**: testers receive lifetime access (tier to confirm; suggested Catalog & Collaborate, same as ad-content winners).
   Proposed terms: test and report bugs/feedback during the beta; keep unreleased features confidential; CTA may use feedback freely (no ownership or payment claims); lifetime access granted when the beta period is completed (or a set number of feedback reports); "lifetime" defined as in §2; may end for Terms violations; either side can leave the beta anytime (access granted only if completed).

---

## 4. Launch legal set (added 2026-10-19)

### Pre-launch confidentiality (applies to everything below)
The whole site stays private until launch: no features may be discussed publicly. So every pre-launch agreement
(beta testers, testimonial givers, ad-content artists, contractors, brand partners) includes a **confidentiality clause**:
no posting, screenshots, recordings or descriptions of the app or its features until CTA announces launch (or written OK).
Testimonials and ad content gathered before launch are **held, not published,** until launch day. The site gate (/unlock) stays on.

### Templates for the admin Contracts area
| Template | Purpose |
| --- | --- |
| Founder IP Assignment | Founder assigns code, logo, brand, badge art and content to Came Through Audio, LLC |
| IP Assignment / License (creators) | Anyone who made the logo, badge artwork or site parts assigns or licenses it to the LLC |
| Photo, Video & Testimonial Release | Also sent retroactively to people already on the homepage |
| Expert Registration Service Agreement + Letter of Direction | Scope of the paid registration help, plus the customer's authorization for CTA to register on their behalf |
| Staff Confidentiality & Invention Assignment | Every hire; staff see splits, IPI numbers and contracts |
| Referral / Ambassador Agreement | If people are paid for signups |
| Sponsored Badge Agreement | Brands that sponsor badges (may extend Brand Partnership) |
| Campaign Official Rules | Public rules page for the ad-content campaign (at launch) |

### Site pages / settings
- **Copyright (DMCA) policy** page + register a DMCA agent with the US Copyright Office (~$6).
- **E-signature consent** disclosure (see §3).
- **Merge the two terms pages** (`terms-and-conditions`, `terms-of-service`) into one; redirect the other.
- Accept vendor **DPAs** (Supabase, Resend, Paddle) in their dashboards.

### Not agreements, but launch-critical
- Trademark filing for "Came Through Audio" (and possibly the tagline). LLC operating agreement if not done.
- Have a lawyer review: Terms, Privacy, DMCA, Expert Registration Service Agreement, Founder IP Assignment, Ad Content Agreement.
