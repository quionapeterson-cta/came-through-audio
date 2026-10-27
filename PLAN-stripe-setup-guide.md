# PLAN — Stripe setup guide: your questions answered · v1

Status: **answers ready 2026-10-27 (Level 2).** Tick each box as you go.
Source: founder testing list, 2026-10-27. Checked against Stripe's own documentation the same day.

---

## 1. "There are two parts to the lookup key, key and value. What do I put in both?"

Those two boxes (**key** and **value**) are **Metadata**, not the lookup key. **Leave Metadata empty.**

The **lookup key** is one single box on the **price** (not the product):

- [ ] Open the product → click the price → **Edit price** (or set it while creating the price) → look under
      **Advanced** / **More options** for **Lookup key** → type the key from the table in §4 exactly, e.g.
      `catalog_plus_yearly` (all lowercase, underscores, no spaces).

The site finds every price by that key, so one typo means that checkout won't open.

## 2. "My products are only in a sandbox in one account. They don't show up in the real account."

That's expected: a sandbox is a practice copy, separate from the real (live) account. Stripe has a button for this:

- [ ] Finish **activating** the live account first (Stripe asks for business details, bank account, ID).
- [ ] In the sandbox, open each product → **Copy to live mode** (top right). Its prices copy with it.
- [ ] In live mode, open each copied price and check the **Lookup key** is there. If it's blank, type it in (§4).
- [ ] Copying twice makes two live products. If that happens, archive the extra one.
- [ ] Later edits in the sandbox don't change the live copy; change live products in live mode.
- [ ] In Lovable, switch the Stripe connector from test to live when you're ready to take real payments.

## 3. "Which service type should I choose for Stripe branding?"

On Stripe's business details (industry) question, choose **Software → Software as a service (SaaS)**. Most of what
Came Through Audio sells is the online platform; the people-delivered services are a smaller part. If the screen you
mean looks different, send a screenshot to the drop box and I'll point to the exact choice.

## 4. Every product, in plain words (cross-reference table)

**Type:** "Yearly" = recurring price, billed every year. "One-time" = a single payment.
**Tax code** = the Stripe product tax code to pick on the product (Stripe Tax uses it to know what rules apply).

| Product name in Stripe | Lookup key (on the price) | Price | Type | Tax code | Description customers see |
| --- | --- | --- | --- | --- | --- |
| Catalog Plus | `catalog_plus_yearly` | $24.99 | Yearly | SaaS - business use `txcd_10103001` | Your music catalog, metadata embedding and registration-ready exports, all year. |
| Catalog & Collaborate | `catalog_collaborate_yearly` | $44.99 | Yearly | SaaS - business use `txcd_10103001` | Everything in Catalog Plus, plus split sheets with collaborator e-signatures. |
| Catalog Management | `catalog_management_yearly` | $89.99 | Yearly | SaaS - business use `txcd_10103001` | The full suite: catalog, splits, contracts, Personal Branding and agency exports. |
| AI Protection · Single | `ai_protection_single` | $2.99 | One-time (quantity = songs) | SaaS - business use `txcd_10103001` | A time-stamped proof-of-creation certificate for one song. |
| AI Protection · EP | `ai_protection_ep` | $9.99 | One-time | SaaS - business use `txcd_10103001` | Proof-of-creation certificates for up to 6 songs. |
| AI Protection · Album | `ai_protection_album` | $16.99 | One-time | SaaS - business use `txcd_10103001` | Proof-of-creation certificates for up to 12 songs. |
| AI Protection · Album+ | `ai_protection_plus` | $24.99 | One-time | SaaS - business use `txcd_10103001` | Proof-of-creation certificates for up to 20 songs. |
| Expert Registration · Setup (Single/EP) | `expert_setup_single` | $14.99 | One-time | General - Services `txcd_20030000` | Our team sets up your registration order for a single or EP. |
| Expert Registration · Setup (Album) | `expert_setup_album` | $29.99 | One-time | General - Services `txcd_20030000` | Our team sets up your registration order for an album. |
| Expert Registration · Per song, per agency | `expert_per_song_agency` | $4.99 | One-time (quantity) | General - Services `txcd_20030000` | We register one song with one organization (ASCAP or BMI, The MLC, SoundExchange). |
| Personal Branding Kit | `branding_yearly` | **$13.99** | One-time, covers one year | SaaS - business use `txcd_10103001` | Your logo, colors and font on the contracts and split sheets you send, for one year. |
| Generated Contract | `contract_generator` | $3.99 | One-time | SaaS - business use `txcd_10103001` | One contract drafted from your deal details, ready to sign. |
| Catalog Vault (extra month) | `vault_month` | $1.99 | One-time (quantity = months) | SaaS - business use `txcd_10103001` | Keeps your catalog open one more month after a plan ends. |

Later (not needed for launch): artist seats `artist_seat_plus_yearly` / `_collaborate_` / `_management_`
($19.99 / $36.99 / $69.99 a year) and live time `live_time_15` / `_30` / `_60` ($15 / $25 / $45).

Branding Kit price changed to **$13.99** (your decision, 2026-10-27); the site now says $13.99 everywhere, so create
the Stripe price at $13.99.

## 5. "What sales tax code do I add for each product? GA?"

- The **tax code goes on each product** (table above), not per state. Stripe works out each state's rules itself.
- **Business use vs personal use:** your customers use the platform for their music business, so "business use"
  fits. It only matters in the US, where a few states tax the two differently.
- **Georgia:** Georgia generally doesn't tax software-as-a-service or most services, but confirm with your accountant.
- **Where you have to collect tax** depends on registrations, not on your codes. In Stripe Tax → **Registrations**,
  add **Georgia** only if your accountant says to; Stripe's **Monitoring** tab warns you when sales in another state
  get close to its threshold (often $100,000 or 200 sales a year).
- [ ] Settings → Tax: turn on Stripe Tax, origin address 789 Garden Walk Blvd, Atlanta, GA 30349.
- [ ] Set each product's tax code from the table.

## 6. "I updated my support email to billing@ but can't find where to enter the receipt email."

There isn't a separate "receipt email" box. Receipts use two settings:

- [ ] **Settings → Business → Customer emails**: under Payments, turn on **Successful payments** and **Refunds**.
      Stripe then emails a receipt to the customer after every payment and refund.
- [ ] **Settings → Business → Public details**: the **support email** (billing@camethroughaudio.com) and support phone
      printed on every receipt. That's the one you already set, so receipts will show billing@.
- [ ] Optional: **Settings → Emails → Your email domain**, to send receipts from your own domain instead of Stripe's.

## 7. "I need a free Wi-Fi customer support number that also works for two-step verification."

- **Support number:** **Google Voice** is free in the US, works over Wi-Fi in its app, and can forward to your phone.
  Put it in Stripe's Public details (§6) and on the site.
- **Two-step verification:** many services, Stripe included, may refuse internet (VoIP) numbers like Google Voice for
  text-message codes. Use an **authenticator app** (Google Authenticator or Microsoft Authenticator) or a **passkey**
  instead: Stripe → your profile → **Two-step authentication**. They need no phone number and can't be intercepted
  by text. Save the backup codes Stripe gives you somewhere safe.

## 8. Still to do in Stripe (from PLAN-stripe-switch §4)

- [ ] Customer portal (Settings → Billing → Customer portal): allow cancel at period end, update payment method,
      invoice history, and switching between the three plans with proration.
- [ ] Webhook endpoint `https://camethroughaudio.com/api/public/payments/stripe-webhook` in live mode.
- [ ] One real test purchase in live mode (then refund it), to see the receipt email arrive from billing@.
