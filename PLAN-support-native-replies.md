# PLAN — Answer a ticket in the app: native replies with the scripts at hand

Status: **built 2026-11-08** after the founder's answers in §7 — scripts on the **right** (his correction), `waiting` added,
resolved closed to the member, every reply emails a link straight to the message box, internal notes in v1, and the
member's own Support tab in the same ship. The migration still has to be applied in Supabase before the panel can store a
reply. Nothing introduces a number, wait time or promise the founder has not approved.
Source: founder, 2026-11-08 — "support needs a message box to reply directly to support tickets natively. So instead of
reply by email. Insert a message box and place the scripts to the left so they can scroll through them and choose the
reply. Make sure the area is decluttered, highly functional, and flowing based on task. Consolidate any fields that
naturally go together into one drop down and make the steps natural."

Today: a ticket is one row in `public.support_tickets`, read in Admin → Support Tickets, and **answered somewhere else** —
the panel's only reply path is a `mailto:` link, so the reply, the wording used, who sent it and when are all outside the
app. The scripts exist (`src/lib/support-scripts.ts`) but sit in a collapsible card under the message, and copying one,
finding the mailbox, pasting and then coming back to change the status is four separate tasks for one reply.

This plan makes the ticket a **conversation** the app owns: the message box is where the reply is written, the scripts
are a rail beside it, and sending is one action that stores the reply, emails the member and sets the ticket's next state.

---

## 1. The shape of the screen

An open ticket fills the panel instead of expanding inside a list card:

```
┌──────────────────────────────────────────────────────────────┬───────────────────────────┐
│  Tasha Bell · tasha@… · Account & billing · Billing's        │  SCRIPTS                  │
│  Refund approved (inside 30 days)          [Actions ▾]       │  [ search…            ]   │
├──────────────────────────────────────────────────────────────┤  ── Suggested ──          │
│  Tasha, 2 Nov 09:14                                          │  Refund approved           │
│  I was charged twice this month…                             │  It looks like two charges │
│                                                              │  ── All Billing ──        │
│  You (Billing), 8 Nov 11:02                                  │  Card declined             │
│  Hi Tasha, your refund of $— is approved…                    │  Pausing is not cancel…    │
│                                                              │  …scrolls on its own…     │
├──────────────────────────────────────────────────────────────┤  ── Staff only ──         │
│  Hi Tasha,                                                   │  INTERNAL — before a break│
│  [write the reply here, it grows as you type]                │                           │
│  {{amount}}  {{date}}   ← fill in before sending              │                           │
│  [ After sending ▾ ] [ Note ]                  [ Send ⌘↵ ]   │                           │
└──────────────────────────────────────────────────────────────┴───────────────────────────┘
```

- **Left rail (own scroll):** the script list, filtered by whoever owns the ticket (Billing's on a billing ticket,
  Support's otherwise — the same `scriptsForTicket` rule as today). Search at the top, "Suggested for this category"
  first, then the department's full list, then a **Staff only** group. A row is the title plus its one-line "when";
  hovering shows the copy button. Clicking **inserts** the script into the message box instead of copying it.
- **Right column:** the thread, newest at the bottom, opening scrolled to the bottom. Then the message box and its
  toolbar. One focus, top to bottom: read, write, send.
- **Header:** one meta line and an **Actions** menu — *Unlock a badge*, *Copy email address*, *Copy ticket link*, *Copy
  a script*. The Unlock-badge card and the scripts card stop being two stacked boxes inside the ticket.

Narrow screens: the rail becomes a sheet behind a **Scripts** button, because a 300px rail on a phone leaves no room to
type.

## 2. The conversation is stored, not emailed away

New table `public.support_ticket_messages` (one row per message, additive — `support_tickets` keeps its first message):

| column | notes |
|---|---|
| `id` | uuid |
| `ticket_id` | fk → `support_tickets` on delete cascade |
| `author_kind` | `staff` \| `member` \| `system` |
| `author_id` | `auth.users.id`, null for `system` |
| `author_name` | the name shown in the thread, so a departed employee's replies still read correctly |
| `body` | 1–8000 characters |
| `internal` | `true` = staff note, never emailed, never shown to the member |
| `emailed_at` | when the member's copy left; null for a note or a failed send |
| `created_at` | |

Index on `(ticket_id, created_at)`. `support_tickets` gains **`first_reply_at`** so the queue can sort "waiting on us"
without scanning messages, and the touch trigger already keeps `updated_at`.

RLS mirrors `ticketScope`, not `is_staff`:

- Staff read/insert: `in_department(uid,'support')`, or `in_department(uid,'billing')` **and** the parent ticket's
  category starts with `Account & billing` — an `EXISTS` against `support_tickets`, so Billing can never read a support
  thread.
- Member read: their own ticket only (`ticket.user_id = auth.uid()`), `internal = false`.
- Member insert: their own ticket only, `author_kind = 'member'`, `internal = false`, same 5-per-hour limit as opening a
  ticket.
- No update or delete on messages for anyone: a sent reply is a record, not a draft. (A note can be added to correct one.)

## 3. Server side

All of it goes in `src/lib/support.functions.ts`, reusing `ticketScope` so there is still exactly one definition of who
may see a ticket.

- `listTicketThread({ ticketId })` — the ticket, its messages and the signed-in staff member's own scope. One function
  for both sides: a member gets their own thread with `internal` rows filtered out server-side, never in the browser.
- `replyToTicket({ ticketId, body, internal, then })` — staff only. Writes the row, sets `first_reply_at` once, applies
  `then` (`stay` \| `waiting` \| `resolved`), and emails the member unless `internal`. Takes a `requestId` so a double
  click or a retry never sends twice.
- `replyAsMember({ ticketId, body })` — the member's side, scoped by ownership, and it reopens a resolved ticket.
- `markThreadRead({ ticketId })` — one timestamp on the ticket for the member (`member_read_at`), so the workspace can
  show "Support replied" without a second table.

Email: one helper, `src/lib/support-emails.ts`, wrapping `emailLayout()` (the rule for every outgoing email). From and
reply-to whichever box owns the ticket — `support@` or `billing@` — subject `Re: [Ticket #AB12CD] <subject>` with a short
ticket code, body as the reply's own paragraphs, and `Idempotency-Key: reply-<messageId>`. A member replying to that
email still lands in the mailbox today; threading inbound mail back into the app is §6, not v1.

Replies never carry a new promise: the wording rule stays as it is — a typical wait, never "we will reply within".

## 4. Steps, made natural

1. Open a ticket → the thread is already scrolled to the newest message.
2. The rail opens on the scripts **suggested for that category**; typing a word filters all of them.
3. Click a script → it lands in the message box with the member's first name, the subject and the department signature
   already filled. Anything left is a clickable field, not a `{{brace}}` in the text.
4. Write or adjust. `⌘↵` sends. The **After sending** dropdown sets what happens next in the same click — *Keep open*,
   *Waiting on the member*, *Resolved* — so the old extra status select has nothing left to do.
5. The thread shows the reply immediately, the ticket list updates its status, and **J / K** move to the next ticket
   without going back to the list.

## 5. Consolidation and decluttering — the parts that remove something

Each of these deletes a control that exists today, so each needs a yes by name (§7):

| Today | After |
|---|---|
| `mailto:` "Reply by email" link | Gone from the ticket (the composer replaces it). *Copy email address* stays in Actions, so nobody loses the address. |
| Status `<select>` in the ticket body | The **After sending** dropdown in the composer, plus an "Actions → Change status" for a status that changes without a reply. |
| Status pills + kind badge + category badge above the list | One **Filter** dropdown (All · Open · In progress · Waiting · Resolved · Billing · Contact) with counts. The category still shows on the row. |
| Collapsible "Scripts for this ticket" card + "Unlock a badge" card | Script rail; Unlock badge moves into Actions. |
| "Reply by email" as the only reply path | The message box is the reply path. |

Kept as they are: the ticket's opening message, the words in `support-scripts.ts` (still the one catalog, still code),
`ticketScope` and its database twin, and the Support/Billing split.

## 6. Member side, and later

**Phase 2 — the member can answer natively.** A Support section in the workspace listing their tickets, opening a thread
read-only for `internal` rows, with the same message box. Until it exists the reply only reaches them by email, so Phase 1
and Phase 2 ship in one go: a native reply nobody can read in the app is half a feature.

**Phase 3 — the convenience pass** (each on its own, none required for v1):

- **Suggested scripts by category.** A small map in `src/lib/support-scripts.ts` from `TICKET_TOPICS` area/issue to
  script ids, so the rail's first three rows are usually the right three. Pure, testable, no database.
- **Values the ticket already knows.** First name, subject, and — on a billing ticket — the plan, last amount and date
  read from Stripe, never typed from memory. The refund rules stay in `refundVerdict`; this only fills a placeholder.
- **Internal notes** in the thread, which is what the hand-off script assumes exists. Never emailed, never readable by
  the member, not even by a signed URL.
- **Draft autosave** per ticket (`localStorage`), so switching tickets loses nothing.
- **Keyboard**: `⌘K` scripts, `⌘↵` send, `E` internal note, `J`/`K` move between tickets.
- **Search** over ticket bodies and replies, not just subjects.
- **Attachments** (a signed upload to a private bucket, the Staff Idea Box pattern). Deliberately out of v1: it doubles
  the storage questions and none of them are decided.
- **Inbound email** brought back onto the ticket (`+<code>` addressing plus a webhook). Out of scope until outbound
  threading is proven.

## 7. Decisions — answered 2026-11-08

1. **`waiting` is added**, and `resolved` is the closed state the member sees. The three original statuses stay, and the
   in-ticket status select is kept as well as the After-sending dropdown, so a status can still move without a reply.
2. **Every member-facing reply emails the member**, with a button that opens their thread on the message box (`ticketLink`).
3. **Internal notes are in v1**, stored in the same thread and never emailed.
4. **The member's Support tab ships in the same change**, so a native reply is readable in the app.
5. The `mailto:` link is gone (the founder asked for the message box instead of it); the address sits under Actions. The
   status pills are kept, with `waiting` added, because they are the list's filter.

Nothing in this plan introduces a number, a wait time or a promise the founder has not approved.

## 8. Build order

| # | Step | Who |
|---|---|---|
| 1 | Migration: `support_ticket_messages`, `first_reply_at`, `member_read_at`, RLS, indexes | Software (file); run in Supabase |
| 2 | `listTicketThread` / `replyToTicket` / `replyAsMember` / `markThreadRead` + `support-emails.ts` | Software |
| 3 | Pure helpers + tests: suggested scripts, ticket code, subject line, body limits, member-visible filter | Software |
| 4 | Composer UI: rail + thread + message box + After-sending, Actions menu, Filter dropdown | Software |
| 5 | Member Support section in the workspace, with read markers | Software |
| 6 | `⌘K` / `⌘↵` / `J` `K`, draft autosave | Software |
| 7 | Founder tests a real ticket end to end: reply, email arrives, member answers, status moves | Founder |

Files: `supabase/migrations/<new>_support-ticket-thread.sql`,
`src/lib/support.functions.ts`, `src/lib/support-emails.ts` (new), `src/lib/support-scripts.ts` (suggestions + signature),
`src/lib/support-replies.ts` (new, pure rules) + test, `src/components/SupportTicketsPanel.tsx`,
`src/components/SupportReplyComposer.tsx` (new), `src/components/SupportScriptsPanel.tsx` (compact `ScriptCard` variant),
`AGENTS.md` (the reply rule), and the member-side workspace tab.
