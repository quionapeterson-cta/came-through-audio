import { describe, expect, it } from "vitest";
import { TAX_TABLES, taxYears, type TaxYearTable } from "./tax-brackets";
import {
  TAX_TABLES_CORS_METHODS,
  allTaxTables,
  handleTaxTablesRequest,
  runYearlyTaxCheck,
  type TaxTablesEnv,
  type TaxTablesKv,
} from "./tax-tables-worker";

const SITE = "https://camethroughaudio.com";
const WORKER = "https://cta-tax-tables.example.workers.dev";

/** A KV namespace in a Map, recording what was written so a test can read the keys the Worker chose. */
function fakeKv(seed: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(seed));
  const writes: string[] = [];
  const kv: TaxTablesKv = {
    get: async (key) => (store.has(key) ? store.get(key) : null),
    put: async (key, value) => {
      writes.push(key);
      store.set(key, JSON.parse(value));
    },
  };
  return { kv, store, writes };
}

const call = (
  path: string,
  init: RequestInit & { origin?: string | null } = {},
  env: TaxTablesEnv = {},
  now: Date = new Date("2026-11-25T12:00:00Z"),
) => {
  const headers = new Headers(init.headers);
  if (init.origin !== null && init.origin !== undefined) headers.set("Origin", init.origin);
  return handleTaxTablesRequest(new Request(`${WORKER}${path}`, { ...init, headers }), env, now);
};

/** A complete table for a year neither the app nor the Worker has seen yet. */
const table2028 = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  year: 2028,
  source: "IRS Rev. Proc. 2027-99",
  sourceUrl: "https://www.irs.gov/pub/irs-drop/rp-27-99.pdf",
  tops: {
    single: [13000, 53000, 110000, 210000, 266000, 663000],
    joint: [26000, 106000, 220000, 420000, 530000, 795000],
    household: [18500, 70000, 110000, 210000, 266000, 663000],
  },
  selfEmployment: { rate: 15.3, taxableShare: 92.35, cap: 195000 },
  ...over,
});

describe("the routes", () => {
  it("says what it is and which years it holds", async () => {
    const response = await call("/");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.worker).toBe("cta-tax-tables");
    expect(body.holds).toEqual(taxYears());
    expect(body.years).toEqual(taxYears());
  });

  it("serves every table with today's year and whether it is behind", async () => {
    const response = await call("/tax");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.activeYear).toBe(2026);
    expect(body.newestYear).toBe(2027);
    expect(body.needsUpdate).toBe(false);
    expect(body.tables).toHaveLength(TAX_TABLES.length);
    expect(body.tables.map((table: TaxYearTable) => table.year)).toEqual(taxYears());
  });

  it("reports a calendar year it has no table for instead of reusing last year's", async () => {
    const body = await (await call("/tax", {}, {}, new Date("2028-01-01T07:00:00Z"))).json();
    expect(body.activeYear).toBe(2028);
    expect(body.newestYear).toBe(2027);
    expect(body.needsUpdate).toBe(true);
  });

  it("serves one year, and 404s a year it does not have", async () => {
    const found = await call("/tax/2027");
    expect(found.status).toBe(200);
    expect((await found.json()).table.year).toBe(2027);

    const missing = await call("/tax/1999");
    expect(missing.status).toBe(404);
    expect((await missing.json()).error).toMatch(/No table/);
  });

  it("404s an unknown path and a method it does not offer", async () => {
    expect((await call("/nope")).status).toBe(404);
    expect((await call("/tax", { method: "POST" })).status).toBe(404);
    expect((await call("/tax/2026", { method: "DELETE" })).status).toBe(404);
  });
});

describe("CORS", () => {
  it("allows our own site, with the methods the routes use", async () => {
    const response = await call("/tax", { origin: SITE });
    expect(response.headers.get("access-control-allow-origin")).toBe(SITE);
    expect(response.headers.get("vary")).toBe("Origin");
    expect(TAX_TABLES_CORS_METHODS).toBe("GET, PUT, OPTIONS");
  });

  it("answers a preflight with GET, PUT and OPTIONS, and the authorization header", async () => {
    const response = await call("/tax/2028", { method: "OPTIONS", origin: SITE });
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(SITE);
    expect(response.headers.get("access-control-allow-methods")).toBe("GET, PUT, OPTIONS");
    expect(response.headers.get("access-control-allow-headers")).toMatch(/authorization/i);
  });

  it("refuses another site, and sends it no allow-origin header", async () => {
    const hostile = "https://camethroughaudio.com.evil.example";
    const preflight = await call("/tax", { method: "OPTIONS", origin: hostile });
    expect(preflight.status).toBe(403);
    expect(preflight.headers.get("access-control-allow-origin")).toBeNull();

    const read = await call("/tax", { origin: hostile });
    expect(read.status).toBe(403);
    expect(read.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("answers a caller with no Origin (curl, a cron) without CORS headers", async () => {
    const response = await call("/tax");
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect((await call("/tax", { method: "OPTIONS" })).status).toBe(403);
  });
});

describe("the KV path", () => {
  it("merges a stored year over the bundled ones", async () => {
    const { kv } = fakeKv({ years: [2028], "year:2028": table2028() });
    const body = await (await call("/tax", {}, { TAX_TABLES: kv })).json();
    expect(body.years).toEqual([2026, 2027, 2028]);
    expect(body.newestYear).toBe(2028);
    expect(body.tables.at(-1).year).toBe(2028);
  });

  it("lets a stored correction win over the bundled copy of the same year", async () => {
    const correction = table2028({ year: 2027, source: "IRS correction" });
    const { kv } = fakeKv({ years: [2027], "year:2027": correction });
    const body = await (await call("/tax/2027", {}, { TAX_TABLES: kv })).json();
    expect(body.table.source).toBe("IRS correction");
  });

  it("keeps serving the bundled years when the namespace is empty", async () => {
    const { kv } = fakeKv();
    const tables = await allTaxTables({ TAX_TABLES: kv });
    expect(tables.map((table) => table.year)).toEqual(taxYears());
  });

  it("ignores a stored year that is not a complete table", async () => {
    const { kv } = fakeKv({ years: [2028], "year:2028": { year: 2028, tops: {} } });
    const tables = await allTaxTables({ TAX_TABLES: kv });
    expect(tables.map((table) => table.year)).toEqual(taxYears());
  });

  it("adds a year through a PUT and serves it straight away", async () => {
    const { kv, store, writes } = fakeKv({ years: [2026] });
    const response = await call(
      "/tax/2028",
      {
        method: "PUT",
        origin: SITE,
        headers: { Authorization: "Bearer secret", "content-type": "application/json" },
        body: JSON.stringify(table2028()),
      },
      { TAX_TABLES: kv, TAX_ADMIN_TOKEN: "secret" },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: 2028, source: "IRS Rev. Proc. 2027-99" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(store.get("year:2028")).toMatchObject({ year: 2028, selfEmployment: { cap: 195000 } });
    expect(store.get("years")).toEqual([2026, 2028]);
    expect(writes).toContain("year:2028");

    const served = await (await call("/tax/2028", {}, { TAX_TABLES: kv })).json();
    expect(served.table.year).toBe(2028);
  });

  it("refuses a PUT without the token configured, with the wrong token, or with no namespace", async () => {
    const body = JSON.stringify(table2028());
    const headers = { Authorization: "Bearer secret", "content-type": "application/json" };

    const noToken = await call("/tax/2028", { method: "PUT", headers, body }, {});
    expect(noToken.status).toBe(403);

    const { kv } = fakeKv();
    const wrong = await call(
      "/tax/2028",
      { method: "PUT", headers: { ...headers, Authorization: "Bearer nope" }, body },
      { TAX_TABLES: kv, TAX_ADMIN_TOKEN: "secret" },
    );
    expect(wrong.status).toBe(403);

    const noKv = await call(
      "/tax/2028",
      { method: "PUT", headers, body },
      { TAX_ADMIN_TOKEN: "secret" },
    );
    expect(noKv.status).toBe(503);
  });

  it("rejects a partial table, a mismatched year and junk without writing anything", async () => {
    const { kv, store } = fakeKv();
    const env = { TAX_TABLES: kv, TAX_ADMIN_TOKEN: "secret" };
    const headers = { Authorization: "Bearer secret", "content-type": "application/json" };

    const partial = await call(
      "/tax/2028",
      {
        method: "PUT",
        headers,
        body: JSON.stringify(
          table2028({ tops: { single: [13000, 53000], joint: [], household: [] } }),
        ),
      },
      env,
    );
    expect(partial.status).toBe(400);

    const wrongYear = await call(
      "/tax/2029",
      { method: "PUT", headers, body: JSON.stringify(table2028()) },
      env,
    );
    expect(wrongYear.status).toBe(400);

    const junk = await call("/tax/2028", { method: "PUT", headers, body: "not json" }, env);
    expect(junk.status).toBe(400);

    expect(store.has("year:2028")).toBe(false);
    expect(store.has("years")).toBe(false);
  });
});

describe("the yearly check", () => {
  it("is quiet while the newest table covers the calendar year", async () => {
    const { kv, store } = fakeKv();
    const status = await runYearlyTaxCheck({ TAX_TABLES: kv }, new Date("2026-11-25T07:00:00Z"));
    expect(status.needsUpdate).toBe(false);
    expect(status.activeYear).toBe(2026);
    expect(status.newestYear).toBe(2027);
    expect(status.years).toEqual(taxYears());
    expect(store.get("status")).toMatchObject({ needsUpdate: false, activeYear: 2026 });
  });

  it("flags a January with no table, and never writes a bracket figure", async () => {
    const { kv, store, writes } = fakeKv();
    const status = await runYearlyTaxCheck({ TAX_TABLES: kv }, new Date("2029-01-01T07:00:00Z"));
    expect(status.needsUpdate).toBe(true);
    expect(status.activeYear).toBe(2029);
    expect(store.get("status")).toMatchObject({ needsUpdate: true, newestYear: 2027 });
    // Only the status key is written; no year is invented from the one before it.
    expect(writes).toEqual(["status"]);
  });

  it("runs without a namespace bound", async () => {
    const status = await runYearlyTaxCheck({}, new Date("2029-01-01T07:00:00Z"));
    expect(status.needsUpdate).toBe(true);
    expect(status.years).toEqual(taxYears());
  });
});
