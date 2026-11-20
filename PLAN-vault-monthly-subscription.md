# PLAN — The Vault fee becomes a monthly subscription

**Status:** approved and implemented 2026-11-20 (decisions in §9). No Stripe price has been touched yet: the live
`vault_month` price still has to be replaced (see §8 step 4).
**Founder decision:** 2026-11-20 — the pause fee is **$1.99 a month, billed monthly while the pause runs, and it stops
by itself when the pause ends** (and when the member resumes). This replaces the 2026-10-21 decision that it was paid up
front as a one-time charge.
**Supersedes:** `PLAN-catalog-emptying.md` §10, §17.5 (the "paid up front" rule) and the `vault_month` row's type in
`STRIPE-PRODUCTS.md` / `PLAN-stripe-setup-guide.md`.

---

## 1. The decision in one paragraph

The pause still costs **$1.99 per month of pause** and is still limited to **1–3 months, once every 12 months**. What
changes is how the money moves: instead of one charge for the whole pause, Stripe holds a **recurring monthly $1.99
price** and bills it **once per month of the pause**, with the subscription set to **cancel at the exact moment the pause
ends**. Resuming early cancels it too, so no month after the one in progress is ever charged. The member is never billed
past the pause, and there is no annual or lump sum anywhere.

This is why the live-price audit failed: it requires the type the code charges with, and the code charges a one-time
price today. The audit is right; the product is changing.

## 2. What the member sees (money)

| When they buy a pause | First charge | Then | Last charge | Total for 3 months |
|---|---|---|---|---|
| Pause starts now (failed renewal, or a plan already ended) | at checkout, $1.99 | 1st of each month of the pause | the third month | $5.97 over 3 months |
| Pause starts at the next renewal (plan running, renewal ≥ 48h away) | on the renewal date the pause starts | same, monthly | the last month | $5.97 over 3 months |
| Resume before the pause starts | **nothing** — the subscription never bills | — | — | $0.00 |
| Resume during the pause | already charged for this month | nothing more | — | 1 × $1.99 |
| Pause runs its full length | as above | … | Stripe cancels it at the end date | 1–3 × $1.99 |

The count of charges always equals the number of months chosen. That is the rule the implementation must protect, and
it gets its own pure function and test.

## 3. Why not just "recurring" the whole idea

Two cheaper options were rejected:

- **Keep it one-time and hide the audit row.** It would pass 16/16 and still be wrong, because the founder wants the
  monthly model.
- **Change the existing price from one-time to recurring in place.** Stripe cannot change a price's type; a new price
  must be created and the lookup key moved. Nothing else about the key changes.

## 4. Architecture

Three objects, and only one of them is new:

1. **The plan's own subscription** (`subscriptions` table). Unchanged. While paused, its `trial_end` is pushed to the
   pause end, exactly as today (`startPause` / `resume` in `src/lib/retention.server.ts`). That is what stops the plan
   charge.
2. **The Vault subscription** (new, Stripe only). A recurring monthly $1.99 subscription with
   `metadata.kind = "vault"`, `metadata.userId`, `metadata.months`, `metadata.pauseStarts`, `metadata.pauseEnds`.
   It never appears in `subscriptions` (it is not a plan, not a seat, not a kit).
3. **The pause row** (`account_pauses`). Still the app's record of the pause; it gains the Vault subscription id so a
   retried webhook can never start a second pause or bill twice.

### Lifecycle

```
Buy (checkout, kind "vault")
  ├─ plan running, renewal ≥48h away → Stripe trial until pauseStarts  (no charge today)
  └─ otherwise                        → first invoice at creation      ($1.99 today)
  └─ webhook checkout.session.completed:
        set subscription.cancel_at = pauseEnds
        insert account_pauses row (kind pause, months, starts, ends, vault_subscription_id UNIQUE)
  monthly: invoice.paid → purchases row for that month (key vault:<invoice id>, payment_intent, period_end)
  pauseEnds: Stripe cancels the subscription itself → subscription.deleted → pause row closed
Resume now (early):
        subscriptions.cancel(vault sub) → nothing after this month
        plan trial_end reset (today's behavior unchanged) → plan resumes; pause row ended_at
```

**One live pause per account.** Checkout refuses a second one before Stripe is called — from the pause row and from a live
Vault subscription found by our own metadata — and the session is created with a Stripe idempotency key, so a double
click or a retried request returns one session instead of two. If two checkouts still land, `startVaultPause` cancels the
second subscription (logging it for a refund if it charged), and the database's `account_pauses_one_live` index is the
final arbiter. Resume is unaffected.

**`cancel_at` is set at the pause end and is the guarantee**, not a cron job. Stripe enforces it even if our worker is
down. The daily cron (`/api/public/cron/catalog-lapses`) gets a reconciliation pass anyway: any pause row past its
`ends_at` whose Vault subscription is still live is cancelled and logged.

### Why `trial_end`, and the 48-hour edge

Stripe will not defer a trial by less than 48 hours. So:

- renewal is **≥ 48h away** → trial until the renewal date, pause starts there, first charge there;
- renewal is **< 48h away** (or the plan is `past_due`, or there is no plan) → the pause starts now and the first charge
  is now. The pause can begin up to two days "early"; it never ends before its date, and the member is never charged more
  than the months chosen.

`pauseSpan()` in `src/lib/retention.ts` stays the single rule for where a pause sits; the checkout passes its result
into Stripe metadata so the webhook and the subscription agree on the dates.

## 5. Data model

One additive migration (`supabase/migrations/20261120090000_vault-subscription.sql`):

```sql
alter table public.account_pauses
  add column if not exists vault_subscription_id text;

-- One pause per Vault subscription: a retried webhook cannot start a second one.
create unique index if not exists account_pauses_vault_sub
  on public.account_pauses (vault_subscription_id)
  where vault_subscription_id is not null;
```

- A second unique index, `account_pauses_one_live` on `(user_id, environment) where kind = 'pause' and ended_at is null`,
is the backstop for the double-click and two-tab race: one account can never hold two live pauses, however the two
  checkouts arrived. (Checked before adding: no account held two live pauses.)
- `purchase_id` stays, nullable, for the pause rows written before this change (their one-time purchases still exist).
- `Pause` type gains `vault_subscription_id?: string | null`; `loadState` selects it.
- Each **paid month** is a `purchases` row (`kind: "vault"`) keyed `vault:<invoice id>`, with
  `details.payment_intent` and `details.period_end`. The Billing Console already refunds any purchase that carries
  `payment_intent` (`paymentFor` in `billing.functions.ts`), so per-month refunds work without a new refund path. The
  `vault:` prefix keeps `markRefunded` from mistaking a Vault month for a branding kit (which is keyed `sub:` and whose
  refund cancels its subscription).

## 6. Code changes, file by file

### Domain rules (pure, tested)

- **`src/lib/vault-subscription.ts` (new)** — mirrors `branding-subscription.ts`:
  - `vaultChargePlan({ starts, ends, months })` → the charge dates and the expected count (equal to `months`);
  - `isVaultSubscription(sub, key)` (metadata kind `vault`, or the lookup key);
  - `vaultMonthRow({ invoice, period, paid })` → the `purchases` row, or null when nothing was paid;
  - `vaultMonthActive(details)` → false once `refunded_at` is set.
- **`src/lib/retention.ts`** — `VAULT_LOOKUP_KEY` stays `vault_month`; `VAULT_PRICE` stays 1.99. Add
  `VAULT_INTERVAL = "month"` so nothing repeats the string. `pauseSpan` unchanged.
- **`src/lib/price-list.ts`** — `BillingType` becomes `"recurring-yearly" | "recurring-monthly" | "one-time"` (or keeps
  `billing` and adds `interval`). The Vault row moves out of "One-time add-ons" into "Add-ons" with
  `recurring-monthly`; the group notes change accordingly.
- **`src/lib/price-audit.ts`** — a recurring row must match its **interval** (`month` for the Vault, `year` for plans,
  seats and the kit), not just `type === "recurring"`. `describeType` gains "a recurring monthly price".
- **`src/lib/price-check.ts`** — amount unchanged (199). No type logic lives here.

### Checkout

- **`src/lib/stripe-mapping.ts`** — `kind: "vault"` becomes
  `{ mode: "subscription", items: [{ lookupKey: "vault_month", quantity: 1 }], metadata: { userId, kind: "vault", months, pauseStarts, pauseEnds }, managed: true }`.
  `months` still selects the length; it is no longer a quantity. `checkoutInput` keeps `months: 1–3`.
- **`src/lib/payments.functions.ts`** — the existing `canPause` guard stays. For `vault`, compute `pauseSpan` once from
  the loaded state and put both dates in the metadata; add
  `subscription_data.trial_end` only when the pause start is ≥ 48h away. The "switch plan" branch already excludes
  non-plan subscriptions by `data.kind`, so a pause can never replace a plan.

### Webhook

- **`src/routes/api/public/payments/webhook.ts`**
  - `saveSubscription` gains a Vault branch **before** the plan branch (`isVaultSubscription`): it must never write a
    `subscriptions` row or fire the "your plan ends" email. Today a Vault subscription would fall through to
    `subscriptionRow`, return null and only log a warning — but `cancelNotice` would email the member "your plan ends on
    …" when Stripe cancels the Vault subscription at the pause end. That must be excluded explicitly.
  - `checkoutCompleted`: for a Vault subscription, read `pauseStarts`/`pauseEnds`/`months` from metadata, set
    `cancel_at` (unix) on the subscription, and write the pause row through `startVaultPause` (idempotent on the
    subscription id). A failure returns 500 so Stripe retries, as today.
  - `invoice.paid` for a Vault subscription: one `purchases` row per paid month (`amount_paid > 0` only; a $0 trial
    invoice writes nothing). Never touches the plan.
  - `invoice.payment_failed` for a Vault subscription: Stripe retries first; the attempt with no retry left ends the
    pause and moves the account to Free (§9 decision 2).
  - `charge.refunded`: a Vault month is marked refunded; the pause itself is left running (see §9 decision 1).

### Pause lifecycle

- **`src/lib/retention.server.ts`**
  - `startPause` → `startVaultPause(db, { user_id, details, subscriptionId }, env)`: computes `months` from the customer
    (1–3 clamp kept), reads `pauseStarts`/`pauseEnds` from metadata (falls back to `pauseSpan`), inserts the row with
    `vault_subscription_id`, keeps the "outside the rules, start it anyway (paid)" log, and keeps the unique-key retry
    safety.
  - `resume`: also cancels the Vault subscription immediately (`subscriptions.cancel`), then the existing plan
    `trial_end` reset. If the pause never started (still trialing) nothing was charged.
  - `runCatalogLapses` (the daily cron's `Promise.allSettled` list) gains `runVaultEndings`: closes pause rows whose
    `ends_at` has passed and cancels any Vault subscription still live; also logs a pause whose `cancel_at` is missing.
- **`src/lib/retention.functions.ts`** — unchanged surface (`resumeNow`), the behavior above sits behind it.

### Copy and promises

- **`src/components/RetentionControls.tsx`**
  - Pause dialog: tiles show "$1.99 / month" with the months' subtotal; the footer stops saying "paid up front":
    *"Vault fee: $1.99 a month while you're paused, charged monthly and stopped automatically when the pause ends. The
    month in progress isn't refunded if you resume early. Pause can be used once every 12 months."*
  - Button: "Start the pause · $1.99 today" when it starts now, "Start the pause · first charge <date>" when it starts
    at renewal.
  - Resume confirmation: *"…stops the next month's Vault charge. The month in progress isn't refunded."*
- **`src/lib/purchase-receipt.ts`** — the `vault` receipt carries the schedule instead of only an amount:
  *"Your pause starts on <date>. We charge $1.99 a month while it runs and it stops on its own on <end date> — nothing
  is charged after that. It is not a cancellation: your plan renews by itself when the pause ends. Resume any time from
  Profile; that ends the pause, not the plan, and stops the next month's charge."* A trial start must not say "We
  charged $0.00".
- **`src/lib/faq.ts`** (Plans & billing) — *"…Pause gives you 1 to 3 months for $1.99 a month: it is charged monthly
  while you're paused and stops by itself on the date the pause ends, so you're never charged past it. No plan charge
  is made while you're paused, your catalog stays read-only and is not emptied, and your plan renews by itself when the
  pause ends. Pausing is never cancelling: cancel the plan itself if you mean to stop. Ending a pause early stops the
  next month's charge; the month you're in isn't refunded."*
- **`src/lib/legal-docs.tsx` §18 (Terms)** — *"…you may pause for 1 to 3 months for a Vault fee of $1.99 per month,
  billed monthly while the pause runs and stopping automatically on the date the pause ends. No later month is charged;
  the month in progress is not refunded if you end the pause early. While paused your catalog is read-only and is not
  emptied. Pausing is not cancelling: your plan renews by itself when the pause ends."*
- **`BILLING-POLICY.md`** — §2 table row: *"$1.99 per month while paused · 1–3 months, billed monthly, stops by itself
  (at most $5.97 over a three-month pause)"*; §3.2 rewritten to monthly billing, with: if the pause never started,
  cancel it and nothing was charged; if it has started, the month in progress stays unless the pause was misdescribed
  or the Head of Finance says otherwise. (The "thought pause cancelled" prorated plan refund is untouched.)
- **`src/lib/help-search.ts`**, **`src/lib/support-scripts.ts`** (`billing-pause-is-not-cancel`), and
  **`src/lib/retention-email.server.ts`** (`paused` email) — same facts, in their own voice: billed monthly, stops
  itself at the end, resuming stops the next charge, the month in progress isn't refunded.
- **`STRIPE-PRODUCTS.md`** §5 and **`PLAN-stripe-setup-guide.md`** — `vault_month` becomes
  `$1.99 / month (recurring, cancelled at the end of the pause)`; §5's "one is a yearly subscription, two are one-time"
  note is rewritten. **`PLAN-catalog-emptying.md`** gets a one-line amendment marking §10 superseded.

### Admin surfaces

- **`src/components/LivePriceAudit.tsx`** — the "Must be" column reads "Monthly subscription" for the Vault row; the
  intro sentence says yearly or monthly as the row requires.
- **`src/lib/price-list.ts`** `stripeLookupKeyText()` — its legend gains "monthly subscription".
- **`src/components/PriceList.tsx`** — no change beyond what the row data now says.

## 7. Tests

- **`src/lib/vault-subscription.test.ts` (new)** — the rules that matter:
  - a 1/2/3-month pause produces exactly 1/2/3 charge dates, none after `ends`;
  - a pause starting at renewal charges from the renewal date, not from the purchase;
  - a $0 (trial) invoice writes no purchase row;
  - a refunded month is closed and cannot be reopened by a late invoice or a cancellation event;
  - `isVaultSubscription` is true by metadata and by lookup key.
- **`src/lib/retention.test.ts`** — the "vault checkout" test becomes `mode: "subscription"`, one item, `quantity: 1`,
  metadata carrying months and both dates; `months: 4` still refused.
- **`src/lib/price-audit.test.ts`** — `healthy()` sets each row's interval; a new case: a monthly price held as yearly
  fails, and the Vault row passes as `recurring` + `month`.
- **`src/lib/price-check.test.ts`** — unchanged ($1.99 is still 199).
- **`src/lib/purchase-receipt.test.ts`** — the "not a cancellation" assertion stays; add the schedule line and the
  "no charge on a trial start" case.
- **`src/lib/billing-console.test.ts`** (if it covers `purchaseKindLabel`) — "Vault pause" unchanged.

No test asserts the old one-time type except the one being rewritten; nothing is skipped or weakened.

## 8. Rollout order

1. Migration (additive, safe to run first). **Applied 2026-11-20.** The ledger records it under version
   `20261120212013` (Lovable assigns its own timestamp rather than the filename's), so a future push that compares
   filenames will think `20261120090000` is still pending: every statement is `if not exists`, so re-running it is safe.
   The same mismatch already exists across older files — see the drift note in the hand-over.
2. Code + tests, `npm test` and a typecheck/build.
3. **Sandbox, end to end** (Stripe test clock): buy a pause that starts at renewal (no charge today), let the clock reach
   the renewal (1 charge), resume before the start (0 charges), resume mid-pause (1 charge, no more), a 3-month pause
   (3 charges then self-cancel), and a failed month (see decision 2). Confirm `account_pauses`, the `purchases` rows and
   the emails at each step.
4. **Live Stripe**: create the new $1.99 **monthly recurring** price, archive the old `vault_month` price, move the
   lookup key to the new price (Stripe allows a key on one active price at a time, so archive first).
5. Admin → Price List → Check again: **16 of 16**.

## 9. Decisions (settled 2026-11-20)

1. **Refunding a month already charged** — a refund of the newest Vault month also cancels the Vault subscription, so no
   later month is charged, while the pause keeps running to its end. The monthly rule stays "not refundable once the
   month starts", with staff judgement as today.
2. **A monthly Vault charge that fails** — Stripe retries as usual; when it finally can't collect, the pause ends and the
   account moves to the **Free plan** (never a free pause, and the plan itself doesn't renew), with one email saying so.
   The trigger is an invoice with no `next_payment_attempt` left, or a subscription Stripe reports as `unpaid`/`canceled`.
3. **An ended pause's row** — kept, with `ended_at` set when Stripe cancels the Vault subscription at the pause end, the
   same as an early resume. "Once every 12 months" counts it, and the history stays readable.
4. **The lookup key's name** — `vault_month` stays. There is no sign of a `vault_monthly` key anywhere in the repo or in
   Stripe's own docs here, and one constant is safer than a rename.
5. **Downloads while paused** — the pause keeps them: masters, artwork and PDFs stay downloadable, because the catalog is
   read-only, not taken away. On the Free plan there is no downloading (founder, 2026-11-20); see §10.

## 10. The Free-plan download rule waits on its own decision

"On a pause they can still download their music, videos and pdfs; on Free there is no downloading" is the pause side of
the founder's rule, and the pause side is implemented and promised. The Free side is **not** in this change: today
Free is read-only with downloads, and that is what the Terms (§6, §17), the FAQ, the support answers, the two-year
inactivity notices and the staff-offboarding mail all promise. Making Free download-less reverses those, needs the gate
to live where it cannot be bypassed (storage policies, not a button), and would mean a member with no plan cannot take
their own masters before the two-year deletion. That is its own confirmed decision, not a side effect of the Vault fee.

## 11. What does not change

- $1.99 per month, 1–3 months, once every 12 months.
- The plan's own charge stops via `trial_end`, and the plan renews by itself at the pause end.
- "Pausing is never presented as cancelling", and the cancel dialog's Pause offer.
- The catalog stays read-only and is never emptied; `is_paused` and `user_tier` are untouched.
- No new refund path: refunds stay in Admin → Billing, idempotent, logged in `billing_actions`.
- The audit's job: a price that isn't what the code charges fails in Admin before a member finds it at Buy.
