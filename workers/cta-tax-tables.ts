/**
 * Came Through Audio tax tables — a standalone Cloudflare Worker.
 *
 * It serves the year-keyed federal bracket table the Artist Tax Write-Off Estimator prices from, so a new tax year
 * reaches every member without rebuilding or redeploying the app. Its own name (`cta-tax-tables`), its own config
 * (`workers/wrangler-tax.toml`), and it touches no other Worker, binding or Email Routing rule.
 *
 * Deploy (from the repo root):
 *   npx wrangler deploy -c workers/wrangler-tax.toml
 * then put the printed URL in the app as VITE_CTA_TAX_TABLES_URL (Sites/Cloudflare → Settings → Variables). Without
 * the variable the Lab uses the tables bundled in src/lib/tax-brackets.ts, so nothing goes down while it is unset.
 *
 * Routes:
 *   GET  /            → what this Worker is and which years it holds
 *   GET  /tax         → { years, activeYear, newestYear, needsUpdate, tables }
 *   GET  /tax/<year>  → one year's table, or 404
 *   PUT  /tax/<year>  → add or correct a year (Authorization: Bearer $TAX_ADMIN_TOKEN, needs the TAX_TABLES namespace)
 *
 * The rules — routing, CORS, the KV lookup, validating a posted table and the yearly check — live in
 * src/lib/tax-tables-worker.ts so they are unit-tested alongside the app; this file is only the deployed shell.
 */
import {
  handleTaxTablesRequest,
  runYearlyTaxCheck,
  type TaxTablesEnv,
} from "../src/lib/tax-tables-worker";

export default {
  fetch(request: Request, env: TaxTablesEnv): Promise<Response> {
    return handleTaxTablesRequest(request, env);
  },

  /**
   * Runs on January 1. It records whether the calendar has moved past the newest table — never a bracket figure: a
   * year it does not hold is reported as needing its IRS release, not filled in from the year before.
   */
  async scheduled(_event: unknown, env: TaxTablesEnv): Promise<void> {
    const status = await runYearlyTaxCheck(env);
    if (status.needsUpdate) {
      console.warn(
        `Tax tables: ${status.activeYear} has no bracket table yet (newest is ${status.newestYear}). Add it from the IRS revenue procedure before quoting a rate for ${status.activeYear}.`,
      );
    } else {
      console.log(`Tax tables: ${status.activeYear} is covered by the ${status.newestYear} table.`);
    }
  },
};
