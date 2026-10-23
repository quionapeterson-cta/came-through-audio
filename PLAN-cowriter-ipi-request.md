# PLAN — Co-writer PRO / IPI request · v1

Status: **awaiting approval.** Touches writer fields (PRO, IPI), so per AGENTS.md this plan comes first.
Preview: https://claude.ai/artifact/QWgd4ibVseNHYZfVo2sgok

## The flow
1. **You ask.** Wherever a co-writer's PRO or IPI is missing (Royalty Health Report "More ways to fix it", and the song's checklist): **Ask {name} for their PRO and IPI**. One request covers every song where that co-writer is missing them. Their email is filled in from the Contributor Library or split sheets when known; otherwise you type it. "Copy the link instead" works without email.
2. **They get a branded email** (`emailLayout()`, from collaborate@camethroughaudio.com): your artist name, the song titles, their name and role as you entered it. No shares, no other writers. Footer has "Don't send me invites".
3. **They fill in one short page** at `/ipi/{token}`: legal name, PRO (worldwide list + Other), IPI (9–11 digits), or "I'm not in a PRO yet". No account needed; the link works once and expires after 30 days. Every field has a plain-language ⓘ tip.
4. **You approve.** Their answer waits in the report as "Jordan Lee sent their details". **Add to N songs** fills only blank PRO/IPI fields on the writer rows matched by legal name; nothing already entered is overwritten (AGENTS.md: never overwrite writer data). "Not right" discards it. The report updates and its next step is the real fix: download the agency file and update each registration.

## Safeguards
- Same limits as split-sheet invites (`invite-limits.ts`): 25 a day per account, 3 a day per recipient, 3 sends per request with 24 h between, blocklist and opt-out link.
- PRO and IPI stay catalog-only: never embedded in MP3s (AGENTS.md).
- The public page shows only what's in the email; the token is random and single-use. Answers are readable only by the requester.
- Sender-typed text is cleaned (`cleanInviteText`) before it goes into an email.

## Files
- Migration `20261024140000_…-ipi-requests.sql` (adds a table only): `ipi_requests` (id, owner_id, writer_name, email, songs jsonb [{catalog_id, title}], token, expires_at, sent_at, answered_at, answer jsonb {legal_name, pro, ipi, no_pro}, status pending/answered/applied/dismissed). Owner-only RLS; the public page reads/answers through two security-definer functions by token (`get_ipi_request`, `answer_ipi_request`), like `get/sign_split_invite`. `invite_sends` gets a nullable `ipi_request_id` column.
- `src/lib/ipi-request.functions.ts` (send email, server), `src/lib/ipi-requests.ts` (create, list, apply answer: fills blanks only), `src/routes/ipi.$token.tsx` (public page, gate-exempt like /sign), `src/components/IpiRequestDialog.tsx`, report + checklist buttons, tests.

## Questions for you
1. **Which plans can send it?** My suggestion: **Catalog Plus and up** (it needs a catalog). Split-sheet e-signature requests stay on Collaborate.
2. **Trial line in the email?** Split invites mention the free 30-day Catalog & Collaborate trial. Add the same line here (and grant the trial when they sign up with that email), or keep this email focused on the one ask? My suggestion: keep it focused.
