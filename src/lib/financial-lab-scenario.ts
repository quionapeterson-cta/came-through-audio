import { PLATFORMS } from "@/lib/royalty-calc";

/**
 * The Financial Lab's own memory, kept in the browser and keyed to one member, one song and one tool.
 *
 * Two things need it:
 * - the numbers a member types (streams, edited rates, shares, radio, distributor cut, listener mix, budget
 *   target) have to be there after a refresh or a tab switch, and
 * - named scenarios let the same song be planned twice (as it is, and as it might be) without retyping it.
 *
 * Nothing here talks to the database. A saved-scenario table would add cross-device and cross-browser access; this
 * module is deliberately the whole storage story until that is decided.
 */

/** Listener shares by region, as the member types them (percent of their streams). */
export type LabTerritoryMix = {
  on: boolean;
  us: string;
  uk: string;
  ng: string;
  row: string;
};

/** Every number the royalty tools hold, in the shape they are typed in. */
export type LabNumbers = {
  streams: Record<string, string>;
  rates: Record<string, string>;
  master: string;
  songShare: string;
  radio: { plays: string; perPlay: string };
  /** The distributor's cut in percent; 0 leaves every estimate as it was. */
  distributor: string;
  territories: Record<string, LabTerritoryMix>;
  /** Carried so a restored scenario also puts the Projected Earnings target back. */
  budgetCap: string;
};

export type LabScenario = {
  id: string;
  name: string;
  savedAt: string;
  total: number;
  numbers: LabNumbers;
};

export type LabStore = {
  current: LabNumbers;
  scenarios: LabScenario[];
  /** When the current numbers were last written; null means nothing has been saved for this song. */
  savedAt: string | null;
};

export const MAX_SCENARIOS = 10;
export const SCENARIO_NAME_MAX = 40;

export const LAB_STORAGE_PREFIX = "cta.lab.v1";

/** The storage key for one member, one song and one Lab tool. */
export const labStorageKey = (userId: string | undefined, songId: string, part: string) =>
  `${LAB_STORAGE_PREFIX}.${userId || "anon"}.${songId || "manual"}.${part}`;

export const emptyTerritoryMix = (): LabTerritoryMix => ({
  on: false,
  us: "",
  uk: "",
  ng: "",
  row: "",
});

export function emptyLabNumbers(): LabNumbers {
  return {
    streams: { spotify: "0" },
    rates: Object.fromEntries(PLATFORMS.map((p) => [p.id, String(p.rate)])),
    master: "100",
    songShare: "100",
    radio: { plays: "0", perPlay: "0" },
    distributor: "0",
    territories: {},
    budgetCap: "",
  };
}

const text = (v: unknown, max = 24): string => {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return typeof v === "string" ? v.slice(0, max) : "";
};

const percent = (v: unknown): string => {
  const n = Number(text(v));
  if (!Number.isFinite(n)) return "0";
  return String(Math.min(100, Math.max(0, Math.round(n * 100) / 100)));
};

const mixIn = (v: unknown): LabTerritoryMix => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    on: o["on"] === true,
    us: percent(o["us"]),
    uk: percent(o["uk"]),
    ng: percent(o["ng"]),
    row: percent(o["row"]),
  };
};

/**
 * Anything read back from storage goes through here: a half-written or older value fills in the defaults instead of
 * reaching the calculator, and every platform the Lab knows keeps a rate.
 */
export function sanitizeNumbers(raw: unknown): LabNumbers {
  const base = emptyLabNumbers();
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const record = (v: unknown, digitsOnly = false) => {
    const src = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, value] of Object.entries(src)) {
      const s = text(value);
      out[k] = digitsOnly ? s.replace(/\D/g, "") : s;
    }
    return out;
  };
  const radio = (o["radio"] && typeof o["radio"] === "object" ? o["radio"] : {}) as Record<
    string,
    unknown
  >;
  const territories: Record<string, LabTerritoryMix> = {};
  const territoryRows = (
    o["territories"] && typeof o["territories"] === "object" ? o["territories"] : {}
  ) as Record<string, unknown>;
  for (const [k, value] of Object.entries(territoryRows)) territories[k] = mixIn(value);
  return {
    streams: { ...base.streams, ...record(o["streams"], true) },
    rates: { ...base.rates, ...record(o["rates"]) },
    master: text(o["master"]) || base.master,
    songShare: text(o["songShare"]) || base.songShare,
    radio: {
      plays: radio["plays"] === undefined ? base.radio.plays : text(radio["plays"]),
      perPlay: radio["perPlay"] === undefined ? base.radio.perPlay : text(radio["perPlay"]),
    },
    distributor: percent(o["distributor"]),
    territories,
    budgetCap: text(o["budgetCap"], 16),
  };
}

const scenarioIn = (raw: unknown): LabScenario | null => {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const name = text(o["name"], SCENARIO_NAME_MAX).trim();
  if (!name) return null;
  const id = text(o["id"], 64) || `s-${name.toLowerCase().replace(/\W+/g, "-")}`;
  const savedAt = text(o["savedAt"], 40);
  const total = Number(o["total"]);
  return {
    id,
    name,
    savedAt: Number.isFinite(Date.parse(savedAt)) ? savedAt : new Date(0).toISOString(),
    total: Number.isFinite(total) ? total : 0,
    numbers: sanitizeNumbers(o["numbers"]),
  };
};

/** A whole store, cleaned: unknown scenarios are dropped, the newest ten are kept. */
export function sanitizeStore(raw: unknown): LabStore {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const scenarios = (Array.isArray(o["scenarios"]) ? o["scenarios"] : [])
    .map(scenarioIn)
    .filter((s): s is LabScenario => !!s)
    .slice(-MAX_SCENARIOS);
  const savedAt = text(o["savedAt"], 40);
  return {
    current: sanitizeNumbers(o["current"]),
    scenarios,
    savedAt: Number.isFinite(Date.parse(savedAt)) ? savedAt : null,
  };
}

const storage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

/** The store for one key, or a fresh one when nothing readable is there. Never throws. */
export function readLabStore(key: string): LabStore {
  const s = storage();
  if (!s) return sanitizeStore(null);
  try {
    const raw = s.getItem(key);
    return raw ? sanitizeStore(JSON.parse(raw)) : sanitizeStore(null);
  } catch {
    return sanitizeStore(null);
  }
}

/** Writes the store; a blocked or full browser storage is silent, because a Lab without memory still calculates. */
export function writeLabStore(key: string, store: LabStore): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(key, JSON.stringify(store));
  } catch {
    /* storage blocked or full */
  }
}

/** Every number for the open song, without touching its saved scenarios. */
export const withCurrent = (store: LabStore, current: LabNumbers): LabStore => ({
  ...store,
  current,
  savedAt: new Date().toISOString(),
});

/**
 * Saves a named scenario against the song. Saving the same name again replaces it, so a member can keep "Album cycle"
 * up to date instead of collecting near-duplicates; the newest ten are kept.
 */
export function saveScenario(
  store: LabStore,
  name: string,
  numbers: LabNumbers,
  total: number,
  now = new Date(),
): LabStore {
  const clean = name.trim().slice(0, SCENARIO_NAME_MAX);
  if (!clean) return store;
  const scenario: LabScenario = {
    // Two saves in the same millisecond still get their own row: the id also carries a short random tail.
    id: `s-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: clean,
    savedAt: now.toISOString(),
    total: Number.isFinite(total) ? total : 0,
    numbers: sanitizeNumbers(numbers),
  };
  const kept = store.scenarios.filter((s) => s.name.toLowerCase() !== clean.toLowerCase());
  return {
    ...store,
    scenarios: [...kept, scenario].slice(-MAX_SCENARIOS),
  };
}

export function removeScenario(store: LabStore, id: string): LabStore {
  return { ...store, scenarios: store.scenarios.filter((s) => s.id !== id) };
}

/** The numbers a restore puts back, leaving the member's current distributor/budget blanks that the scenario lacks. */
export function restoredNumbers(scenario: LabScenario): LabNumbers {
  return sanitizeNumbers(scenario.numbers);
}

/* ----------------------------------------------------------------------------------------------------------------
 * Plain JSON slots for the other two tools, so the Budget target and the merch run also survive a refresh.
 * --------------------------------------------------------------------------------------------------------------*/

export function readLabJson<T>(key: string): T | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeLabJson(key: string, value: unknown): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked or full */
  }
}
