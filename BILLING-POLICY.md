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
| **Day 31 or later, a plan** | **Prorated refund of the unused time.** Cancel on any day and refund the days they won't use (§3.1). Note required; Billing staff can do it. |
| **Day 31 or later, a purchase** | Still allowed and usually right: **a chargeback costs us more than a refund**. Note required; all or part, your judgement. |
| **Already used part of what they bought** | Partial refund is fine. Refund what is fair, not necessarily everything. |
| **Already refunded in full** | Nothing more to refund. The payment is closed. |
| **Duplicate charge** | **Verify it first (§4.3)** — a hold is not a charge. Then refund the newer one, note "duplicate". |
| **Service work already started** (Expert Registration) | Our published terms: refundable for 30 days **until our team starts work**. After work starts, escalate to the Head of Finance; never refuse flatly and never argue. |
| **A plan upgrade** | Upgrades are prorated by Stripe. Refund the difference only if something actually went wrong. |

### 3.1 Prorating a plan refund

A plan is a year. After the 30-day window, a cancellation refunds the unused part of that year:

> **refund = what they paid × (days left in the year ÷ 365)**

Example: $89.99 Catalog Management, cancelled with 120 days left → $89.99 × 120/365 = **$29.59**. The console fills that
number in for you, and it will not let a past-30-day plan refund go above it. Inside 30 days it is the full amount, and
a year already used up refunds nothing.

Proration applies to the plan itself. Purchases bought alongside it (seats, a branding kit, Expert Registration, AI
Protection, a contract) are not prorated by the console: refund all of it or part of it, your judgement, with a note.
A seat or a kit does run its own year, so a partial refund is often the fair answer there too.

### 3.2 Pausing is not cancelling

A pause stops the plan charge for one to three months (the Vault fee, $1.99 a month, paid up front) and then the plan
**renews by itself**. It does not cancel anything.

- The pause screen says so before anyone pays, Resume now says "this ends your pause, not your plan", and the renewal
  reminder email repeats it.
- **If a member says they thought pausing cancelled**, they get the **prorated refund** of the plan (§3.1) even though
  they were past 30 days. Note: "thought pause cancelled". Do not argue about it; a dispute costs more.
- If the pause never started, refund the Vault fee as well. If it has started, the fee stays (they used the pause) unless
  the Head of Finance says otherwise.

### 3.3 A forgotten renewal

The renewal charge has its **own 30-day window**. So "I forgot to cancel" inside 30 days of the renewal is a **full
refund** of that renewal, every time, no escalation. Past 30 days it is the prorated refund in §3.1 with a note. Either
way the plan is then cancelled so it can't happen again.

Rules that never bend:

- **Never refund more than was paid**, in total, including earlier partial refunds. The console enforces this.
- **Refunds go back to the original card only.** Never to a different card, bank account, wallet or "friend's" details.
- **One refund per payment event** — the console will not double-refund, and neither should we.
- **Cancelling a plan is not a refund.** It stops the *next* charge. The member keeps the time they paid for.

### 3.4 An artist takes their seat over

An add-on artist seat can be handed to its artist at any time. The artist starts their own plan at the seat's tier,
enters a card, and the first charge is the seat's renewal. Nothing is charged at the handoff.

- **What is paid is paid.** The owner is not refunded or credited for the rest of the seat's year, and the artist is not
  charged for that time either.
- **Access ends at handoff.** From the moment the artist's own plan is recorded, the owner can no longer read or edit
  that artist's catalog, split sheets or contracts. The artist's account, catalog, masters and files are unchanged.
- **Only that seat stops.** The owner's other artists on the same purchase and the owner's own plan are untouched. The
  handed-off seat keeps its record and cannot be re-invited; the owner buys a new seat to add another artist.
- **If the artist cancels during the handoff period,** the handoff still stands: nothing was charged to them, the owner's
  seat already stopped renewing, and neither side is refunded.

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

### 4.1 Making the charge recognisable

The statement says **`CAME THROUGH AUDIO`**, and on most card statements **`CAMETHROU`** (Stripe keeps only ten
characters for cards unless a shorter prefix is set). Product names and the description of every product are in
`STRIPE-PRODUCTS.md`, which is what to copy into Stripe and what to read back to a member who asks what a charge was.

When someone doesn't recognise a charge, find it and **say what it was for, with the date and amount**. A clear answer
is usually the whole fix.

### 4.2 What we do before every renewal (this is the system)

Nobody should ever be surprised by a renewal. Five things run automatically, and together they are what keeps this from
becoming a dispute:

1. **Reminder emails 90, 60, 30, 7 and 1 day before** every yearly renewal, each naming the plan, the exact date and the
   amount, with a **Cancel or change plan** link that works without replying.
2. **The same email says pausing isn't cancelling**, so nobody pauses expecting the renewal to stop.
3. **The renewal charge starts a fresh 30-day window** (§3.3): a member who forgot gets the whole renewal back if they
   ask inside 30 days.
4. **The statement descriptor carries the brand** (§4.1), so the charge is recognisable on the statement itself.
5. **Pause and Need more time** are offered before cancelling, so a member who only needs a break doesn't have to cancel
   and come back.

What staff do with that: when a member writes "I didn't mean to renew", check the date. Inside 30 days → refund it in
full and cancel the plan. Past 30 days → prorated refund, note it, and cancel the plan. Never make them argue for it.

**Duplicates** have their own check before any money moves — see §4.3. Same amount is not the same charge.

What to do about it:

- **Refund before it becomes a dispute** when the amount is small relative to the cost of fighting it. A $24.99 refund
  is always cheaper than a chargeback.
- **When a dispute does arrive**, it is handled by the Head of Finance: refund it if it's small, contest it only when
  there is clear evidence (usage records, signed terms, delivery dates). Never contest out of principle.
- **Never contact the customer about a dispute in a way that pressures them.** State the facts, offer the refund, keep
  the tone the brand uses.

### 4.3 "It charged me twice" — check before you refund

Most "you charged me twice" messages are not two charges. Four things look identical in a banking app and only one of
them is a duplicate:

| What they see | What it actually is | What we do |
|---|---|---|
| Two lines, one is a temporary hold | An **authorization** that never settled | **Nothing.** It clears by itself — usually within 7 days, always within 30. A refund fails. |
| A charge and the money back | The **refund** we already sent | Nothing is owed. |
| Two amounts for two things | Two seats, two $2.99 certificates, a purchase plus a renewal | Not a duplicate. |
| Two **settled** payments, same thing, hours apart | A real duplicate | Refund the **newer** one, reason "Duplicate charge". |

The console does that check for you: under the member, **Possible duplicate payments** lists each payment with what it
actually is, and when two settled payments match it names the one to refund. A hold is labelled with the date it
disappears by and has no refund button.

Before a "duplicate" refund goes through, four checks must be ticked. The server refuses otherwise, and it refuses a
payment that hasn't settled or is already refunded. That is not a formality: "duplicate" is the reason the bank sees, and
a wrong one pays out money for something the member kept.

- **If it is a hold:** reply with the "It looks like two charges, but one is a hold" script and give them the date. Never
  refund it, and never tell them to dispute it.
- **If nothing is wrong at all** (one payment shown twice): say so with the date and amount, and offer to check again if
  the extra line is still there after the date. A calm answer is the whole fix.

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
5. **Check the amount.** Inside 30 days it is the full payment. A plan cancelled after 30 days shows the prorated
   unused amount and will not exceed it. Only type a different figure for a one-time purchase that should be partial.
   Dollars and cents, e.g. `24.99`.
6. **Pick the reason.** "Asked for it (refund policy)", "Duplicate charge" or "Fraudulent".
7. **Write the note** — one line in plain words: "asked on day 40, forgot to cancel". It is required past 30 days, and
   it is what we would need if this ever became a dispute.
8. **Press Refund $X.** The card is refunded immediately. You will see a confirmation and the row updates.
9. **Check the log** at the bottom of the page: your email, the amount and the note should be the newest line.
10. **Reply to the member** using the wording in section 7, and tell them it can take 5–10 business days to appear on
    their statement (that is the bank's timing, not ours).
11. **If it was a renewal they forgot about**, check the renewal date first: inside 30 days it is a full refund (§3.3),
    past 30 days the prorated amount (§3.1). Then cancel the plan so it can't charge again, and tell them they were
    reminded 90, 60, 30, 7 and 1 day before, without sounding like an accusation.
12. **If they say they paused but the plan charged**, that is the pause confusion in §3.2: refund prorated, note it, and
    point them at Cancel plan for next time.
13. **Before any "duplicate" refund, read Possible duplicate payments** and check what each line is. A hold, a refund and
    two different products are not duplicates (§4.3). Tick the four checks only when all four are true.
14. **Answer from Admin → Support Scripts.** Pick the department, fill the name and amount, copy. The billing scripts cover
    refunds, holds, declines, pause confusion and artist-seat handoffs, so nobody writes the wording from scratch.
15. **If an artist seat changed hands,** use "Artist seat handed over". It says who pays now, the renewal date nothing
    was charged before, and that the owner's access and seat payment ended with the handoff. Do not offer a refund or
    credit for the part of the seat's year the owner did not use: §3.4 says it is not refunded.

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

**Refund outside the 30-day window (prorated)**

> Hi [name] — no problem. As the plan is past its 30-day window, I've refunded the unused part: [amount] for the [days]
> days left on your year. It should appear within 5–10 business days. If you'd like to stay, I can help you pick the
> right plan.

**Cancellation**

> Hi [name] — I've set your plan to end on [date]. You keep full access until then, and your catalog stays readable
> after that. If you change your mind before [date], just reply and I'll turn the renewal back on.

**They thought pausing was cancelling**

> Hi [name] — I'm sorry, that's on us for not making it clearer: pausing holds the plan for a few months and then it
> renews by itself, so it doesn't stop a charge. I've cancelled the plan so nothing else renews, and refunded the
> unused part of your year: [amount], back to the card you paid with in 5–10 business days.

**It looked like a duplicate, but one is a hold**

> Hi [name] — thanks for sending that. One of those lines is a hold, not a charge: your bank sets it aside while the
> payment finishes and it disappears by itself, normally by [date] and always within 30 days. Only one payment has left
> your account, so there's nothing to refund. If the extra line is still there after [date], reply and we'll look again.

**Duplicate confirmed**

> Hi [name] — you're right, there were two payments for [item] on [date]. Both went through and only one was owed, so
> we've refunded the newer one. It's back on your card in 5–10 business days and your access hasn't changed.

**Artist seat handed over**

> Hi [name] — [artist] is paying for their own plan now. Their first charge is at the seat's renewal on [date], and
> nothing was charged at the handoff. The seat you paid for stops renewing from that date: the time already paid for is
> not refunded or credited, and your access to their catalog, split sheets and contracts ended when the handoff
> completed. Your own plan and your other seats are unchanged.

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
