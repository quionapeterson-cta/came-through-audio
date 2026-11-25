# Updating the federal tax tables

The Artist Tax Write-Off Estimator prices a year from a year-keyed bracket table. There are two copies, and the live one
wins: the tax Worker's tables (the version bundled into the Worker plus anything stored in its `TAX_TABLES` KV
namespace), then the fallback bundled in `src/lib/tax-brackets.ts`. A year nobody holds is priced with the newest table
at or before it, and the drawer says so above the figures instead of quietly using last year's brackets.

The Worker is `cta-tax-tables` (`workers/cta-tax-tables.ts`, config `workers/wrangler-tax.toml`), served at
`https://cta-tax-tables.quionapeterson.workers.dev`. The app reads it through `VITE_CTA_TAX_TABLES_URL`.

## Once a year, when the IRS publishes the inflation adjustments

Five minutes, no build and no redeploy.

1. **Get the figures** from the year's IRS revenue procedure (the annual inflation-adjustment Rev. Proc.). Nothing is
   taken from a news article, a projection or last year's table.
2. **The founder approves that year's numbers first.** Every figure the estimator prints is one the founder has
   approved; until then the year is a draft and does not go in the Worker.
3. **Write the body** for the new year:

   ```json
   {
     "year": 2028,
     "source": "IRS Rev. Proc. <the year's own number> (<year> inflation adjustments)",
     "sourceUrl": "https://www.irs.gov/pub/irs-drop/<the release>.pdf",
     "tops": {
       "single": [0, 0, 0, 0, 0, 0],
       "joint": [0, 0, 0, 0, 0, 0],
       "household": [0, 0, 0, 0, 0, 0]
     },
     "selfEmployment": { "rate": 15.3, "taxableShare": 92.35, "cap": 0 }
   }
   ```

   The zeros are placeholders and the Worker rejects them: every one is replaced with the released figure before the
   PUT.

   `tops` is the **last dollar** of the 10, 12, 22, 24, 32 and 35% brackets — six numbers per filing status, smallest
   first. The 37% bracket runs above the sixth and has no top of its own. `selfEmployment.cap` is that year's Social
   Security wage base; `rate` (15.3) and `taxableShare` (92.35) are statutory and only change if the law does.

4. **Send it** as `PUT /tax/<year>` with the Worker secret as the bearer token:

   ```bash
   export TAX_ADMIN_TOKEN='the secret set on the Worker'
   curl -i -X PUT "https://cta-tax-tables.quionapeterson.workers.dev/tax/2028" \
     -H "Authorization: Bearer $TAX_ADMIN_TOKEN" \
     -H "content-type: application/json" \
     --data @tax-2028.json
   ```

   A `200 {"saved":2028,"source":"…"}` is done. Errors are the Worker's guardrails, not a network problem:

   | Answer | What it means |
   | --- | --- |
   | `400 That is not a complete bracket table for that year.` | A status missing, not exactly six thresholds, not ascending, a blank/nonsense number, `cap` outside 1,000–10,000,000, or `year` not matching the URL. |
   | `403 Forbidden` | The token is wrong (or missing from the request). |
   | `403 …no TAX_ADMIN_TOKEN, so it is read-only.` | No secret is set on the Worker. |
   | `503 No TAX_TABLES KV namespace is bound.` | The deployment lost its `TAX_TABLES` binding. |

5. **Check it**: `curl -s https://cta-tax-tables.quionapeterson.workers.dev/tax | jq '.years'` should list the new year.
   KV is eventually consistent worldwide, so a Worker read can lag by up to about a minute, and the app keeps the
   Worker's answer in `localStorage` (`cta.lab.taxTables.v1`) for a day — clear that key, or open a fresh browser, to see
   a new year immediately.

Nothing needs scheduling for the rollover itself: the estimator opens on the calendar year and takes the newest table
at or before it. The `0 7 1 1 *` cron (07:00 UTC on 1 January) is a reminder, not a source — it reads the years it
holds, writes the status to KV, and logs a warning when the calendar has moved past the newest table. It never writes a
bracket figure.

## When a code change is needed instead

- **No token, or a structural change.** Add the year to `TAX_TABLES` in `src/lib/tax-brackets.ts` and deploy. This is
  also the only way to express a change in the structure — a different number of brackets (`BRACKET_RATES`), a changed
  Social Security basis, or a new filing status. The KV path carries figures, not shapes.
- **The Worker itself** is redeployed with `npx wrangler deploy -c workers/wrangler-tax.toml`; that keeps the
  `TAX_TABLES` binding from the config and leaves the `TAX_ADMIN_TOKEN` secret in place.

## The token

One secret on the Worker, named `TAX_ADMIN_TOKEN`. Create or rotate it in Cloudflare → Workers & Pages →
`cta-tax-tables` → Settings → Variables and Secrets → Secret, or with
`npx wrangler secret put TAX_ADMIN_TOKEN -c workers/wrangler-tax.toml`. Cloudflare never shows the value again, so keep
it in a password manager. It is a bearer token, not a Cloudflare API token, and it never goes in the repo, an app
variable, or anything prefixed `VITE_` (those are compiled into the browser bundle).
