/**
 * The tax-tables Worker's rules, kept here so they are unit-tested alongside the app — the same split as
 * `help-desk-worker.ts`. `workers/cta-tax-tables.ts` is only the deployed shell: a fetch that hands over to
 * `handleTaxTablesRequest` and a January 1 cron that calls `runYearlyTaxCheck`.
 *
 * What it serves is the year-keyed bracket table in `tax-brackets.ts`, never a figure of its own. A year arrives either
 * bundled with the build or stored in the optional `TAX_TABLES` KV namespace; a year it has not been given is reported
 * as `needsUpdate`, never extrapolated from the year before.
 */
import { allowedOrigin } from "@/lib/help-desk-worker";
import {
  TAX_TABLES,
  latestTaxYear,
  sanitizeTaxTable,
  taxYears,
  type TaxYearTable,
} from "@/lib/tax-brackets";

export type TaxTablesKv = {
  get: (key: string, type?: "json") => Promise<unknown>;
  put: (key: string, value: string) => Promise<void>;
};

export type TaxTablesEnv = { TAX_TABLES?: TaxTablesKv; TAX_ADMIN_TOKEN?: string };

export type TaxTablesStatus = {
  checkedAt: string;
  newestYear: number;
  activeYear: number;
  needsUpdate: boolean;
  years: number[];
};

/** PUT is in the list because that is how a new year arrives; a preflight that omitted it would block the write. */
export const TAX_TABLES_CORS_METHODS = "GET, PUT, OPTIONS";

export const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": TAX_TABLES_CORS_METHODS,
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

export function reply(
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

/** Every year on hand: the bundled ones, then anything the KV namespace holds, newest last. A stored year wins. */
export async function allTaxTables(env: TaxTablesEnv): Promise<TaxYearTable[]> {
  const byYear = new Map<number, TaxYearTable>(TAX_TABLES.map((table) => [table.year, table]));
  const kv = env.TAX_TABLES;
  if (kv) {
    const index = await kv.get("years", "json");
    const stored = Array.isArray(index) ? index.map(Number).filter(Number.isFinite) : [];
    const wanted = new Set([...taxYears(TAX_TABLES), latestTaxYear(TAX_TABLES) + 1, ...stored]);
    for (const year of wanted) {
      const table = sanitizeTaxTable(await kv.get(`year:${year}`, "json"));
      if (table) byYear.set(table.year, table);
    }
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

export function taxTablesStatus(tables: TaxYearTable[], now: Date = new Date()): TaxTablesStatus {
  const newestYear = tables.at(-1)?.year ?? 0;
  const activeYear = now.getUTCFullYear();
  return {
    checkedAt: now.toISOString(),
    newestYear,
    activeYear,
    needsUpdate: newestYear < activeYear,
    years: taxYears(tables),
  };
}

/**
 * The January 1 pass: read the years held, work out whether the calendar has moved past the newest table, and record
 * the answer (in KV when one is bound, in the caller's log either way). It never writes a bracket figure.
 */
export async function runYearlyTaxCheck(
  env: TaxTablesEnv,
  now: Date = new Date(),
): Promise<TaxTablesStatus> {
  const status = taxTablesStatus(await allTaxTables(env), now);
  if (env.TAX_TABLES) await env.TAX_TABLES.put("status", JSON.stringify(status));
  return status;
}

export async function handleTaxTablesRequest(
  request: Request,
  env: TaxTablesEnv,
  now: Date = new Date(),
): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const referer = request.headers.get("Referer");
  if (origin && !allowedOrigin(origin, referer)) return reply({ error: "Forbidden" }, 403, null);
  if (request.method === "OPTIONS") {
    return origin
      ? new Response(null, { status: 204, headers: corsHeaders(origin) })
      : reply({ error: "Forbidden" }, 403, null);
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "")) {
    const tables = await allTaxTables(env);
    return reply(
      {
        worker: "cta-tax-tables",
        holds: taxYears(tables),
        ...taxTablesStatus(tables, now),
        usage: "GET /tax · GET /tax/<year>",
      },
      200,
      origin,
    );
  }

  if (request.method === "GET" && url.pathname === "/tax") {
    const tables = await allTaxTables(env);
    return reply({ ...taxTablesStatus(tables, now), tables }, 200, origin);
  }

  const match = /^\/tax\/(\d{4})$/.exec(url.pathname);

  if (match && request.method === "GET") {
    const tables = await allTaxTables(env);
    const table = tables.find((entry) => entry.year === Number(match[1]));
    return table
      ? reply({ table, activeYear: now.getUTCFullYear() }, 200, origin)
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
    const kv = env.TAX_TABLES;
    if (!kv) return reply({ error: "No TAX_TABLES KV namespace is bound." }, 503, origin);
    const table = sanitizeTaxTable(await request.json().catch(() => null));
    if (!table || table.year !== Number(match[1])) {
      return reply({ error: "That is not a complete bracket table for that year." }, 400, origin);
    }
    await kv.put(`year:${table.year}`, JSON.stringify(table));
    const index = await kv.get("years", "json");
    const years = new Set(Array.isArray(index) ? index.map(Number).filter(Number.isFinite) : []);
    years.add(table.year);
    await kv.put("years", JSON.stringify([...years].sort((a, b) => a - b)));
    return reply({ saved: table.year, source: table.source }, 200, origin, {
      "cache-control": "no-store",
    });
  }

  return reply({ error: "Not found" }, 404, origin);
}
