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

## The year worksheet: what it would take (nothing built)

The worksheet is keyed to the open song — `cta.lab.v1.<userId>.<songId>.tax` — because that is how the rest of the
Lab is keyed. But a member's real question is annual: "what did I spend on music this year, and what is it worth?"
Half a year's costs are not per song at all (a distributor fee, a laptop, a subscription, a rehearsal room), and a
preparer does not want one file per song.

Moving the worksheet to a year is a **keying change plus a project tag on each row**, not a rewrite: the row model,
the drawer, both CSV writers and the after-tax readers stay. The work is in the decisions below, not in the code.

### What changes

| Piece | Change |
| --- | --- |
| `financial-lab-tax.ts` | Rows gain a project tag; the sheet gains a year identity; a key builder for the year; a reader for "which years exist"; per-project subtotals. Pulling must sync **within one project**, so pulling song B never removes song A's pulled lines. |
| `use-tax-sheet.ts` | Keyed by member + year instead of member + song. Same write-on-change pattern. |
| `RoyaltyUtilitySuite.tsx` | The hook moves out of the song-scoped block; the year becomes Lab state; the drawer no longer gets a song title for its heading. |
| `LabTaxDrawer.tsx` | Year selector, a project column or sections, "pull this song's lines", an import from a per-song worksheet, and a copy pass. |
| CSV writers | The worksheet CSV gets the year in its title and filename, a Project column and (if approved) per-project subtotals. `projectionCsv` needs the per-song-vs-year decision below. |
| Budget Planner / Recoupment | **No code change** — they take a number. They would read the year's rate, which is more correct than a per-song rate. |

### Storage implications

- **A new key prefix, not a reinterpretation of the old one.** `cta.lab.v1` carries the song in the key, so a year
  cannot reuse it without risking a song id that looks like a year (and `manual` is a real key today). A separate
  prefix — proposed: `cta.lab.tax.v1.<userId>.<year>` — keeps every saved per-song worksheet readable and rewrites
  nothing.
- **Existing per-song worksheets do not move by themselves.** Three options: leave them and add an explicit
  "bring this song's lines into 2026" (copies, does not move); a one-time migration with a confirm; or silent
  aggregation. Silent aggregation is the one to refuse: a cost entered under two songs would double-count and the
  member would never see it happen.
- **One rate per year.** A marginal rate belongs to the year, not the song; storing it once also removes the current
  oddity where two songs could disagree about the same member's rate.
- **A conflict the per-song scheme was hiding.** Two browser tabs on two different songs would now write the same
  key, so the last write wins. Nothing in the Lab syncs across tabs today; this change turns a non-issue into a
  visible one. The honest answer is a stated limitation ("one tab at a time"), not a sync engine.
- **Size is not the problem.** A busy year is a few KB against the browser's multi-megabyte quota. The row cap is:
  **40 is too low for a year**; the exact ceiling (a proposal was 120, **undecided**) is a number the founder signs
  off, or the cap stays and a long year overflows.
- **Clearing and carrying over.** A year sheet needs "clear this year" and ideally "start from last year". Both are
  new destructive actions and need confirmation copy; only per-row delete exists today.
- **Sensitivity goes up.** A year worksheet is a fuller picture of someone's business than one song's costs. It stays
  browser-local and per member. A saved table, cross-device access or a preparer share would be the open database
  decision, not a link handed out.

### Copy implications

- **The scope has to be said out loud.** "Common costs artists track" becomes "costs you paid this tax year, across
  every song"; the result labels become "This year's deductible total" / "Estimated tax savings"; the count line
  gains the year.
- **The tax year stops being an optional note and becomes the sheet's identity.** That carries a caveat we must not
  assert: which year a cost belongs to is the preparer's call. "Counted in the year you paid it" would be a rule
  claim — the copy says "the year you're planning", and the disclaimer stays as it is.
- **The other two panels get simpler.** "Your 30% rate from the tax worksheet" is now unambiguously the year's rate.
- **The downloaded worksheet changes title and filename** — `2026 tax worksheet.csv`, "TAX WRITE-OFF WORKSHEET —
  2026", "Projects: 3 songs" instead of "Song:", and a Project column. The disclaimer sentence stays verbatim.
- **The projection CSV is the real decision.** It is a per-song file and currently appends the worksheet's total. On a
  year sheet that would repeat a year-wide figure on every song's file, and anyone joining the files would inflate
  the total. The clean shape is this song's worksheet lines in the file, with "Year total (all songs)" beside it as
  context — never a per-song amount that is really the year's.
- **Pull and import copy gains scope**: "Pulls this song's paid budget lines into 2026 — switch songs and pull again
  to add theirs"; the import says it copies lines and leaves the per-song worksheet where it is.
- **Where the drawer lives is a copy question too.** It sits in the Royalty panel's aside, beside one song's
  telemetry. A year-wide worksheet is readable there if it is labelled, but "money spent this year" arguably belongs
  in the Budget Planner tab. That is a layout call for the founder.

### Open decisions (all undecided)

1. **Year on open** — default to the current year, or open on a "choose your tax year" step?
2. **Existing per-song worksheets** — import button (proposed), confirm-and-migrate, or left out of the year view?
3. **Where the year sheet lives** — the existing drawer with a year label, or its own place in the Budget Planner?
4. **Project tag** — picked from the open song, free text, or a "No song" bucket plus a song picker?
5. **Row cap and subtotals** — the ceiling for a year, and whether per-project subtotals print in the CSV.

### Size

Roughly the same as the round just shipped: one storage/model module with tests, the hook and Lab state change, a
drawer rework (year selector, grouping, import, clear), two CSV writers and about fifteen to twenty tests — plus
whichever layout decision (3) the founder makes. No backend work: the cross-device and preparer-sharing questions
stay in the undecided pile.

## Undecided / for the founder

- **The year worksheet.** All five questions are open; see [The year worksheet](#the-year-worksheet-what-it-would-take-nothing-built)
  below. Nothing there is built or promised, and the numbers in it (a row cap, a default year) are proposals, not decisions.
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

## The rate dropdown, self-employment tax and a table that rolls over (founder, 2026-11-25)

The rate was a number box the member typed from memory. The founder's words: _"make the marginal rate a drop down
for 2026 so users can pick their range based on their income"_, _"another option for them to choose self employment
tax"_, _"give instructions with steps just like the rest of the financial lab"_, and _"let's make this automatically
updates itself every year. Can a cloudflare worker do this."_

### What it does now

- **The rate is picked, not typed.** Step 1 sets the tax year and the filing status; step 2 lists that status's seven
  income ranges from the year's chart (`22% · $50,401 – $105,700`). Picking a row sets the marginal rate. A rate saved
  on an older sheet that is not in the chart stays selectable as its own option, so nothing is silently dropped.
- **Four numbered steps**, the same `fl-step-label` pattern as the Budget Planner and the royalty panel: year and
  filing status → income range → the costs → self-employment tax. Every control and hint that was there before is
  still there, inside its step.
- **Self-employment tax is a choice.** `Not self-employed` (income tax only), `~14.13%` (15.3% of net earnings on
  92.35% of them, while the Social Security part applies) or `~2.68%` (above the Social Security cap, where only the
  2.9% Medicare part is left). The estimate, the results block and the CSV all show the two parts separately and then
  the total, so the arithmetic is checkable.
- **The chart is data, keyed by year** (`src/lib/tax-brackets.ts`). 2026 is the table the founder supplied; 2027 is
  the IRS's own published table (Rev. Proc. 2026-35, released 2026-11-05, with the 2027 Social Security wage base of
  $192,300). A blank tax year plans on the calendar year, so the drawer moves to 2027 by itself on January 1 with
  nothing scheduled and nothing retyped. The source is printed beside the dropdowns and in the CSV.
- **The downloaded worksheet** gains `Brackets:`, `Filing status:`, a `Self-employment tax at 14.13%` line and the
  combined rate on the savings line. The projection CSV labels the same figure `… + 14.13% self-employment`.
- **The after-tax readers follow the same rate.** The Budget Planner and the Recoupment panel now use the bracket's
  rate plus the self-employment part, so a cost's after-tax figure cannot disagree with the drawer.

### The Cloudflare Worker

A Worker can hold the table and a new tax year can reach every member without rebuilding the app, so
`workers/cta-tax-tables.ts` (config `workers/wrangler-tax.toml`) does exactly that:

| Piece | What it does |
| --- | --- |
| `GET /tax` | Every year it holds (`years`, `newestYear`), today's `activeYear`, `needsUpdate`, and the tables themselves |
| `GET /tax/<year>` | One year's table, or 404 |
| `PUT /tax/<year>` | Adds or corrects a year, `Authorization: Bearer $TAX_ADMIN_TOKEN`, stored in the optional `TAX_TABLES` KV namespace |
| `scheduled` (Jan 1) | Re-reads the years held, records whether the calendar has moved past the newest table (KV `status`, and the log) |

The app reads it only when `VITE_CTA_TAX_TABLES_URL` is set (`src/components/use-tax-tables.ts`), caches the answer
for a day, and keeps the bundled table when the Worker is unset, offline, or answers with anything incomplete — a
year is accepted only when all six thresholds for all three statuses are present and in order. Origin-locked with the
same rule as the Help Desk Worker.

**What it deliberately does not do: invent a year.** The thresholds move every year with the IRS's inflation
adjustment, so the cron never extrapolates the next year from the last one; a year it has not been given is reported
as `needsUpdate: true` and the drawer names the year it is actually using. Parsing the IRS PDF automatically was
considered and refused for now: a wrong tax figure is worse than an eleven-month-old one, so the new year arrives as
an approved table (a bundled entry, or one `PUT`), and 2027 is already in place.

### Verified

`bun run build`, `npx tsc --noEmit`, the full `vitest` suite (1470 tests, 49 of them on the tax worksheet and the
chart) and `npx wrangler deploy --dry-run -c workers/wrangler-tax.toml` (bundles at 9.47 KiB). The Worker was not
deployed from this workspace — there are no Cloudflare credentials here — so `VITE_CTA_TAX_TABLES_URL` is unset and
the bundled tables are what the app uses today.
