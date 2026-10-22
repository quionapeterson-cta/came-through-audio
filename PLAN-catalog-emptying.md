# PLAN — Empty the catalog after a plan ends, with a grace period · v2

Status: **v1 (emptying, §1–8) approved 2026-10-21. v2 (§9–12) answered 2026-10-21. BUILT 2026-10-22 except the policy pages (§7, §13), which wait for wording approval.**
Source: founder request, 2026-10-21 (Refund Policy already says "once a plan ends its catalog is emptied, so download first").

---

## 1. The rule in one line
When someone no longer has a paid plan, their catalog stays **read-only and downloadable for 30 days**, with reminder
emails. If they don't renew, the catalog is emptied on day 30. Renewing at any point in the 30 days keeps everything.

## 2. What starts the 30 days
| Situation | Grace starts |
| --- | --- |
| Cancelled in Manage billing | The day the paid year ends (they keep full access until then) |
| Renewal payment fails and isn't fixed | The day Stripe ends the plan |
| Refund | The day of the refund (the plan ends right away) |
| Free 30-day Collaborate trial for invited collaborators ends | The day the trial ends |
| Switching to a cheaper plan (e.g. Management → Plus) | **Never.** They still have a plan; nothing is emptied |

Super admins and staff accounts are never emptied.

## 3. What is emptied, and what is kept
**Emptied:** every song in My Catalog (all its details and writer credits), its stored master and artwork, and that
song's Royalty Health results.

**Kept (recommended):**
- The account itself, profile, artist name and badges. They can come back any time on a plan.
- **Signed split sheets.** Collaborators signed them and rely on them, so they stay readable for everyone who signed.
- **Signed contracts** in the vault, for the same reason (other parties signed).
- **AI Protection certificates.** Paid for separately, and they're proof of timing. Deleting them would undo what was bought.
- Purchase and payment history (needed for taxes and refunds).

## 4. During the 30 days
- **Banner in the workspace:** "Your plan ended. Your catalog will be emptied on November 20, 2026. Download
  everything now, or renew to keep it." with **Download my catalog** and **Renew** buttons.
- **Read-only catalog:** songs can be viewed and downloaded, not added or edited.
- **Download my catalog (new, one click):** a ZIP with every master MP3 (named `Song Title.mp3`), artwork, lyrics and
  the catalog PDF.

## 5. Emails (all through `emailLayout()`)
| When | Email |
| --- | --- |
| They cancel (plan still running) | "Your plan ends on DATE. Download your catalog before then; we keep it 30 days after that." |
| Day 0 of grace | "Your plan ended. Your catalog will be emptied on DATE." |
| 7 days left | Reminder |
| 1 day left | Last reminder |
| Emptied | "Your catalog was emptied today. Your account, badges, signed split sheets, contracts and certificates are still here." |

## 6. How it works (technical)
- New table `catalog_lapses` (user, plan ended at, empty-after date, which reminders were sent, emptied at, how many
  songs). One migration, nothing existing changed.
- A daily job (same protected cron setup as the trial reminders) finds accounts with songs and no active plan,
  starts their 30 days, sends due reminders, and on the date empties the catalog using the server's admin access.
  It re-checks the plan right before deleting, so a renewal that arrives that morning still wins.
- Renewing clears the lapse.
- The payment webhook sends the "you cancelled" email when Stripe reports a cancellation.

## 7. Policy pages (preview before publishing)
- Refund Policy: add "We keep your catalog for 30 days after a plan ends, then empty it."
- Terms §8 and Privacy §6 (Retention): same 30-day rule, and what is kept (§3).

## 8. Project rule that needs your OK
AGENTS.md says **"Never delete or overwrite existing writer data."** Emptying a catalog deletes writer credits, so
this needs a written exception: *"except when a catalog is emptied 30 days after its plan ends, as the Refund Policy
states."* It changes only with your approval.

## 8a. Plan A, then plan B (founder, 2026-10-22)
- **Plan A, renewal reminders:** emails 90, 60, 30, 7 and 1 day before a yearly plan renews (not for plans already cancelling). Built.
- **Plan B, Need more time and Pause:** offered only when someone tries to cancel (Cancel plan screen), when a renewal
  payment fails (email on the first failed attempt and Stripe's third, plus a banner with Update card), and during
  the 30-day countdown after a plan ends. No standalone buttons otherwise. Built.

## 8b. Renew now (founder, 2026-10-22)
- Profile → **Renew now** (and the button in every renewal reminder email) pays next year early at the plan's own price.
  The next charge moves a full year past the current renewal date, so no days are lost. One year ahead at a time; not
  while cancelling, failing or paused. Refundable within 30 days of paying; a full refund puts the renewal date back. Built.
- Refund Policy line: added 2026-10-22 (approved).

## 9. Need more time (renewal extension)
- **Who:** anyone on a paid yearly plan, from 30 days before renewal until a failed renewal is fixed.
- **What:** the renewal date moves back **30 days**, free. Full access continues. **Once every 12 months.**
- **How:** Stripe pushes the next charge back (the subscription's `trial_end` moves to the new date). The webhook updates
  the renewal date shown in Profile. Email confirms the new date.

## 10. Pause with the Vault fee
- **Who:** same window as §9 (around renewal, or while a renewal payment has failed). **Once every 12 months.**
- **What:** no plan charge for **1, 2 or 3 months**. The catalog is **read-only and kept safe** (view and download,
  no adding or editing). The emptying countdown never starts during a pause.
- **Vault fee:** **$1.99 per month of pause, paid up front** at checkout (1 month $1.99, 2 months $3.98, 3 months $5.97).
  Not refundable once the pause starts. New Stripe price, lookup key `vault_month`.
- **When it ends:** the plan resumes and the renewal is charged automatically. **Resume now** in Profile ends it early
  (renewal charged that day). If that renewal fails, the normal failed-payment steps (§11) apply.
- **How:** new table `account_pauses` (who, kind, start, end, Vault payment). Stripe pushes the renewal back by the
  paused months; the app's tier check (`user_tier`) treats a paused account as Free for features, and the emptying job
  skips it.

## 11. Failed renewal payments
- Stripe retries the card for about **3 weeks** (Smart Retries). Full access continues meanwhile ("past due").
- Emails: "Your renewal didn't go through. Update your card" with a **Manage billing** button, plus a reminder; both
  mention Need more time and Pause.
- If it's never fixed, Stripe ends the plan and the 30-day emptying countdown (§1) starts.

## 12. Cancel screen (offers before cancelling)
- Profile gets its own **Cancel plan** button. Before confirming it shows, in order: **Need more time**, **Pause**, and
  **Switch to Catalog Plus** (if on a higher plan), then **Cancel anyway**. Offers already used this year are hidden.
- Cancelling keeps access until the paid year ends, then §1 applies. The "Your plan ends on DATE, download first" email goes out.
- So cancelling always passes the offers, **turn off "Cancel subscriptions" in the Stripe customer portal**
  (card, invoices and plan switching stay there).

## 13. Policy pages (preview before publishing)
Terms and Refund Policy add: Need more time (30 days, once a year), Pause (1–3 months, once a year, Vault fee $1.99/month
up front, non-refundable once started, catalog read-only), and the 30-day emptying rule.

## Questions (v1 answered: 30 days · keep those records · trial follows the rule · AGENTS.md exception approved)
1. 30 days of grace? (Recommended. Long enough to download, short enough that storage isn't held indefinitely.)
2. Keep signed split sheets, signed contracts and AI Protection certificates (§3)?
3. Should the free Collaborate trial for invited collaborators follow the same rule when it ends?
4. Approve the AGENTS.md exception wording (§8)?

v2:
5. Vault fee $1.99 per month, paid up front, non-refundable once the pause starts? **Yes (2026-10-21).**
6. Window for Need more time and Pause: from 30 days before renewal until a failed renewal is fixed? **Answered 2026-10-21: from 30 days before renewal, through a failed renewal, and through the 30-day countdown to emptying (until the catalog is emptied).**
7. OK to turn off cancelling inside the Stripe portal so every cancel goes through the offers screen? **Yes (2026-10-21).**

## Files
New: migration (`catalog_lapses`), `src/lib/catalog-lapse.server.ts`, `src/routes/api/public/cron/catalog-lapses.ts`,
`src/components/CatalogLapseBanner.tsx`, Download my catalog (ZIP) in `src/lib/catalog.ts`, tests.
New (v2): migration additions (`account_pauses`, `user_tier` pause rule), `src/lib/retention.functions.ts` (extend, pause
checkout, resume, cancel), `src/components/CancelPlanDialog.tsx`, tests.
Changed: `src/routes/profile.tsx` (Need more time, Pause, Resume, Cancel plan), `src/routes/workspace.tsx`, `src/components/MetadataUploader.tsx` (read-only mode),
`src/routes/api/public/payments/webhook.ts` (cancel email), the three policy pages, `AGENTS.md`.
