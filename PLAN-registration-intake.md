# PLAN — Expert Registration Assistance: working checkout and a proper intake flow · v1

Status: **awaiting approval. PRIORITY 1.**
Source: founder testing notes, 2026-10-21.

---

## 0. Bug: "Pay & reserve my session" shows a Supabase publishable key error

- The button calls `openCheckout({ kind: "expert", … })` (`src/components/ExpertAssistance.tsx:120`). The other checkouts work, so the error is specific to this path.
- Expert Assistance is sold **outside Stripe Managed Payments** (Stripe excludes human-delivered services), so it builds its session differently from plan purchases (`src/lib/stripe-mapping.ts`).
- The message comes from our Supabase helpers (`src/integrations/supabase/client.ts`, `auth-middleware.ts`), which throw when `SUPABASE_PUBLISHABLE_KEY` can't be read on the server. The likely cause is that this path runs a server function without the signed-in session or the server environment variables.
- **Fix:** reproduce it in the preview, read the server log, and fix that path so it uses the same signed-in server call as plan checkout. Add a test for the expert checkout input.
- **Founder check after the fix:** sandbox purchase with card 4242 4242 4242 4242.

## 1. Songs must be in the catalog first (friendly redirect)

- Registration assistance only works from catalog songs, because agents export straight from the catalog.
- If the catalog is empty: a friendly card instead of the order form:
  > **Let's get your songs in first.** Registration starts from your catalog, so our agents have every detail in one place. Add your songs in My Catalog, then come back here.
  > [Go to My Catalog]
- If some songs exist but aren't ready: they're listed with ⚠️ and a link to the exact field to fix (shared readiness check, `src/lib/readiness.ts`).

## 2. Pick songs from the catalog (replaces the number box)

- The "number of songs" box becomes a **song picker** filled from the user's catalog, grouped Singles / EPs / Albums (collapsible).
- Each song shows Ready ✓ or ⚠️ with what's missing. Only Ready songs can be checked; splits must total 100% (registration is strict).
- Song count and price update from the songs checked. The chosen song IDs are saved with the purchase (`purchases.details.track_ids`) so the agent sees exactly which songs were paid for.

## 3. After payment: step-by-step intake

A numbered checklist that unlocks in order (later steps stay locked until earlier ones are done):

1. **Payment confirmed** ✓
2. **Sign the Registration Authorization agreement.** It lets Came Through Audio act for the user with each agency they picked. Signed in-app, saved like other contracts.
3. **Add Came Through Audio as your representative/user.** One card per agency picked, with plain-language steps:
   - **ASCAP / BMI:** add us as an authorized user or representative in the member portal.
   - **The MLC:** invite us as a user on the MLC Portal (Account → Users).
   - **SoundExchange:** add us as an authorized representative (SoundExchange Direct; a Letter of Direction may be needed).
   - Each card has a "Done" button and a "Need help?" link. Exact steps will be checked against each agency's current portal before this ships.
4. **Book your session** (existing booking step).
5. **Status tracker:** Submitted → In progress → Registered, per song and per agency, updated by the agent.

## 4. Agent side: one-click agency exports

- Admin → Registration queue: one row per paid session showing the user, songs, agencies, agreement signed?, representative access confirmed?, booking.
- **One-click export** per agency for the session's songs, using the existing export templates and shared readiness check (no new writer fields).
- The agent marks each song/agency registered; the user's tracker updates.
- Staff-only through staff-verified server functions.

## Files
`src/components/ExpertAssistance.tsx`, `src/lib/stripe-mapping.ts`, `src/lib/checkout.ts`, `src/lib/readiness.ts` (read only, no change to the rules), `src/lib/agency.ts` (export reuse), admin route + new `registration_sessions` migration (status per song/agency, server-written), Registration Authorization template (new, needs founder's wording approval).
Touches writer/export code paths, so per AGENTS.md: confirm this file list before editing.

## Questions
1. Registration Authorization agreement: should I draft the wording for your review, or do you have one from a lawyer?
2. Should a user be able to pay for songs that aren't Ready yet and fix them before the session, or only Ready songs? (Recommended: only Ready songs.)
