# PLAN — Switch all payments from Paddle to Stripe · v1

Status: **built 2026-10-21 (ea1179e) on Lovable's Stripe layer: embedded checkout in a dialog (Lovable's choice, works in the preview) with Stripe Managed Payments; Lovable's stripe_* columns instead of §3 provider_* columns. Legal/help copy (§5) still to review.**

Why: Paddle never approved the domain, and its policy may not cover people-delivered services (Expert Registration
Assistance, live-agent time, Masterclasses). Stripe covers everything CTA sells and costs a little less per sale. No
real customer has paid through Paddle, so nothing needs migrating except test data.

---

## 1. What stays exactly the same
- **Paid access comes only from verified payment records** (webhook rows in `subscriptions` and `purchases`), never
  from the browser. The database functions that enforce tiers (`has_tier`, `user_tier`) keep working unchanged.
- **Human-readable price IDs** (`catalog_plus_yearly`, `ai_protection_single`…). In Stripe they become each price's
  **lookup key**, the same job Paddle's external IDs did, so `src/lib/plans.ts` doesn't change.
- Test mode vs live mode, the test-mode banner and the super-admin tier preview.
- The free 30-day Catalog & Collaborate trial for invited signers (it never touched Paddle; only its storage columns
  are renamed, §3).

## 2. What changes

| Today (Paddle) | With Stripe |
| --- | --- |
| Paddle overlay opens on the page | **Stripe Checkout**: a Stripe-hosted payment page; the customer returns to the workspace after paying. A server function creates the session, so prices and the user ID can't be changed in the browser. |
| Paddle webhook (`/api/public/payments/webhook`) | New **Stripe webhook** (`/api/public/payments/stripe-webhook`), signature-checked, writing the same rows |
| Paddle customer portal (Manage billing) | **Stripe customer portal**: cancel, change card, invoices, and switch plans |
| Paddle calculates and files sales tax | **Stripe Tax** calculates tax at checkout; your accountant files it (§6) |
| Upgrading buys a second plan | **Switching plans happens in the customer portal** with proration (pay only the difference), so nobody is billed for two plans. Checkout is used only when there's no active plan. |

### Webhook events handled
- `checkout.session.completed` → one-time buys become `purchases` rows (AI Protection, Expert Assistance, later
  live-time packs), with the same `kind` and details the Paddle version stored.
- `customer.subscription.created / updated / deleted` → `subscriptions` rows (plan, status, renewal date,
  "cancels at period end").
- `invoice.paid` → renewal dates move forward each year.
- `charge.refunded` → the purchase is marked refunded (new: Paddle refunds were handled by hand).

## 3. Database (one migration, keeps all existing rows)
- `subscriptions`: add `provider` (`'paddle'` for existing rows, `'stripe'` for new), `provider_subscription_id`,
  `provider_customer_id`; copy the Paddle values across; make the old `paddle_*` columns optional (kept for history,
  never deleted).
- `purchases`: add `provider`, `provider_transaction_id`, `refunded_at`; copy values across; old column kept.
- The collab-trial code moves from the `paddle_*` columns to the new ones.
- Optional cleanup later: delete Paddle **sandbox** test rows, only with your OK.

## 4. Stripe setup you (or Lovable) do in the Stripe dashboard
1. **Products and prices**, each with its lookup key:

   | Lookup key | What | Price | Type |
   | --- | --- | --- | --- |
   | `catalog_plus_yearly` | Catalog Plus | $24.99 / year | Subscription |
   | `catalog_collaborate_yearly` | Catalog & Collaborate | $44.99 / year | Subscription |
   | `catalog_management_yearly` | Catalog Management | $89.99 / year | Subscription |
   | `ai_protection_single` | AI Protection · Single | $2.99 | One-time |
   | `ai_protection_ep` | AI Protection · EP (up to 6) | $9.99 | One-time |
   | `ai_protection_album` | AI Protection · Album (up to 12) | $16.99 | One-time |
   | `ai_protection_plus` | AI Protection · Album+ (up to 20) | $24.99 | One-time |
   | `expert_setup_single` | Expert Assistance setup · Single | $14.99 | One-time |
   | `expert_setup_album` | Expert Assistance setup · Album | $29.99 | One-time |
   | `expert_per_song_agency` | Expert Assistance · per song per agency | $4.99 | One-time (quantity) |
   | `artist_seat_plus_yearly`, `_collaborate_`, `_management_` | Add-on artist seats | $19.99 / $36.99 / $69.99 per year | Later |
   | `live_time_15`, `_30`, `_60` | Live "How It Works" time | $15 / $25 / $45 | Later (PLAN-live-registration) |

2. **Customer portal** (Settings → Billing → Customer portal): allow cancel at period end, update payment method,
   invoice history, and switching between the three plans with proration.
3. **Stripe Tax**: turn on, set the business address (Atlanta, GA), product tax category "Software as a service" for
   plans and the matching categories for services; add registrations as your accountant advises.
4. **Webhook endpoint**: `https://camethroughaudio.com/api/public/payments/stripe-webhook`, with the events in §2.
5. **Keys:** Lovable's built-in Stripe connector holds them (Connectors tab: "no API keys to manage"), like the Paddle
   connector did. Lovable adds the server helper that talks to its gateway; the rest of the code uses that helper.

## 5. Copy and legal pages (preview before publishing)
- **Terms of Service**: remove "Paddle.com is the merchant of record"; Came Through Audio, LLC is the seller, payments
  processed by Stripe; sales tax added where required.
- **Privacy Policy** §4: "Payments and Paddle" → "Payments and Stripe" (Stripe processes card details; CTA never sees
  full card numbers).
- **Refund Policy**: refunds requested by emailing support (paddle.net link removed); same 30-day rules.
- **AGENTS.md** rule: "Paid access comes from **payment-provider** webhook rows (Stripe)…". It's a project rule, so it
  changes only with your approval.
- Help pages that mention Paddle are updated.

## 6. Tax and money (for your accountant)
- **Sell to US customers only at first** (Stripe Checkout limits billing countries). EU/UK VAT on digital services
  can apply from the first sale, so add other countries deliberately later.
- Stripe Tax shows when sales in a state pass its registration threshold (often $100,000 or 200 sales a year).
  Georgia and each state treat software subscriptions and services differently; your accountant decides where to
  register and files the returns.
- Roughly 2.9% + $0.30 per card payment, about 0.7% on subscription billing and about 0.5% for Stripe Tax (check
  current Stripe pricing).

## 7. Build order (each step leaves the app working)
1. Migration (§3) + new Stripe server helper, checkout session and portal functions. Paddle still live in the UI.
2. Stripe webhook; test-mode purchase of each price confirmed in `subscriptions` / `purchases`.
3. Switch the buttons (plans, Expert Assistance, AI Protection, Manage billing) to Stripe in one commit.
4. Legal and help copy (§5), after your review.
5. Remove the Paddle code and the Paddle script; keep the old database columns.
6. Tests: webhook mapping (subscription → tier, one-time → purchase kind, refund), lookup-key mapping, checkout input
   validation (no client-side price or user ID).

## Files
New: `src/lib/stripe.server.ts`, `src/lib/stripe.functions.ts` (checkout + portal), `src/routes/api/public/payments/stripe-webhook.ts`,
one migration, tests.
Changed: `src/lib/paddle.ts` → `src/lib/checkout.ts`, `src/hooks/useBilling.ts`, `src/lib/payments.functions.ts`,
`src/lib/collab-trial.functions.ts`, `src/lib/collab-trial.server.ts`, `src/components/AIProtectionHub.tsx`,
`src/components/ExpertAssistance.tsx`, `src/components/PaymentTestModeBanner.tsx`, `src/routes/workspace.tsx`,
`src/routes/plans.tsx`, `src/routes/profile.tsx`, `src/routes/terms-of-service.tsx`, `src/routes/privacy-policy.tsx`,
`src/routes/refund-policy.tsx`, `src/lib/docs.ts`, `AGENTS.md`.
Removed at the end: `src/lib/paddle.server.ts`, the Paddle webhook route.

## Questions
1. Stripe-hosted Checkout page (recommended: fastest, trusted, handles Apple Pay / Google Pay) or a checkout embedded
   inside the site?
2. US customers only to start?
3. Does Lovable show a built-in Stripe connection for this project, or will you add the secret keys yourself?
4. Approve the AGENTS.md rule wording change (§5)?
