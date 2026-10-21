# PLAN — Founding 100: automatic plan upgrade for the first 100 paying users · v1

Status: **awaiting approval.**
Source: founder, 2026-10-21. Related: the earlier "Founding 100" idea in PLAN-pricing-badges.md (free year of Plus); this replaces or adjusts it (see questions).

---

## The rule
- The first 100 people who buy **Catalog Plus ($24.99)** get **Catalog & Collaborate ($44.99)** features while paying $24.99.
- The first 100 people who buy **Catalog & Collaborate ($44.99)** get **Catalog Management ($89.99)** features while paying $44.99.
- Each tier has its own count of 100.

## How it works (safe: nobody can grant it to themselves)
- New table `founding_upgrades` (user_id, paid tier, granted tier, seat number, granted_at), written **only by the Stripe webhook** when a qualifying payment lands. Users can only read their own row.
- The webhook takes the next seat number for that tier inside one database transaction, so two people paying at the same moment can't both be #100.
- `user_tier()` (the one function every lock already uses) returns the higher of the paid tier and the founding tier, so every feature unlocks with no other code changes.
- Users see a **Founding Member** badge and a line on Profile: "Founding member #37: you get Catalog & Collaborate for the price of Catalog Plus."
- Admin → Purchases shows founding seats used (e.g. Plus 37/100, Collaborate 12/100).
- Plans page: "Founding offer: 63 of 100 spots left" (live count), only while spots remain.

## Files
New migration (`founding_upgrades`, update `user_tier()`), webhook handler (`/api/public/payments/webhook`), `src/routes/plans.tsx`, Profile, Admin → Purchases, badge entry in `src/lib/badges.ts`.

## Questions
1. **How long does the upgrade last?** (a) Forever, as long as they keep paying without a gap (recommended: a strong reward that ends if they cancel); (b) first year only; (c) forever, even after a gap.
2. Does a **test-mode (sandbox) purchase** count toward the 100? (Recommended: no; only live purchases count.)
3. If a founding Plus member later upgrades to $44.99, do they move up to Management? (Recommended: yes, if Collaborate founding spots remain.)
4. Does this replace the earlier "free year of Plus" Founding 100 idea?
