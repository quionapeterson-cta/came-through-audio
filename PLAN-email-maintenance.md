# Email maintenance: clean inboxes, one automated flow

**Written 2026-11-10. Status: proposal.** The measurements below are real, taken from the connected mailbox on
2026-11-10. The policy choices are marked **undecided** and change nothing until the founder approves them. No price,
allowance or retention figure is settled by this document.

## 1. What we actually measured

The connected mailbox (`quionapeterson@gmail.com`, the address our domain mail reaches):

| Measure | Count |
|---|---|
| Messages / threads | 34,533 / 31,706 |
| INBOX | 31,752, of which 24,741 unread |
| CATEGORY_UPDATES | 28,092 |
| CATEGORY_PROMOTIONS | 894 |
| SPAM | 469 |
| DRAFTS | 167 |
| SENT | 2,844 |

**Mail from our own domain: 23 messages in total, every one since 2026-10-08.** Of those, 12 are the founder's own
smoke tests (`TEST 1 of 6` … `TEST 6 of 6`, `test`, `Testing`, `yahoo`, `Collab test`, `Inquiry`), 5 are the old Wix
site's form/event notifications, and the rest are sign-up confirmations, signing codes and split-sheet requests to the
founder's own address.

So the 15 GB is **not** being spent by the product. We send very little, and what we send is transactional. The box is
full of everything else a personal Gmail collects, and our domain mail is forwarded into it. Any plan that "deletes
unneeded outgoing email" to save space is solving the wrong problem; the maintenance work is (a) stop the sources that
should not exist, (b) keep the product mail clean and unduplicated, (c) route each mailbox to the right place.

## 2. Who we send as today (from the code)

| Mailbox | Used for | Where it lives |
|---|---|---|
| `support@` | ticket receipts and replies (from), member-reply notices (to) | `SUPPORT_EMAIL` |
| `billing@` | purchase receipts (reply-to), billing ticket replies | `BILLING_EMAIL` |
| `info@` | Contact Us receipt, member-reply notices | `INFO_EMAIL` |
| `legal@` | legal references in paperwork | `LEGAL_EMAIL` |
| `admin@` | staff invites, task reminders (24 h and 1 h, plus weekly), offboarding | `ADMIN_EMAIL` |
| `auth@` | sign-up confirmation (provider template) | not in the code at all |
| `collaborate@` | split-sheet requests, contract requests, signing codes, seat invites, trial reminders | typed by hand, 10 places |
| `registrations@` | expert-registration reminders, "filed with <agency>", release day | typed by hand, 5 places |
| `partnerships@` | outreach letters (marketing, with opt-out) | typed by hand, 6 places |
| `security@` | tested once, no send path | — |

Two findings worth acting on:

1. **Only five mailboxes are defined once.** `collaborate@`, `registrations@`, `partnerships@` and `auth@` are literal
   strings inside senders, so a typo silently sends from a box nobody watches, and a rename means a sweep.
2. **Fourteen of the files that post to Resend carry no `Idempotency-Key`**: password reset, staff invite, seat invite,
   seat handoff, split-sheet request, contract request, contract signing code, IPI request, PDF email, company letter,
   outreach, staff offboarding, beta and launch gift. The nine that already send one (tickets, task reminders,
   registration, release day, retention, inactivity, purchase receipts, trial) are the model. Without a key, a retried
   request or a double click can send the same invite, code or receipt twice.

## 3. Delete now — safe list (needs a yes before anything is removed)

Deletion through the mailbox moves items to Trash first (30 days to change your mind). A batch delete skips Trash and
cannot be undone, so this plan never starts there.

| Gmail search | Found | Verdict |
|---|---|---|
| `from:notifications@wix-forms.com OR from:notifications@wixevents.com` | 5 | **Delete** — historic only: the Wix form is not connected any more (founder, 2026-11-10), so nothing needs switching off. Only the current build takes messages, at `/contact-us` |
| `(subject:TEST OR subject:test OR subject:Testing OR subject:yahoo OR subject:"Collab test" OR subject:Inquiry) (to:camethroughaudio.com OR from:camethroughaudio.com)` | 12 | **Delete** — our own smoke tests and header checks |
| `in:spam` | 469 | **Delete** after a glance; then keep spam on a 30-day auto-delete |
| `category:promotions older_than:6m` | 50+ | **Delete**, and set promotions to skip the inbox |
| `category:updates older_than:1y` | several hundred | **Archive** to a label first, delete in a second pass |
| `in:drafts` | 167 | **Sweep**; keep anything that is a real letter |

**Keep, always:** anything from Stripe, Supabase security notices, signed contracts and split sheets, tax and legal
correspondence, and the founder's own letters. The 23 product mails are worth keeping as the receipt trail; they cost
nothing.

## 4. Stop it at the source (before deleting anything)

- **Wix**: nothing to turn off. The Wix form is no longer connected (founder, 2026-11-10); those five mails are
  historic, and only the current build takes messages, at `/contact-us`.
- **Supabase Auth**: the mailbox shows three different wordings of "Confirm your email" (workspace, studio, welcome).
  That is template history rather than three mails per signup, but confirm in Auth → Email Templates that only one
  confirmation is live before assuming it.
- **Our own tests**: smoke tests go to a dedicated address (a `qa@` alias), never the founder's personal inbox. The six
  header-test mails are exactly the noise this removes.
- **Aliases**: one inbox per function (support, billing, info, collaborate, admin), each labelled, instead of every
  mailbox forward into one personal 15 GB account.

## 5. Filters to set (ten minutes, no code)

- `from:(support|billing|info|collaborate|admin|registrations|partnerships)@camethroughaudio.com` → label `CTA/Outgoing`.
- `from:auth@camethroughaudio.com` → label `CTA/Auth`, and **never send to spam**: a password reset in spam becomes a
  support ticket.
- `subject:"Member replied"` → label `CTA/Support`, mark important — it is the queue nudge.
- `from:stripe.com` → label `CTA/Billing`, never delete.
- `subject:("We've got your ticket" OR "Your support ticket")` → label `CTA/Support`.
- `to:camethroughaudio.com` (inbound domain mail) → label `CTA/Inbound`.
- `category:updates older_than:30d` → skip the inbox; `category:promotions` → skip the inbox, delete after 30 days.

## 6. Code changes that keep the flow clean (ordered, each small)

**Shipped 2026-11-10:** steps 1 and 2, in `src/lib/mailer.ts` with `mailer.test.ts`.

1. **One typed mailbox list — done.** `AUTH_EMAIL`, `COLLABORATE_EMAIL`, `REGISTRATIONS_EMAIL`, `PARTNERSHIPS_EMAIL` and
   `SECURITY_EMAIL` now live in `email-layout.ts`, `MAILBOXES` names all ten once in `mailer.ts`, and every sender that
   typed an address by hand (`collaborate@`, `registrations@`, `partnerships@`, the PDF mailbox list, the outreach
   header) goes through `mailFrom()`. The test checks that every mailbox is on our domain and unique.
2. **A `sendMail()` that requires an idempotency key — done for the fourteen.** Password reset, staff invite, seat
   invite, seat handoff, split-sheet request, contract request and signing code, IPI request, PDF email, company letter,
   outreach, offboarding, beta and launch gift now send with a key from `mailKey(...)`, built from the row's own id (and
   a minute bucket where asking again later is legitimate). A send with no key throws; a missing provider key reports
   "not configured" instead of pretending. The nine senders that already carried a key still post to Resend directly —
   folding them into the helper is the follow-up, and they keep their keys in the meantime.
3. **Bounce and complaint suppression.** We have none. A Resend webhook for `bounced` and `complained` writes to a
   suppression table that `sendMail()` checks, so a dead address stops being mailed. Without it, hard bounces keep going
   out, which is what damages the domain's reputation and puts our mail in members' spam.
4. **Digest the staff mail.** Hourly 1-hour and 24-hour reminders plus a weekly reminder per task multiply with the task
   list. One morning digest for tasks due that day, keeping the 1-hour nudge for Top priority only. **Proposed** — it
   must never delay a real deadline.
5. **One release-day mail per member, not per song.** An album released today sends 8–11 separate mails under the
   current per-song rule. Group by member and day. **Proposed.**
6. **Keep reply-to honest**: customer mail replies back to its own mailbox, outreach replies to `partnerships@` with the
   opt-out line. Already true; keep it under test.

## 7. The maintenance ritual

- **Weekly (five minutes):** clear the three `CTA/` labels, empty spam, confirm no Wix mail arrived.
- **Monthly:** check Gmail's storage breakdown (mail vs Drive vs Photos), delete the promotions folder, review the Resend
  dashboard for bounces.
- **Quarterly:** re-run the counts in §1 and compare; prune the oldest labels. A rising count is the signal to revisit
  §6.4 and §6.5.

## 8. Decisions needed (undecided)

1. **Provider:** Google Workspace seats per mailbox, or keep forwarding aliases. Cost and seat count are not decided.
2. **Which mailboxes are customer-facing** (`support@`, `billing@`, `info@`, `collaborate@`) and which stay internal
   (`admin@`, `registrations@`, `partnerships@`, `auth@`).
3. **Mailbox retention**: how long ticket threads and receipts stay in the mailbox (the app keeps its own rows forever).
4. **Whether the personal Gmail stays the catch-all**, or mail moves to an `email@camethroughaudio.com` box.
5. **Whether to delete the 23 historic product mails** (recommendation: keep them).

## 9. Next actions, in order

1. Approve §3, then apply the delete lists (nothing needs switching off at Wix).
2. ~~Ship §6.1 (typed mailboxes + test)~~ and ~~§6.2 (`sendMail` with idempotency keys)~~ — shipped 2026-11-10.
3. Ship §6.3 (bounce/complaint suppression), which needs a webhook and one table.
4. Fold the nine already-keyed senders into `sendMail()` so there is one send path.
