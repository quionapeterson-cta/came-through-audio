# PLAN — Artist seats: consent, visibility and taking over the payments

Status: **terms, read access, seat expiry and the payment takeover built and applied (2026-11-08); the open decisions
are section 8.** The Terms section was
written to the founder's instruction; have an attorney read it before it is relied on. This file is product and risk
analysis, not legal advice.

Founder decisions this plan follows:

- 2026-11-08: "Let the artist agree to the terms when they create the account" — no separate seat clickwrap.
- 2026-11-08: **no artist revocation.** The owner paid and the artist agreed at sign-up, so the seat runs for the period
  paid for.
- 2026-11-08: the owner may **read** split sheets and contracts; only the invited artist may initiate sending a contract
  under their name; everyone signing is told.
- 2026-11-08: the invite that "took me to a free account" is a bug, fixed here.
- 2026-11-08: how an artist takes over the payments is planned **after** these updates (section 8).

---

## 1. What a seat exposes now

| Area | Owner can | Where it is enforced |
|---|---|---|
| Songs (`catalogs`) | read, insert, update, delete | `20261104120000_artist-seats.sql`, `20261108130000_seat-owner-catalog-writes.sql` |
| Song contents | titles, lyrics, ISRC/UPC, writers' legal names, PRO, IPI, shares, publisher, credits | same rows (writers are a JSON column) |
| Split sheets | **read only, new** | `20261108150000_seat-owner-records-read.sql` |
| Contracts and their parties | **read only, new** — never send, sign, edit or delete | same migration |
| Artist profile | read stage/legal name, Embed Defaults, Catalog Profile | `20261104160000_seat-artist-defaults.sql` |
| Artist defaults | write through `set_seat_artist_defaults` | same migration |
| Catalog files | read, upload, replace, delete in the artist's folder | `20261108130000` |
| Seat row | read and update their own seat | `20261104120000` |

Still not exposed: AI Protection certificates, registration submissions, purchases/subscriptions/invoices, support
threads. The Terms promise this, so a future feature has to change the Terms first.

**No revocation, by decision.** The artist cannot withdraw the access while the seat is paid for, and the copy says so
plainly in Terms §22 and Privacy §10. The artist's protection is that the access is bounded by the list above, the seat
expires with the payment, and the owner may not reuse or publish anything.

**Consent lives at account creation.** `SignupCard` now states, beside the create-account button, that creating an
account accepts the Terms and Privacy Policy, including how a seat shares catalog, split-sheet and contract access. The
seat page repeats what the owner will see before the artist accepts, and `accept_artist_seat` records `accepted_at`.
No per-seat checkbox: it would be a second consent to the same document.

**Contracts belong to the artist.** `contracts.user_id` is the artist, so the owner's read policy is scoped to a live
seat and grants SELECT only. `send_contract` now checks the caller by id first: a seat owner gets "Only the artist can
send this contract under their name" instead of a misleading "not found"; the artist's own path is unchanged.

**Everyone signing is told.** Terms §22 says every party asked to sign is told, before signing, that the artist's seat
holder can read the contract and who signed it. The signing page's notice (the same place `consent_at`, `ip_hash` and
`user_agent` are recorded) carries that sentence; the signature record is the acknowledgement.

---

## 2. The bug the founder hit

Accepting the Management seat ended on a Free account. The database showed why: seat `603b770d…` was still
`status = invited`, `member_user_id = null`, `accepted_at = null`, while a new account with the invite email was created
at 17:50 and confirmed a minute later. The seat was **never accepted**.

Cause: the seat page's sign-up sent the confirmation link to `/verified?next=/workspace`, so confirming the email
dropped the artist into a Free workspace with no way back to the invite. `SignupCard` now receives
`returnPath={"/seat/<id>"}`, so the confirmation returns to the seat page; the accept call then does a full
`window.location.assign("/workspace")`, so billing is read fresh rather than from a page already open. The page also
tells a signed-in visitor when they are on the wrong email, with a sign-out button, instead of letting the RPC fail.

---

## 3. Legal grounds this covers

1. **Authority** for one customer to touch another's data — now stated in the Terms the artist accepts at sign-up.
2. **Controller-to-controller**, not processor: the owner decides what to do with what they can see; we do not direct it.
3. **Third-party personal data** in the catalog and on split sheets (co-writers' names, PRO, IPI, splits) — the artist
   warrants they may share it.
4. **Confidentiality**: what the owner may not do with it, and that it survives nothing once the seat ends.
5. **Intellectual property**: a permission to edit that dies with the seat; ownership never moves.
6. **No employment, management, label or publishing deal.**
7. **One-way duration**: no revocation, so the term has to say that clearly rather than implying a control that doesn't
   exist. This is the part most worth an attorney's eye: a term that locks an artist into sharing for a paid year is
   defensible when it is prominent, bounded and time-limited, and risky when buried.
8. **Sending stays with the artist**, so a contract can never appear to be issued by the person paying for the seat.
9. **Lapse**: the artist's account and catalog are theirs; a seat ending is never account deletion.
10. **Evidence**: `accepted_at` on the seat, and `consent_at` / `ip_hash` / `user_agent` on each signature.

---

## 4. Copy shipped in this change

- `src/lib/legal-docs.tsx` — Terms **§22 Artist Seats** (what the owner sees, who sends contracts, no revocation, how
  long a seat lasts, ownership, no other deal) and Privacy **§10**, plus a corrected Privacy §7 that no longer claims
  every account is isolated from every other.
- `src/components/SignupCard.tsx` — the acceptance line beside Create my free account / Sign up & pay.
- `src/routes/seat.$seatId.tsx` — what the owner will see, before the artist accepts.
- `src/lib/price-list.ts` — the seat note staff quote from now matches the access.

**Not done, because it needs a decision:** the `updated` / effective date on the Terms and Privacy pages. The new
sections ship under the current date until the founder sets the date the change takes effect.

---

## 5. Remaining exposure and the fixes planned

1. **Seat access expires with the paid period.** Fixed in `20261108160000_seat-handoff.sql`: the catalog read/update
   policies, the profile-read policy and `set_seat_artist_defaults` now check `current_period_end` too, so a cancelled
   seat past its year stops reading and editing, and a handed-off seat stops the owner the moment the artist takes over.
2. **Status is never written to `ended`** for an accepted seat; it stays `canceled` forever, which is why every policy
   repeats the date test. A daily job should write `ended` once the period passes, as `runCatalogLapses` already does for
   plans.
3. **Delete rights after cancellation.** An owner can still delete songs until the paid year ends. Recommendation:
   a cancelled seat is read-only. That removes shipped behaviour, so it waits for the founder by name.
4. **No notice** to either side before a seat ends. Timing is undecided.
5. **No audit trail of access** beyond `accepted_at`. A `seat_access_events`-style record would answer disputes, but
   with no artist controls to log, its only event is acceptance — not worth a table yet.

---

## 6. Taking over the payments (built 2026-11-08)

Founder, 2026-11-08: "A seat handoff can take place at anytime but what is paid is paid and no new payments are done
from the artist taking over until the billing cycle is ready to renew."

That settles the shape: the handoff is available immediately, the owner's paid year is used up rather than refunded or
credited, and the artist's first payment is the renewal.

**The sequence.** The artist asks from their seat card on Profile ("Keep this plan after …"); the owner is told by
email. An owner-side offer is not built, because nothing may move without the artist's own checkout. Nothing moves until
the artist completes it.

1. The artist opens a normal plan checkout at the seat's tier, with the subscription created on a trial ending on the
   seat's `current_period_end` (`subscription_data.trial_end`). Stripe shows nothing due today and collects a card for
   the renewal. A trial counts as paid access in `paid_tier` (`status IN ('active','trialing','past_due')`), so the tier
   never drops during the changeover.
2. The webhook records the artist's own subscription. Only then is the seat marked `handed_off`: the owner's access ends
   at that moment, and the seat stops lifting the artist's tier because their own subscription now supplies it.
3. That one seat is taken off the owner's renewal: its tier's line loses one artist (`proration_behavior: "none"`, so
   no refund or credit for the time already paid for), and the whole subscription is set to cancel at period end only
   when it was its last seat. Other artists on the same purchase are untouched.
4. At `current_period_end` the trial ends and the artist is charged normally at that tier's plan price. From then on it
   is an ordinary plan: renewals, card updates, pause, the refund window, all unchanged.

**Why this order.** Marking the seat handed off before the artist's subscription exists would drop them to Free
mid-year if their checkout failed. Doing it after means an abandoned handoff leaves everything exactly as it was.

**Edges.**
- The artist never finishes checkout: nothing happens, the seat stays live, the owner keeps access.
- The artist cancels during the trial: no charge; at period end they drop to their own plan (Free if none) and the
  catalog stays. The owner has already paid and is not refunded.
- Handoff after the owner cancelled: it works while the seat is live; the same end date governs.
- Handoff on the last day of the period: the trial is a day long and the renewal lands on time; no double charge.
- The seat row keeps `owner_id`, `member_user_id` and a new `handed_off_at` as history. A handed-off seat is not reused
  for another artist in the same year.

**What is built.** A `kind = "seat_handoff"` checkout that reads the seat, its tier and its end date on the server (only
its member may start it, and only one live plan is allowed), `trial_end` in `subscription_data`, a webhook branch that
marks the seat `handed_off` with `handed_off_at`, takes that one seat off the owner's renewal, and emails both sides
through `emailLayout`, the artist's card on Profile, and the owner's seats list showing the handed-off state. No catalog
or account migration: the account was always the artist's.

**Ruled out by this decision.** Prorating the rest of the year back to the owner, crediting it to the artist, or
charging the artist anything before renewal.

**What the handoff grants and revokes, at the moment the trial subscription is recorded.**

| | Artist | Owner |
|---|---|---|
| Gains | Their own plan subscription at the seat's tier, their own customer and card on file, and control of their billing (renewal, card, cancel, invoices). Nothing is charged until the renewal date. | Nothing. Their seat stops being live and their next renewal is cancelled, so they are released from future charges. |
| Loses | The seat as the source of their tier — their own subscription replaces it. Nothing else: account, login, catalog, masters, artwork, lyrics, split sheets, contracts and signatures, certificates, purchases and support history stay exactly as they are. | Every seat right in section 1: catalog read, add, edit and delete; catalog files; profile read and defaults write; split-sheet read; contract and party read; the "working as" entry in the switcher; and the seat's tier. |

Nothing changes hands: no ownership, no data copy, no transfer of the owner's plan, brand kit, purchases or contracts.
A seat never granted branding, certificates, registrations or purchases, so a handoff grants none of them either; the
artist's own plan brings whatever that plan includes. The seat row keeps `owner_id` and `handed_off_at` as history, grants
the owner nothing, and cannot be re-invited.

**The card and the renewal date.** The artist enters their card during the handoff checkout and is shown the date the
first charge will be made — the seat's `current_period_end`, which is when their billing cycle starts. The confirmation
email repeats that date. Nothing is collected at the handoff beyond the card.

---

## 7. Order of work

1. **Done now:** Terms §22, Privacy §10 and §7, sign-up acknowledgement, seat-page copy and invite-return fix, owner
   read access to split sheets and contracts, artist-only `send_contract`, price-list note, db-check entry.
2. **Done:** `current_period_end` in the older seat policies. **Still open:** the `ended` job and seat-ending notices.
3. **Done:** the handoff in section 6, with the artist-only start and the one-seat billing change.
4. **Only if asked:** delete rights after cancellation (needs approval), contract visibility audit trail, seat access
   flags if the founder ever wants artist controls again — that reverses the no-revocation decision, so it waits.

---

## 8. Decisions needed

1. **Terms effective date** — the sections are live under the current date; name the date the change takes effect.
2. **Delete after cancellation** — keep as is, or make a cancelled seat read-only? Recommendation: read-only.
3. **Notice timing** before a seat ends — needs a day count from the founder.
4. **Who may start a handoff** — **artist only, built.** The owner is emailed when it happens; an owner-initiated offer
   is not built, because nothing may move without the artist's own checkout.
5. **The freed seat** — **released at the next renewal, built.** The owner's seat line loses that one artist at renewal,
   with no refund for the period already paid for.
6. **Contracts inside a seat** — confirm read-only forever (recommendation), so the Terms promise stays true.
