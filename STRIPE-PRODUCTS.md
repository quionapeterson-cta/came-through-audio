# Stripe products, names and descriptions

**Effective:** November 5, 2026 · **Owner:** Founder · **Reference:** Admin → Price List shows the same prices

This is the list to copy into Stripe (Products → Add product). Each **price's lookup key must match the `lookup key`
column exactly** — the app buys by lookup key, so a renamed key breaks checkout even if the price is right. The
**product name** and **description** are what a member sees on checkout, on the invoice and on the receipt, so they are
written for the customer, not for us.

---

## 1. Plans (yearly subscriptions)

| Lookup key | Product name | Price | Description |
|---|---|---|---|
| `catalog_plus_yearly` | Catalog Plus | $24.99 / year | Yearly plan: unlimited catalog, MP3 embedding, split sheets, PDF catalog and lyric downloads, and master MP3 retrieval. |
| `catalog_collaborate_yearly` | Catalog & Collaborate | $44.99 / year | Yearly plan: everything in Catalog Plus, plus split-sheet e-signatures, 1-Click Agency Exports, the Royalty Utility Suite, and registration assistance. |
| `catalog_management_yearly` | Catalog Management | $89.99 / year | Yearly plan: everything in Catalog & Collaborate, plus WAV embedding, contracts with e-signing, 75+ blueprints, the Signed Contract Vault, and one Personal Branding kit. |

## 2. Add-on artist seats (yearly subscriptions, one per added artist)

| Lookup key | Product name | Price | Description |
|---|---|---|---|
| `artist_seat_plus_yearly` | Artist seat · Catalog Plus | $18.99 / year | One added artist on the owner's account for a year at Catalog Plus, with their own login and catalog. |
| `artist_seat_collaborate_yearly` | Artist seat · Catalog & Collaborate | $34.99 / year | One added artist on the owner's account for a year at Catalog & Collaborate, with their own login and catalog. |
| `artist_seat_management_yearly` | Artist seat · Catalog Management | $69.99 / year | One added artist on the owner's account for a year at Catalog Management, with their own login and catalog. |

## 3. AI Protection (one-time, per release)

| Lookup key | Product name | Price | Description |
|---|---|---|---|
| `ai_protection_single` | AI Protection · Single | $2.99 / song | AI training-protection certificate for one song, up to 3 songs in one purchase. |
| `ai_protection_ep` | AI Protection · EP | $9.99 | AI training-protection certificate for a release of up to 6 songs. |
| `ai_protection_album` | AI Protection · Album | $16.99 | AI training-protection certificate for a release of up to 12 songs. |
| `ai_protection_plus` | AI Protection · Album+ | $24.99 | AI training-protection certificate for a release of up to 20 songs. |

## 4. Expert Registration (one-time; our team does the work)

| Lookup key | Product name | Price | Description |
|---|---|---|---|
| `expert_setup_single` | Expert Registration · Single or EP setup | $14.99 | Setup for our team to register up to 6 songs with ASCAP or BMI, The MLC and SoundExchange. |
| `expert_setup_album` | Expert Registration · Album setup | $29.99 | Setup for our team to register up to 20 songs; each further block of 20 is another setup. |
| `expert_per_song_agency` | Expert Registration · per song, per agency | $4.99 | One song registered with one agency: ASCAP or BMI, The MLC, or SoundExchange. |

## 5. Add-ons (one-time, except branding)

| Lookup key | Product name | Price | Description |
|---|---|---|---|
| `branding_yearly` | Personal Branding kit | $13.99 / year | One branding kit for a year: your logo, colors, business name and tagline on split sheets, lyric sheets, contracts and catalog downloads. |
| `contract_generator` | Generated contract | $3.99 | One generated contract from a blueprint, yours to fill in, sign and download. |
| `vault_month` | Pause · Vault fee | $1.99 / month | Keeps the catalog and Vault files in place while a plan is paused. One to three months, paid up front. |

**Renew now** has no product of its own: it charges the member's existing plan price, one year early.

---

## 6. The card statement descriptor

What a member sees on their card statement (and what they search for when they don't recognise a charge):

| Where | Value | Why |
|---|---|---|
| Statement descriptor (full) | `CAME THROUGH AUDIO` | 18 characters, inside Stripe's 5–22 limit, and it is the business name. |
| Shortened descriptor (card prefix) | `CAMETHROU` | Cards only keep 10 characters. Set this or Stripe prints **`CAME THROU`**. |

Set both in **Dashboard → Settings → Business → Public details** (Stripe calls the prefix the "shortened descriptor").

Rules that matter here:

- Stripe allows 5–22 Latin characters, at least one letter, and none of `< > \ ' " *`.
- The value must reflect the **DBA, URL or legal entity name**. `CAMETHROU` is an exact substring of "Came Through
  Audio", so it is the same name shortened — not a second DBA. Something like `CTA BILLING` or `MUSIC SOFTWARE` would
  be a description of the service, which Stripe rejects and banks treat as a mystery charge.
- Don't add a dynamic suffix. The product name already appears on the invoice and receipt, and the 22 characters are
  better spent on the name being recognisable.
- The values are in code (`STATEMENT_DESCRIPTOR`, `STATEMENT_DESCRIPTOR_PREFIX` in `src/lib/plans.ts`) and shown in
  Admin → Price List, so staff can quote them without opening Stripe.

## 7. Where each name shows up

- **Checkout:** product name and description.
- **Invoice and receipt:** product name as the line item, price, and the renewal date on subscriptions.
- **Card statement:** only the descriptor — never the product name. This is why the descriptor has to carry the brand.
- **Customer portal:** product name, renewal date, invoice history.

## 8. When a member says "I don't recognise this charge"

1. Search Admin → Billing by the email on the account, then by the email they wrote from.
2. Match the **amount and date** to a purchase or the plan's last charge.
3. Say what it was for, in the words above (for example "Catalog Management, your yearly plan, renewed on June 3").
4. If it isn't theirs — someone else used the card — refund it as **fraudulent** and cancel the plan, then tell them to
   ask their bank for a new card.
