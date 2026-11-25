# Budget sheet exports (Financial Lab)

The Production Budget Planner's download button is a menu with three choices (founder, 2026-11-25):

| Choice | File | What it is |
| --- | --- | --- |
| Fillable PDF | `«project» budget.pdf` | The sheet as a form: an Actual cell on every line, a Paid tick beside it, and the totals as fields that recalculate. |
| Google Sheet | `«project» budget.csv` | A plain `.csv` Google Sheets reads straight into a spreadsheet, with the totals as live formulas. |
| Excel sheet | `«project» budget.xlsx` | A styled workbook: frozen checklist header, both sheets, currency formats, the same formulas. |

The two spreadsheet choices are **different files on purpose** (founder, 2026-11-25). Before this they both
wrote the same `.xlsx`, so "Google Sheet" was a second download of the Excel file. Now:

- **Excel** gets `.xlsx` — two worksheets, formatting, frozen header, currency number formats.
- **Google Sheets** gets `.csv` — Google's own interchange format, so it lands in a real Google Sheet
  (sheets.new → File → Import → Upload) instead of an Excel file that Sheets merely tolerates. Being plain
  text it has no styling and no second tab; the allocation sits under the checklist with a blank line
  between them. Its formulas are the same ones the workbook carries, written as cell text that starts with
  `=`, so they evaluate on import (Sheets' "Convert text to numbers, dates, and formulas" box is ticked by
  default).

A truly pre-filled Google Sheet in the member's own Drive would need their Google account connected to us;
nothing here does that, and a download cannot write into someone's Drive on its own.

## The fillable PDF: what changed and why

The first fillable copy had two faults, both reported by the founder on 2026-11-25:

1. Typing an Actual left the line printed `ESTIMATED`, because that word was page content drawn at download.
2. The checklist's total stayed exactly as it was at download, because it was page content too.

Both are fixed by making the sheet a **form** rather than a print with boxes stuck on it:

- **Actual** is a real text field on each line, and the field draws its own light cell and hairline frame,
  so the box the member clicks *is* the input — there is no printed rule underneath it any more.
- **Paid** is a tick box per line, ticked or not as the planner had it. It replaces the frozen
  `ESTIMATED`/`PAID` word: the member works the tick, so it can never contradict what they typed.
- **Spent so far**, **Remaining**, the checklist's **actual total** and the **paid count** are fields
  carrying Acrobat calculation actions (`/AA` → `/C`, JavaScript) with a calculation order (`/CO`) set, so
  typing an Actual, or ticking a box, recalculates all four.
- Nothing on the form is pre-printed for a figure that depends on typing. Those cells start empty and are
  filled by the calculation (or by hand, in a viewer that does not calculate), so a stale number can never
  sit next to a freshly typed one.
- One line in the form says where the sums happen: "Actuals and ticks total themselves in Adobe Acrobat or
  Reader." The printed sheet (`buildBudgetPdf`) is unchanged and still prints every figure it always did.

### The limit, stated plainly

A PDF **can** calculate, but only Acrobat and Acrobat Reader run the JavaScript:

- **Adobe Acrobat / Reader** evaluate the actions and redraw the fields, so the totals follow the typing.
- **Chrome's and Edge's built-in viewer (PDFium), Firefox (pdf.js), Safari/Preview (PDFKit) and most phone
  viewers ignore form JavaScript.** They show and accept the field values, but a calculated field simply
  stays empty. That is why nothing is pre-printed in those cells: an empty cell is incomplete, not wrong.
- We have no Acrobat in this environment, so the actions are checked as far as structure and script syntax
  go (`budget-xlsx.test.ts` parses every script) but not inside Acrobat itself. Nothing here claims they
  were observed recalculating.

For a total that recalculates in every app, the spreadsheet is the answer — that is what the other two
choices are for.

## The workbook's formulas

Sheet **Budget** (`src/lib/budget-xlsx.ts`):

| Cell | Formula |
| --- | --- |
| `B5` Spent so far | `=SUM(D9:D13)` — the Actual column |
| `B6` Remaining | `=B4-B5` |
| `E9…E13` Status | `=IF(D9="","ESTIMATED","PAID")` |
| `C14` Total budgeted | `=SUM(C9:C13)` |
| `D14` Total actual | `=SUM(D9:D13)` |
| `E14` Paid count | `=COUNTIF(E9:E13,"PAID")&" of "&COUNTA(A9:A13)&" paid"` |

Sheet **Where the money goes** carries the plan's split, with `=SUM(C2:C6)` as its total.

The **CSV** (`budgetSheetCsv`) uses the same rows, so the same formulas read the same cells: rows 4–6 are
the live figures, row 8 the checklist header, row 9 the first line, and the checklist's total sits under
the last line. Its formula cells are quoted only where CSV requires it (a formula containing a comma), and
amounts are written as plain numbers — `420.5`, never `$420.50` — so Sheets reads them as numbers.

Checked by recalculating the downloaded workbook with a spreadsheet engine: cap $1,000, one line paid
$420.50 → spent $420.50, remaining $579.50, "1 of 5 paid"; typing `100` into the next line's Actual → spent
$520.50, remaining $479.50, that line flips to `PAID`, and the count reads "2 of 5 paid".
