# MLC access — free route now, paid route when revenue pays for it

**Today (3 Nov 2026):** The MLC's Data Access Hub quoted **$100 one-time + $25/month** for the subscription whose form covers "the Bulk Data Feed **and/or** The MLC Public API." That is the only missing piece of the Streaming Fast-Track's composition half (§4.4).

**Decision: don't pay it yet.** The recording half is live and free. The composition half degrades honestly in the meantime, and the trigger for paying is written down below so this doesn't get decided by mood in January.

---

## What $400/yr buys, and what it doesn't

| | |
|---|---|
| Cost | $400 in year one ($100 setup + $300), $300/yr after |
| Buys | Automated, authoritative "is this work on file at The MLC, and who owns it" — writers as registered, publisher, IPI, ISWC, work ID |
| Doesn't buy | PRO-side facts (Songview/ACE), non-US mechanicals, or anything about recordings |
| Already built | The adapter in `src/lib/composition.server.ts`, the honest three-state matcher in `src/lib/composition.ts`, and the UI in `src/components/StreamingFastTrack.tsx` |

Against $0 MRR in beta that fee is infinite as a percentage. Against $500 MRR it is 5%, which is a normal line item. Hence the trigger.

---

## Before paying: one email that might make it free

The registration form conflates the bulk feed with the public API. The statute doesn't: §115(d)(3)(E)(v)'s no-charge access belongs to DSPs and Significant Non-Blanket Licensees, while the Musical Works Database Terms of Use describe a database reachable "by a bulk download and/or public API that any member of the public can obtain or use." It is worth one email before $400 leaves:

> Hello — I'm the founder of Came Through Audio, a small US label and music technology company. I registered through the Data Access Hub for **Public Search API** access, and the form I was routed to is titled "Registration for The MLC Bulk Data Subscription," quoting $100 setup and $25/month.
>
> I only need the **Public Search API** — single-work lookups keyed by ISRC or writer and title, a few hundred per week, server-side, cached, never redistributed. I am not requesting the Bulk Data Feed and have no use for a full copy of the database.
>
> Could you confirm whether Public Search API access alone carries the $100/25 fee, or whether that fee applies only to the bulk delivery, given the form covers "the Bulk Data Feed and/or The MLC Public API"? If a fee does apply, I'd be grateful for the term, cancellation terms, and whether a startup or beta-stage rate exists. Happy to provide any details about the product.
>
> Thank you — [name], Came Through Audio, camethroughaudio.com

Three possible answers, all useful: it's free (great), it's $400/yr (pay it when the trigger hits), or it's bulk-only and there is no API-only tier (then the manual route below is the product for beta).

---

## The free route: assisted manual check

The artist is the lookup engine; we do everything except the search itself. This is not a fake API — it is a checklist with the hard parts pre-filled.

1. **Derive the search terms from data we already hold.** Work title cleaned of `feat.`, `(Remix)`, `- Radio Edit`, `Remastered`; writer legal names from the catalog's writer records; the track's ISRC.
2. **One-click copy per field**, then the portal opens in a new tab: `https://portal.themlc.com/search`.
3. **The state stays `unverified`.** That state already exists, is already never read as "missing," and already carries the locked wording: *Not yet verified — check at The MLC*.
4. **The user may record what they found** — "on file, work ID …" or "not found" — stored as *user-attested*, shown as "You confirmed this at The MLC on {date}," and never displayed as an MLC-verified result. That needs a column, a server function and a policy; it is a later step, not today's.

**Verified 3 Nov 2026:** `portal.themlc.com/search` returns a 3,115-byte shell that boots `main.c979ccdf4e5bdb11c22e.bundle.js` — a client-side app. A prefilled query string is therefore **not** something we can rely on; the copy buttons are the interaction. If a prefill ever turns out to work, it is a bonus, not a dependency.

**What the manual route cannot do:** scale. It costs 30–60 seconds per work, so it fits an artist checking their own catalog and does not fit a subscriber who expects a button. That boundary is exactly the trigger.

---

## The honest middle: what we already know without The MLC

The hub already prepares MLC registrations itself — the agency export templates and `registrationCheck` were built for that. So for a work CTA filed, we can say something true and useful today:

- **"Registered through us"** — we hold the filing record, with a date. This is a fact about our data, stated as ours.
- **"Not in our records"** — the artist never filed it here, so it is almost certainly not filed anywhere. That is a prompt to register, not an accusation.
- **"Is it on file at The MLC?"** — stays *unverified* until either the API or the artist's own search answers it.

That distinction is the whole trick: never convert "we didn't ask" into "you don't have it." The words "unregistered" stay reserved for a successful empty search.

---

## Trigger to pay

Pay when **any one** of these is true:

- **MRR ≥ $500 for two consecutive months** (fee ≤ 5% of revenue), or
- **50+ active users each checking ≥ 5 works a month**, i.e. the manual check has become a support queue, or
- **a paying customer's contract requires automated verification** — then it is cost of goods, not overhead.

Do not pay for it before the Cloudflare move in the week of Dec 7. The key belongs in Worker secrets, and buying twice (Lovable-then-Worker) is waste for no benefit.

---

## The day we pay

1. Store `MLC_API_KEY` — or `MLC_CLIENT_ID` + `MLC_CLIENT_SECRET` — in Worker secrets. Never in chat, never in a file, never `VITE_`-prefixed.
2. Confirm the three spots marked in `src/lib/composition.server.ts` against the onboarding doc: the token endpoint, the search path and parameters, and the response envelope key. An hour at most, and `parseSearch()` throws rather than guessing if the shape has moved.
3. `mlcLookup` reports `available: true`, chips flip to *On file at The MLC* with the work ID, and the locked "Unregistered Musical Work" diagnosis renders **only** when a real search returns nothing.

## What does not change, at any price

No invented results, no fake spinner, no scraping Songview, ACE or the portal, and no work called unregistered without a successful empty answer. A fee changes who does the lookup; it does not change what we are willing to claim.
