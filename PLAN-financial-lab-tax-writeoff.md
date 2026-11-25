# The artist tax write-off worksheet (Financial Lab)

The Financial Lab's drawer was one box: **Deductible expenses ($)** and **marginal rate (%)**, multiplied
together. It forgot both numbers as soon as the page reloaded, and it had no relationship to anything else
in the Lab — even though the member may have just ticked half a budget as paid two tabs away.

This round turns it into a worksheet (founder, 2026-11-25): a dropdown of typical music-business costs, an
amount on each line, a total, and the same estimate carried into the projection CSV. The founder's words:
_"provide a drop down of typical things artist can write off so they can add how much they've spent on each to
come up with their deductible."_

## What it does now

- **A line per cost, from a dropdown.** Each line picks a category (studio time, mixing, gear, travel, merch
  production, …) and takes an amount. The deductible total is the sum of the amounts; the estimate is that
  total at the member's own rate. There is no preset amount and no invented rate anywhere.
- **The rows are the worksheet.** One aggregate number cannot be checked; a list can. `Something else` gives
  a line its own wording, so a cost outside the list is still recorded instead of being forced into a
  category that does not fit.
- **Paperwork per line.** A `Receipt` tick on each row is the member's own note that they have the invoice,
  receipt or contract. It is a memory aid, not a claim that the cost qualifies.
- **It remembers.** The worksheet (rows, rate, tax year) is saved in the browser per member and per song,
  on the same local store as the rest of the Lab. The break-even drawer now remembers its two numbers too.
- **Pull from my budget.** The lines ticked **paid** in the Production Budget Planner come across with their
  actual cost, mapped to the nearest category. Pulling again updates those lines from the budget, removes
  the ones that are no longer paid, and leaves the member's own lines alone — so a pull is a sync, not a
  duplicate.
- **It leaves the Lab.** `Download worksheet (.csv)` writes the itemised sheet with the total, the estimate
  at the member's rate and the disclaimer on it. The projection CSV carries a **Deductible expenses** and
  **Estimated tax savings** block for the open song.
- **It reaches the decision.** Where the member is already deciding what to spend — the Budget Planner's
  live checklist and the Recoupment panel — a line shows what that spend is estimated to leave after the
  rate in the worksheet, and what is left to earn back.

## The category list

The list is prompts, not rules. Each category carries a plain-language hint saying what it usually covers
and, where it matters, that only the music share belongs on the line (a phone bill, a home studio).
Whether any of it qualifies where the member files, and how much of it, stays the tax professional's call.

Studio time and recording · Session players and engineers · Mixing, mastering and vocal editing ·
Instruments and studio gear · Plugins, software and subscriptions · Home studio share ·
Music videos and photo shoots · Cover art, design and merch samples · Distribution and platform fees ·
Registrations and membership dues · Ads, marketing and PR · Travel to sessions and gigs ·
Show and release event costs · Rehearsal space · Legal and accounting ·
Management and agent commission · Lessons, courses and workshops · Phone and internet share ·
Merch production · Something else.

Adding a category is data, not a new screen: one entry in `TAX_CATEGORIES` in
`src/lib/financial-lab-tax.ts`, and the dropdown, the worksheet and the CSV all pick it up.

## What it deliberately does not do

- **No rates of ours.** The rate is typed by the member. No country table, no brackets, no "typical rate".
- **No filing, no forms, no advice.** No IRS/HMRC form numbers, nothing that looks like a return, and every
  surface that shows the estimate carries the estimate wording. The drawer's own hint: _estimate only, your
  tax professional decides what qualifies and your actual rate._
- **No business-share arithmetic.** A shared cost is entered as the music share only, and the hint says so;
  a percentage column would imply a precision about mixed use that we cannot stand behind.
- **No server storage.** The worksheet lives in the browser with the rest of the Lab. A saved-worksheet
  table (cross-device, per year, shared with a preparer) is **undecided** and would need the founder's
  decision on the database and on who may read it.
- **No PDF worksheet yet.** The CSV hands a preparer the itemisation. A branded PDF is **undecided**; it
  would reuse the budget sheet's print layout and is worth doing only if the founder wants the same
  branded artifact for tax planning.

## Undecided / for the founder

- Whether the worksheet should also be available for a **member-level year** instead of per song.
- Whether a **professional review** of the category list and hints is wanted before it is described
  anywhere as tax guidance (it is not described that way today).
- Whether the estimate belongs in the **full report copy** (the "Copy Breakdown" text) as well as the CSV.
  It is in the CSV now because that is the file the founder named.

## Where it lives

| Piece | File |
| --- | --- |
| Categories, rows, total, estimate, pull, sanitise, CSV | `src/lib/financial-lab-tax.ts` |
| Worksheet UI, dropdowns, download, receipt ticks | `src/components/LabTaxDrawer.tsx` |
| Budget plan persistence + paid lines for the pull | `src/lib/financial-lab-budgets.ts` |
| Projection CSV tax block | `src/lib/financial-lab-copy.ts` (`projectionCsv`) |
| The after-tax line in the Recoupment panel | `src/components/RoyaltyPipeline.tsx` |
| The after-tax line in the Budget Planner | `src/components/LabBudgetPlanner.tsx` |
| Wiring, keys, drawer shell | `src/components/RoyaltyUtilitySuite.tsx` |

Storage keys (all `cta.lab.v1.<userId>.<songId>.<part>`): `tax` for the worksheet, `budgetPlan` for the
planner's plan, `breakeven` for the release break-even check.
