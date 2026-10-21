# PLAN — Done-for-you registration, delegated access & live agent queue · v1

Status: **brainstorm for approval (founder, 2026-10-20). No code written. Paddle verification comes first.**
Replaces the booking calendar and the Live Assist appointment idea (PLAN.md §3) with no appointments at all.

---

## The idea in one line
Customers **add CTA to their society accounts**, CTA registered agents **register their songs for them**, and whenever
they're logged in they can **talk to a live agent now** for a walkthrough of their own account. No calendar, no
reminders, no no-shows.

## 1. Who gets in (the "ready" gate)
A customer enters the registration work queue only when all four are true. The Expert Assistance screen shows them
as a checklist, each with a link to fix it (⚠️ never a dead end):

1. **Paid** for Expert Registration Assistance (Paddle purchase).
2. **Catalog ready**: every song in the order is Registration Ready (the shared readiness module, no new checks).
3. **Onboarding documents signed**: the customer authorization (administration agreement / letter of direction),
   signed in-app with the existing contracts engine. Lawyer review needed first (PLAN-operations §5).
4. **CTA added to their accounts** for each society in the order (§2), confirmed by an agent.

## 2. "Add us to your account" guides
One short guide per society, with a checkbox "I added Came Through Audio" and the exact email to add:

| Society | What the customer does (verify each with the society before publishing) |
| --- | --- |
| ASCAP | Member Access → add Came Through Audio as a representative / additional user |
| SoundExchange | SoundExchange Direct → add Came Through Audio as a guest user |
| The MLC | The MLC Portal → add Came Through Audio as a user on their member account |
| BMI | Check what BMI Online Services allows before offering it; otherwise CTA prepares the registration file and the customer submits it on the live walkthrough |

Rules:
- **Never ask for or store a customer's password.** Only delegated access the society itself provides.
- Use a **company-owned inbox** (e.g. registrations@camethroughaudio.com on Google Workspace) as the CTA user on every
  society, never a staff member's personal email, so access stays with the company when staff change.
- Each guide has screenshots, a "Where do I find this?" tip, and a link to the society's login page.
- When the work is done, the customer can remove CTA's access; the guide shows how.

## 3. Agent work queue (Registration department, Admin → Registration Queue)
- Orders appear once the gate in §1 is complete, oldest first.
- Each order shows: songs, societies, access status per society, the customer's readiness report.
- Agent claims an order, registers each song, and records the result per society (work ID or "pending").
  Those results feed the customer's **Royalty Health Check** automatically (repertoire_checks), so the health
  report turns green as work lands. One data flow, no double entry.
- Customer sees live status: Waiting · In progress · Registered (with work IDs) · Needs your help (with the fix link).
- Quality: leads re-check 10% of orders (PLAN-operations §2).

## 4. Live agent now (instead of appointments)
- Live time is bought separately in "How It Works" packs (below); registration orders don't include it.
- Whenever the customer is logged in and an agent is available, a small banner shows:
  *"Speak with a live agent now."* with the minutes left in their time bank, **Start now** and **Not now**.
- **Start now** puts them in the live queue with their position ("You're next", "2 ahead of you"). When an agent
  accepts, a video call with screen share opens inside the app (Daily.co, as planned for Live Assist).
- **Agents set themselves Available** and a capacity (e.g. 1 live call at a time). The banner only appears when
  someone is free, so nobody waits long.
- No appointments, so nobody can miss one: the "I missed my appointment, refund me" problem goes away.
- Time is tracked by the minute; one pack can cover several shorter calls.

### Live "How It Works" time (founder decision, 2026-10-20: a separate charge)
Registration itself is done by CTA agents for the client. Live time is a separate, optional purchase: "How It Works"
blocks where an agent walks the client through their own society accounts. The client joins the live queue whenever
an agent is free and can use the time any time within 12 months of buying it.

**Suggested pricing ($1 a minute, with a small discount for bigger packs):**

| Pack | Price | Per minute | CTA keeps after Paddle's fee (≈5% + $0.50) |
| --- | --- | --- | --- |
| 15 minutes | $15 | $1.00 | ≈ $13.75 |
| 30 minutes | $25 | $0.83 | ≈ $23.25 |
| 60 minutes | $45 | $0.75 | ≈ $42.25 |

- **Minutes, not whole blocks:** a 9-minute call uses 9 minutes; the other 6 stay in their time bank. Fair, and it
  feels affordable.
- **Bought on the spot:** "Start now" with an empty time bank opens Paddle checkout with the three packs; after payment
  they go to the front of the queue. Paid before the call, never after (Paddle can't charge later for minutes used).
- **Cost check:** an agent at about $20 an hour costs about $5 per 15-minute call, plus a few minutes of notes, so each
  pack covers the agent's time with room to spare. Revisit once real call lengths are known.
- **Optional member perk (later):** Catalog Management includes one free 15-minute block a year.
- **Refunds:** unused time is refundable within 30 days of purchase; used minutes aren't. Check with the lawyer how
  long prepaid time must stay usable (some states limit expiry dates on prepaid credit).
- Paddle prices needed: `live_time_15`, `live_time_30`, `live_time_60` (one-time).

## 5. Fastest path to something working
| Step | What | Code? |
| --- | --- | --- |
| 0 | Paddle verified and live (below). Company registration inbox. Lawyer-reviewed customer authorization. | No |
| 1 | §1 checklist + §2 guides on the Expert Assistance screen | Small |
| 2 | §3 agent work queue, results feed the Health Check | Medium |
| 3 | §4 live queue banner + in-app video | Medium (Daily.co account needed) |

Step 1 + 2 already make the service sellable with no appointments. Step 3 can follow.

## 6. Paddle verification (blocking everything paid)
Status from the roadmap: website review rejected; business and identity verification not started.

1. **Business verification** (Paddle dashboard → Business account / verification): legal name *Came Through Audio,
   LLC*, address 789 Garden Walk Blvd, Atlanta, GA 30349, EIN, website, what you sell.
2. **Identity verification**: the account owner uploads a photo ID through Paddle's ID check.
3. **Website review**: reviewers must be able to open the site. **The whole site is currently behind the
   pre-launch passcode**, which is the most likely reason the review was rejected. Options:
   - (a) Ask Paddle support whether the reviewer can use the passcode (put it in the review notes), or
   - (b) Open only the pages Paddle checks (homepage, plans & pricing, terms, privacy, refund policy, contact) while
     the workspace and admin stay locked, and keep search engines blocked (noindex stays). Signup on the homepage
     can be hidden until launch.
4. Pages Paddle looks for: clear product descriptions, prices, Terms naming Paddle as merchant of record (done),
   Refund Policy, Privacy Policy, contact details, and a business name that matches the Paddle account.
5. Read the exact reasons in Paddle's rejection email and fix each one before resubmitting.
