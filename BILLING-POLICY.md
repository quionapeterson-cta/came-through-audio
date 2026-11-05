# Billing & Refunds Policy

**Effective:** November 5, 2026 · **Owner:** Founder · **Day-to-day owner:** Head of Finance, then the Billing
department lead. Until those seats are filled, the founder does it.

This is the policy staff are trained on. It is written to be read once and used at the desk. If the app and this
document disagree, the app is wrong: tell the founder so both get fixed together.

---

## 1. The rule that matters most

**Nobody needs a Stripe login to do billing.** Every refund and every plan cancellation happens in
**Admin → Billing**. That keeps one history, one log, and no one holding a key that can move money.

The console can refund up to what the member actually paid, with **no fixed ceiling**. It cannot refund more than was
paid, cannot send money anywhere but the original card, and cannot touch bank details or payouts. That is by design.

---

## 2. What we sell, and the most one payment can be

| What | Price | Notes |
|---|---|---|
| Catalog Plus | $24.99 / year | Unlimited catalog |
| Catalog & Collaborate | $44.99 / year | |
| Catalog Management | $89.99 / year | Includes one branding kit |
| Artist seat (Plus / Collaborate / Management) | $18.99 / $34.99 / $69.99 per artist per year | Up to **10 seats** in one purchase |
| Personal branding kit | $13.99 / year | One kit, one year |
| Generated contract | $3.99 each | Included with Catalog Management |
| Vault (pause) fee | $1.99 per month | Up to 3 months, so $5.97 |
| Expert Registration setup | $14.99 (single/EP, up to 6 songs) · $29.99 (album, up to 20 songs) | |
| Expert Registration, per song | $4.99 per song, per agency | Agencies: ASCAP **or** BMI, The MLC, SoundExchange |
| AI Protection | $2.99/song (up to 3) · EP $9.99 · Album $16.99 · Album+ $24.99 | One-time, per release |

So the realistic ceiling for a single payment:

- **A plan:** $89.99 for one year. There is no multi-year checkout: every payment buys one year.
- **Seats:** 10 × $69.99 = **$699.90** in one order.
- **Expert Registration:** the largest and effectively uncapped one, because it is per song per agency: 20 songs × 3
  agencies = $299.40 plus a $29.99 setup. Bigger albums cost more. **This is why there is no fixed refund ceiling** —
  a cap would block exactly the refunds that matter most.

### Prepaying more than a year

- **Catalog Management:** one year per payment today. Early renewal ("Renew now") only reaches a renewal that is inside
  a year, so at most two years of coverage can exist.
- **Company cap: 5 years of paid time**, renewals included. The app enforces it (`MAX_PREPAID_YEARS`), so no order can
  ever stack past that. If a five-year Management prepay is ever offered it is 5 × $89.99 = **$449.95**, and it is
  refundable on the same terms as any other payment.

---

## 3. Refund rules

| Situation | What we do |
|---|---|
| **Within 30 days of payment** | Full refund on request. No interrogation. Billing staff can do it alone. |
| **Day 31 or later** | Still allowed, and usually right: **a chargeback costs us more than a refund** (fee, the money, the time, and a mark on the account). A written note is required, and it is a judgement call by Billing, not a rule. |
| **Already used part of what they bought** | Partial refund is fine. Refund what is fair, not necessarily everything. |
| **Already refunded in full** | Nothing more to refund. The payment is closed. |
| **Duplicate charge** | Refund one of them, note "duplicate". |
| **Service work already started** (Expert Registration) | Our published terms: refundable for 30 days **until our team starts work**. After work starts, escalate to the Head of Finance; never refuse flatly and never argue. |
| **A plan upgrade** | Upgrades are prorated by Stripe. Refund the difference only if something actually went wrong. |

Rules that never bend:

- **Never refund more than was paid**, in total, including earlier partial refunds. The console enforces this.
- **Refunds go back to the original card only.** Never to a different card, bank account, wallet or "friend's" details.
- **One refund per payment event** — the console will not double-refund, and neither should we.
- **Cancelling a plan is not a refund.** It stops the *next* charge. The member keeps the time they paid for.

---

## 4. What actually causes a dispute (chargeback)

A dispute is the cardholder's bank pulling the money back. It is not a complaint; it is a formal claim, and we get a
fee whether we win or lose.

The usual triggers, in order of how often they happen:

1. **A charge they don't recognise.** Our descriptor on their statement doesn't match "Came Through Audio", or a family
   member used the card.
2. **They forgot to cancel** and were charged for another year. The single most common cause, and the most avoidable.
3. **They tried to cancel and it didn't take** — a cancellation that never reached Stripe, or a pause they thought was a
   cancellation.
4. **They expected something different** — thought a plan included a service, or thought a purchase was a subscription.
5. **Duplicate charge** — a double click, a retry, two cards.
6. **Genuine fraud** — someone else used the card.

What to do about it:

- **Refund before it becomes a dispute** when the amount is small relative to the cost of fighting it. A $24.99 refund
  is always cheaper than a chargeback.
- **When a dispute does arrive**, it is handled by the Head of Finance: refund it if it's small, contest it only when
  there is clear evidence (usage records, signed terms, delivery dates). Never contest out of principle.
- **Never contact the customer about a dispute in a way that pressures them.** State the facts, offer the refund, keep
  the tone the brand uses.

---

## 5. Who decides

| Amount / situation | Who |
|---|---|
| Inside 30 days, any amount up to what was paid | Any Billing or Finance staff member |
| Past 30 days | Billing or Finance staff member **with a note**; tell the Head of Finance the same day |
| Above $500 or any refund for Expert work already started | Head of Finance |
| Policy exception, goodwill beyond the above, or a contested dispute | Founder |

The founder is the person today. When the seats are filled, the Head of Finance takes the middle rows and the founder
keeps only the last one.

---

## 6. Training: how to handle a refund request

Ten minutes, then you can do it.

1. **Open Admin → Billing.** It is in the admin sidebar for the Billing and Finance departments only.
2. **Ask for the email they paid with**, and type it into "Member's email". Press **Find member**.
3. **Check what they own.** The top card lists their plans (with the renewal date) and every one-time purchase with its
   date. Confirm the purchase they are asking about is there, and that it is not already marked *Refunded*.
4. **Press Refund…** on the right purchase, or **Refund last charge…** on the plan. The console shows what they paid and
   what has already come back, and fills in the full remaining amount.
5. **Change the amount only if it should be partial.** Dollars and cents, e.g. `24.99`.
6. **Pick the reason.** "Asked for it (refund policy)", "Duplicate charge" or "Fraudulent".
7. **Write the note** — one line in plain words: "asked on day 40, forgot to cancel". It is required past 30 days, and
   it is what we would need if this ever became a dispute.
8. **Press Refund $X.** The card is refunded immediately. You will see a confirmation and the row updates.
9. **Check the log** at the bottom of the page: your email, the amount and the note should be the newest line.
10. **Reply to the member** using the wording in section 7, and tell them it can take 5–10 business days to appear on
    their statement (that is the bank's timing, not ours).

If something goes wrong — an error, an amount that looks wrong, a payment that isn't listed — **do not** open Stripe and
do not try a second refund. Copy the message and send it to the Head of Finance.

### Cancelling a plan instead of refunding

1. Find the member the same way.
2. Under **Plans**, press **Stop at renewal**.
3. Tell them the date their access ends, and that they keep everything until then.
4. If they change their mind before that date, **Keep it renewing** puts it back.

---

## 7. Reply templates

**Refund approved**

> Hi [name] — I've refunded [amount] for [item] today. Your bank usually takes 5–10 business days to show it. Nothing
> else is needed from you. Thanks for being with us.

**Refund outside the 30-day window**

> Hi [name] — no problem, I've refunded [amount] today even though it's past the 30-day window. It should appear within
> 5–10 business days. If you'd like to stay, I can help you pick the right plan.

**Cancellation**

> Hi [name] — I've set your plan to end on [date]. You keep full access until then, and your catalog stays readable
> after that. If you change your mind before [date], just reply and I'll turn the renewal back on.

**Dispute**

> Hi [name] — I can see the charge you're asking about. I've refunded [amount] today. If your bank has already opened a
> dispute, it will close on its own once the refund lands; you don't need to do anything else.

---

## 8. Never do these

- Never ask for a card number, CVV, or bank details. The console needs none of them.
- Never refund to a different card, account or person than the one who paid.
- Never touch bank details, payout schedules or payouts: that is the founder's, in the dashboard, and outside this policy.
- Never log into the Stripe dashboard to "fix" a refund. If the console can't do it, escalate.
- Never delete or edit a line in the billing log. It is the record.
- Never promise an exception you cannot approve. Say "let me check with Finance and come back today".

---

## 9. Why the log exists

Every attempt — successful, refused, or failed at Stripe — is written to `billing_actions` with the staff member's
email, the amount, the reason and the note. It is the audit trail that replaces Stripe's dashboard history, it is what
we show if a dispute is ever contested, and it is how the founder can see billing is being handled well without asking.
