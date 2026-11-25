# Budget sheet exports (Financial Lab)

The Production Budget Planner's download button is a menu with three choices (founder, 2026-11-25):

| Choice | File | What it can do |
| --- | --- | --- |
| Fillable PDF | `«project» budget.pdf` | The one-page sheet with a text field over every line's **Actual**, so a member can type what was really paid into the PDF itself. |
| Google Sheet | `«project» budget.xlsx` | Opens in Google Sheets (File → Import → Upload) with the totals as live formulas. |
| Excel sheet | `«project» budget.xlsx` | Opens in Excel with the same live formulas. |

Both spreadsheet choices write `.xlsx` because it is the one format Excel and Google
Sheets both open with formulas intact; there is no Google-Sheets-only file format to
download. The choice changes what the file says about itself and what the toast tells the
member to do, never the arithmetic.

## What the PDF can and cannot calculate

A PDF *can* hold real calculations, and it is worth saying exactly how, because it decides
whether we ship it:

- A text field alone stores a value; it does not compute anything.
- AcroForm fields can carry **calculation actions** (`/AA` → `/C`, the classic
  `AFSimple_Calculate("SUM", …)` script, or any JavaScript). Acrobat evaluates those and
  redraws the dependent field whenever an input changes.
- **Adobe Acrobat and Acrobat Reader run that JavaScript. Chrome's built-in viewer, Safari,
  Firefox's pdf.js, macOS Preview and most phone viewers do not.** They show and accept the
  field values but the total stays exactly as it was written when the file was made.

So a PDF with PDF-side maths would be right for members on Acrobat and silently stale for
everyone else — the worst kind of wrong on a document that tracks money. We have also no
Acrobat in this environment to verify the actions behave, and an unverified calculation is
not something to put in a budget sheet a member shows a director.

What ships today, therefore:

- **Fillable PDF**: every checklist line has an editable **Actual** box, prefilled with the
  number the planner already knows (a typed actual, or the budget for a paid line with no
  typed cost). The **Total** row prints the budgeted total, the actual total and "n of m
  paid" as they stood when the file was downloaded. Typing in the boxes does **not** move
  that printed total, and the PDF does not change what the planner has in the browser.
- **Spreadsheet**: typing an Actual recalculates everything, in Excel and in Sheets alike.

If PDF-side maths is wanted later, the path is clear and should be a founder decision:

1. Add `/AA` calculate actions to the field set `buildFillableBudgetPdfBytes` already
   creates (`actual-1…n`), with a read-only total field.
2. Keep the spreadsheet as the option we point people to for real recalculation, because
   the PDF's maths only exists inside Acrobat.
3. Verify in Acrobat itself before it ships — the fallback where the total is stale must be
   described in the file, not implied.

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

Checked by recalculating the downloaded file with a spreadsheet engine: cap $1,000, one
line paid $420.50 → spent $420.50, remaining $579.50, "1 of 5 paid"; typing `100` into the
next line's Actual → spent $520.50, remaining $479.50, that line flips to `PAID`, and the
count reads "2 of 5 paid".
