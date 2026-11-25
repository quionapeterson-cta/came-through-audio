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
 *   GET /            → what this Worker is and which years it holds
 *   GET /tax         → { years, activeYear, newestYear, needsUpdate, tables }
 *   GET /tax/<year>  → one year's table, or 404
 *
 * Two ways a year arrives:
 *   1. It is bundled (src/lib/tax-brackets.ts), from the IRS's own annual revenue procedure. 2026 and 2027 are.
 *   2. It is stored in the optional TAX_TABLES KV namespace. The yearly cron reads it, and a table can be added with
 *      PUT /tax/<year> using the TAX_ADMIN_TOKEN secret — the way the IRS's next release lands without a deploy.
 *
 * What the Worker deliberately does not do: invent a year. The dollar thresholds change every year with the IRS's
 * inflation adjustment, so nothing here guesses or extrapolates the next year's figures; a year it has not been given
 * is reported as `needsUpdate: true` instead. On January 1 the cron re-reads the years it holds and records the
 * rollover, so a missing year shows up in the logs rather than silently pricing a new year on an old table.
 */
import { allowedOrigin } from "../src/lib/help-desk-worker";
import {
  TAX_TABLES,
  latestTaxYear,
  sanitizeTaxTable,
  taxYears,
  type TaxYearTable,
} from "../src/lib/tax-brackets";

type KV = {
  get: (key: string, type?: "json") => Promise<unknown>;
  put: (key: string, value: string) => Promise<void>;
};
type Env = { TAX_TABLES?: KV; TAX_ADMIN_TOKEN?: string };

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

function reply(
  body: unknown,
  status: number,
  origin: string | null,
  extra: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=3600",
      ...(origin ? corsHeaders(origin) : {}),
      ...extra,
    },
  });
}

/** Every year on hand: the bundled ones, then any stored in KV, newest last. A stored year wins over a bundled one. */
async function allTables(env: Env): Promise<TaxYearTable[]> {
  const byYear = new Map<number, TaxYearTable>(TAX_TABLES.map((table) => [table.year, table]));
  if (env.TAX_TABLES) {
    const index = await env.TAX_TABLES.get("years", "json");
    const stored = Array.isArray(index) ? index.map(Number).filter(Number.isFinite) : [];
    const wanted = new Set([...taxYears(TAX_TABLES), latestTaxYear(TAX_TABLES) + 1, ...stored]);
    for (const year of wanted) {
      const table = sanitizeTaxTable(await env.TAX_TABLES.get(`year:${year}`, "json"));
      if (table) byYear.set(table.year, table);
    }
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const referer = request.headers.get("Referer");
    if (origin && !allowedOrigin(origin, referer)) return reply({ error: "Forbidden" }, 403, null);
    if (request.method === "OPTIONS") {
      return origin
        ? new Response(null, { status: 204, headers: corsHeaders(origin) })
        : reply({ error: "Forbidden" }, 403, null);
    }

    const tables = await allTables(env);
    const newestYear = tables.at(-1)?.year ?? 0;
    const activeYear = new Date().getUTCFullYear();

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "")) {
      return reply(
        {
          worker: "cta-tax-tables",
          holds: taxYears(tables),
          newestYear,
          activeYear,
          usage: "GET /tax · GET /tax/<year>",
        },
        200,
        origin,
      );
    }

    if (request.method === "GET" && url.pathname === "/tax") {
      return reply(
        {
          activeYear,
          newestYear,
          years: taxYears(tables),
          needsUpdate: newestYear < activeYear,
          tables,
        },
        200,
        origin,
      );
    }

    const match = /^\/tax\/(\d{4})$/.exec(url.pathname);
    if (match && request.method === "GET") {
      const table = tables.find((entry) => entry.year === Number(match[1]));
      return table
        ? reply({ table, activeYear }, 200, origin)
        : reply({ error: "No table for that year" }, 404, origin);
    }

    if (match && request.method === "PUT") {
      if (!env.TAX_ADMIN_TOKEN) {
        return reply(
          { error: "This Worker has no TAX_ADMIN_TOKEN, so it is read-only." },
          403,
          origin,
        );
      }
      const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      if (token !== env.TAX_ADMIN_TOKEN) return reply({ error: "Forbidden" }, 403, origin);
      if (!env.TAX_TABLES) {
        return reply({ error: "No TAX_TABLES KV namespace is bound." }, 503, origin);
      }
      const table = sanitizeTaxTable(await request.json().catch(() => null));
      if (!table || table.year !== Number(match[1])) {
        return reply({ error: "That is not a complete bracket table for that year." }, 400, origin);
      }
      await env.TAX_TABLES.put(`year:${table.year}`, JSON.stringify(table));
      const index = await env.TAX_TABLES.get("years", "json");
      const years = new Set(Array.isArray(index) ? index.map(Number).filter(Number.isFinite) : []);
      years.add(table.year);
      await env.TAX_TABLES.put("years", JSON.stringify([...years].sort((a, b) => a - b)));
      return reply({ saved: table.year, source: table.source }, 200, origin);
    }

    return reply({ error: "Not found" }, 404, origin);
  },

  /**
   * Runs on January 1. It reads every year on hand, works out whether the calendar has moved past the newest table,
   * and records the answer — in KV when one is bound, in the log either way. It never writes a bracket figure: a year
   * it does not hold is reported as needing its IRS release, not filled in from the year before.
   */
  async scheduled(_event: unknown, env: Env): Promise<void> {
    const tables = await allTables(env);
    const newestYear = tables.at(-1)?.year ?? 0;
    const activeYear = new Date().getUTCFullYear();
    const status = {
      checkedAt: new Date().toISOString(),
      newestYear,
      activeYear,
      needsUpdate: newestYear < activeYear,
      years: taxYears(tables),
    };
    if (env.TAX_TABLES) await env.TAX_TABLES.put("status", JSON.stringify(status));
    if (status.needsUpdate) {
      console.warn(
        `Tax tables: ${activeYear} has no bracket table yet (newest is ${newestYear}). Add it from the IRS revenue procedure before quoting a rate for ${activeYear}.`,
      );
    } else {
      console.log(
        `Tax tables: ${activeYear} is covered by the ${newestYear <= activeYear ? activeYear : newestYear} table.`,
      );
    }
  },
};
