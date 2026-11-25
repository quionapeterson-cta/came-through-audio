import { useEffect, useState } from "react";
import {
  mergeTaxTables,
  sanitizeTaxTable,
  TAX_TABLES,
  taxYears,
  type TaxYearTable,
} from "@/lib/tax-brackets";

/**
 * The bracket tables the drawer offers: the ones bundled with the app, plus any the tax Worker serves.
 *
 * The Worker is optional. With `VITE_CTA_TAX_TABLES_URL` unset (local dev, tests, a build without it) nothing is
 * fetched and the bundled tables are used, so the estimator works offline and no figure depends on a network call.
 * When it is set, the Worker's tables are read once and cached in the browser for a day; a bad or half-written payload
 * is dropped whole, year by year, and the bundled year stays in place.
 */
export type TaxTablesState = {
  tables: TaxYearTable[];
  /** True only when at least one table came from the Worker. */
  live: boolean;
  /** The day the Worker last answered, for the "checked" line. */
  checkedAt: string;
  /** The newest year the tables cover. */
  newest: number;
};

const STORE = "cta.lab.taxTables.v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const workerUrl = (import.meta.env["VITE_CTA_TAX_TABLES_URL"] as string | undefined)?.replace(
  /\/+$/,
  "",
);

type Stored = { checkedAt: string; tables: TaxYearTable[] };

function readStored(): Stored | null {
  try {
    const raw = window.localStorage.getItem(STORE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const checkedAt = typeof parsed["checkedAt"] === "string" ? parsed["checkedAt"] : "";
    const list = Array.isArray(parsed["tables"]) ? parsed["tables"] : [];
    const tables = list.map(sanitizeTaxTable).filter((table): table is TaxYearTable => !!table);
    return tables.length && checkedAt ? { checkedAt, tables } : null;
  } catch {
    return null;
  }
}

function writeStored(value: Stored) {
  try {
    window.localStorage.setItem(STORE, JSON.stringify(value));
  } catch {
    // A full or blocked store just means the next visit asks the Worker again.
  }
}

function stateFrom(tables: TaxYearTable[]): TaxTablesState {
  const merged = mergeTaxTables(TAX_TABLES, tables);
  return {
    tables: merged,
    live: tables.length > 0,
    checkedAt: tables.length ? new Date().toISOString() : "",
    newest: taxYears(merged).at(-1) ?? 0,
  };
}

const bundledState: TaxTablesState = {
  tables: TAX_TABLES,
  live: false,
  checkedAt: "",
  newest: taxYears(TAX_TABLES).at(-1) ?? 0,
};

export function useTaxTables(): TaxTablesState {
  const [state, setState] = useState<TaxTablesState>(() => {
    if (!workerUrl || typeof window === "undefined") return bundledState;
    const stored = readStored();
    return stored ? stateFrom(stored.tables) : bundledState;
  });

  useEffect(() => {
    if (!workerUrl) return;
    const stored = readStored();
    const fresh =
      stored && Date.now() - new Date(stored.checkedAt).getTime() < MAX_AGE_MS ? stored : null;
    if (fresh) {
      setState({ ...stateFrom(fresh.tables), checkedAt: fresh.checkedAt });
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetch(`${workerUrl}/tax`)
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: unknown) => {
          if (cancelled || !payload || typeof payload !== "object") return;
          const list = (payload as Record<string, unknown>)["tables"];
          if (!Array.isArray(list)) return;
          const tables = list
            .map(sanitizeTaxTable)
            .filter((table): table is TaxYearTable => !!table);
          if (!tables.length) return;
          const next = { checkedAt: new Date().toISOString(), tables };
          writeStored(next);
          setState(stateFrom(tables));
        })
        .catch(() => {
          // Offline, blocked or not deployed yet: the bundled tables stay.
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return state;
}
