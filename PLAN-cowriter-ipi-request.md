# PLAN — Co-writer PRO / IPI request · v1

Status: **awaiting approval.** Touches writer fields (PRO, IPI), so per AGENTS.md this plan comes first.
Preview: https://claude.ai/artifact/QWgd4ibVseNHYZfVo2sgok

## The flow
1. **You ask.** Wherever a co-writer's PRO or IPI is missing (Royalty Health Report "More ways to fix it", and the song's checklist): **Ask {name} for their PRO and IPI**. One request covers every song where that co-writer is missing them. Their email is filled in from the Contributor Library or split sheets when known; otherwise you type it (it is required, because their free account must use that email). "Copy the link instead" lets you text it yourself.
2. **They get a branded email** (`emailLayout()`, from collaborate@camethroughaudio.com): your artist name, the song titles, their name and role as you entered it. No shares, no other writers. Footer has "Don't send me invites".
3. **They join free, then add their details** at `/ipi/{token}` (founder, 2026-10-23: a free account is required, like split-sheet signing, so every request brings a member in). Create a free account with the invited email or log in (`SignupCard inviteMode`), then: legal name, PRO (worldwide list + Other), IPI (9–11 digits), or "I'm not in a PRO yet". Their details also go into their own Catalog Profile (blanks only) so they're ready for their own songs. They get the free 30-day Catalog & Collaborate trial through the existing trial grant and fraud guard (new source `ipi_request`). The link expires after 30 days. Every field has a plain-language ⓘ tip.
4. **You approve.** Their answer waits in the report as "Jordan Lee sent their details". **Add to N songs** fills only blank PRO/IPI fields on the writer rows matched by legal name; nothing already entered is overwritten (AGENTS.md: never overwrite writer data). "Not right" discards it. The report updates and its next step is the real fix: download the agency file and update each registration.

## Safeguards
- Same limits as split-sheet invites (`invite-limits.ts`): 25 a day per account, 3 a day per recipient, 3 sends per request with 24 h between, blocklist and opt-out link.
- PRO and IPI stay catalog-only: never embedded in MP3s (AGENTS.md).
- The public page shows only what's in the email; the token is random and single-use. Answers are readable only by the requester.
- Sender-typed text is cleaned (`cleanInviteText`) before it goes into an email.

## Files
- Migration `20261024140000_…-ipi-requests.sql` (adds a table only): `ipi_requests` (id, owner_id, writer_name, email, songs jsonb [{catalog_id, title}], token, expires_at, sent_at, answered_at, answer jsonb {legal_name, pro, ipi, no_pro}, status pending/answered/applied/dismissed). Owner-only RLS; the signed-in invitee reads/answers through two security-definer functions by token that check their account email matches the invited email (`get_ipi_request`, `answer_ipi_request`), like `get/sign_split_invite`. `invite_sends` gets a nullable `ipi_request_id` column.
- `src/lib/ipi-request.functions.ts` (send email, server), `src/lib/ipi-requests.ts` (create, list, apply answer: fills blanks only), `src/routes/ipi.$token.tsx` (public page, gate-exempt like /sign), `src/components/IpiRequestDialog.tsx`, report + checklist buttons, tests.

## Decided
- **Who can send:** Catalog & Collaborate and up, like signature requests.
- **Recipients:** free account required; the email carries the 30-day Catalog & Collaborate trial line, as split invites do.
