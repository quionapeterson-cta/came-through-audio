# Security findings: business-essential mail, signed off

(founder, 2026-11-19) The security scanner's findings live in the scanner's own records, which a code session cannot
edit, and they are not stored in this repository. This file is the durable record of the review: which findings were
raised, what was decided about each, and the limits that decision rests on. Code and this file must agree — if a limit
below changes, this file changes in the same commit.

## Approved as business-essential

| Finding (scanner) | What it covers | Decision |
| --- | --- | --- |
| `0ef4…` | Signature / packet mail sent from `admin@` | Approved — business-essential, limited |
| `10da…` | Split-sheet invite mail | Approved — business-essential, limited |
| `7e75…` | Split-sheet invite mail | Approved — business-essential, limited |

The prefixes are as they were recorded when the findings were raised; the scanner holds the full identifiers, and the
full IDs should be written in beside them the next time the scanner is open. The fourth finding from the same review,
`lov_finding_41bec9cdc2a1c81a`, asked for a fix rather than an approval: the fix is in the code described below (outbound
company mail is a super admin's or the owning department lead's), and its status is kept in the scanner.

## Why these are essential, not marketing

- **Signature mail** delivers an agreement to the person who has to sign it. The link in the email is the only way an
  outside signer can reach their packet, and the packet is the agreement itself. Without the email the contract cannot
  be executed.
- **Invite mail** is how a split sheet reaches a co-writer. Both people are working on the same release, and the invite
  is the access to that sheet — not a suggestion to buy anything.
- Both are **one message to one named person about one document**. Neither is ever a list, a campaign or prospecting.
  That is the line that keeps them out of the bulk-mail category, and it is also what makes them worth approving rather
  than restricting further.

## Split-sheet invite mail: the limits that apply

`src/lib/invite-limits.ts` holds the numbers; `src/lib/splits-email.functions.ts` and `src/lib/ipi-request.functions.ts`
apply them before a send, counting from the server-side `invite_sends` table (never from the browser).

| Rule | Value | Constant |
| --- | --- | --- |
| Invites one account may send in 24 hours | 25 | `DAILY_INVITE_LIMIT` |
| Emails per invite (a split row, or a co-writer request), ever | 3 | `ROW_SEND_LIMIT` |
| Wait between two sends of the same row | 24 hours | `ROW_RESEND_GAP_MS` |
| Invites one address may get in 24 hours, from all senders combined | 3 | `RECIPIENT_DAILY_LIMIT` |
| Longest sender-typed text in an invite | 80 characters | `INVITE_TEXT_MAX` |
| Links in an invite | Our own site address; a preview origin falls back to the published site | `trustedOrigin` |
| A recipient who switched invites off | Never emailed | `invite_blocklist` |

Sender-typed text is also stripped of web addresses and email addresses (`cleanInviteText`), so an invite cannot be
turned into a carrier for someone else's link. Contract-signing invitations are a separate path with their own
50-a-day cap, and its number lives in the same file as the rest — `CONTRACT_INVITE_DAILY_LIMIT` in
`src/lib/invite-limits.ts`, applied by `src/lib/contracts-email.functions.ts`.

## Signature / packet mail: the limits that apply

There is no daily count on this mail. What protects it is who may send it, what one send can contain, and that a repeat
cannot slip through:

- **Sender seat** — only a super admin or HR may send a packet (`requirePacketSender` in
  `src/lib/pdf-packets.functions.ts`), enforced on `sendPacket`, `emailPacketLink` and `emailPacketCopy`. The hidden
  Sent & Inbox section is the second lock, never the rule.
- **One email per key** — every send carries an idempotency key built with `mailKey` from the packet id and recipient,
  and the provider drops a repeat of the same key, so a double click or retried request cannot email the signer twice.
  A deliberate "send it again" uses a new key on purpose, and that is the only way a second copy goes out.
- **One packet per link** — the public signing page resolves a single packet by its unguessable id through the
  database's own `pdf_packet_signing` / `pdf_packet_submit` functions, so a signing link exposes that packet and nothing
  else.
- **Provider limits are surfaced, not swallowed** — when the mail service rate-limits us the sender is told to wait a
  minute or copy the link, instead of the send looking successful.

If a daily cap for packet mail is ever wanted, it belongs in `sendPacket` beside the other caps, and its number needs
founder approval before it is written — no cap is invented to satisfy a scanner.

## Neighbouring caps, under the same rule

Company correspondence and outreach have their own caps. They are listed here because a raise in one of them is a change
to what this sign-off rests on, and a constant that leaves this table fails `src/lib/security-findings.test.ts`.

| Rule | Value | Constant | Where |
| --- | --- | --- | --- |
| Company letters, company-wide, 24 hours | 25 | `COMPANY_MAIL_DAILY_LIMIT` | `src/lib/company-email.ts` |
| Company letters from one account, 24 hours | 25 — deliberately the same figure | `COMPANY_MAIL_SENDER_DAILY_LIMIT` | `src/lib/company-email.ts` |
| Outreach letters, 24 hours | 50 | `OUTREACH_DAILY_LIMIT` | `src/lib/outreach-emails.ts` |

The company pair is counted over `outreach_emails` where `kind = 'company'`, company-wide and then per sender, both
before the send; the outreach cap counts the table's sends in the last 24 hours. Who may write either kind, and the
mailbox each letter records, live in `AGENTS.md` ("Company Mail: Who Sends, Who Reads").

## What would void this sign-off

- Raising, removing or working around any limit above, or sending from a mailbox the rule does not allow, without
  updating this file in the same commit.
- Reusing invite or signature mail for a list, an announcement, a promotion, or anything a named recipient did not ask
  for.
- Opening packet sending beyond a super admin and HR.
