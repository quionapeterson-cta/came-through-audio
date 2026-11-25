import { budgetProgress, type ExpenseRow } from "@/lib/financial-lab-budgets";
import {
  taxSheetIncomeRate,
  taxSheetSelfEmploymentRate,
  taxSheetTable,
  taxSheetTotal,
  type TaxRow,
  type TaxSheet,
} from "@/lib/financial-lab-tax";
import type { LabNumbers } from "@/lib/financial-lab-scenario";
import { MASTER_PORTION, PLATFORMS, estimateEarnings, territoryBlend } from "@/lib/royalty-calc";
import { albumKey, routedKinds, type ReleaseFields, type RoutedKind } from "@/lib/release-routing";
import { currentTaxYear, type FilingStatus, type TaxYearTable } from "@/lib/tax-brackets";

/**
 * The Financial Lab packet: one branded PDF that carries a whole scope of songs — a single song, a release, a handful
 * of picks or the entire catalog — through the totals summary, the tax worksheet, the production budget and the
 * royalty projection. Each of those tools already exports its own file; the packet is the copy a member hands to an
 * accountant, so it is built from what the Lab already has saved for the songs in scope and never asks for the same
 * number twice.
 *
 * Nothing here reads storage: the component that owns the scope hands in the parsed songs, so every figure in the
 * packet can be tested without a browser.
 */
export type PacketMode = "song" | "release" | "songs" | "catalog";

/** The catalog fields the packet routes on; a whole CatalogTrack satisfies it. */
export type PacketTrack = { id: string; title: string; metadata: ReleaseFields };

/** The budget plan as the packet uses it: the three things the artist owns, never the derived allocation. */
export type PacketBudget = { project: string; target: number; rows: ExpenseRow[] };

export type PacketSong = {
  id: string;
  title: string;
  /** The release it belongs to, spelled the way My Catalog spells it. */
  release: string;
  kind: RoutedKind;
  numbers: LabNumbers;
  tax: TaxSheet;
  budget: PacketBudget | null;
};

export type PacketChoice = {
  mode: PacketMode;
  /** The open song, for `song`. */
  songId?: string | undefined;
  /** The release's album title, for `release`. */
  release?: string | undefined;
  /** The ticked songs, for `songs`. */
  songIds?: string[] | undefined;
};

/** Which release a catalog song belongs to, exactly as My Catalog reads it. */
export const packetReleaseName = (track: { title: string; metadata: ReleaseFields }): string =>
  track.metadata.album.trim() || track.title.trim();

/**
 * The songs a scope covers, in catalog order, and the name the packet prints for that scope. An empty scope comes back
 * with an empty list rather than a fallback, so a member who unticked every song is told, not handed someone else's.
 */
export function packetScopeSongs(
  tracks: readonly PacketTrack[],
  choice: PacketChoice,
): { ids: string[]; label: string } {
  if (choice.mode === "song") {
    const found = tracks.find((track) => track.id === (choice.songId ?? ""));
    return {
      ids: found ? [found.id] : [],
      // A one-song packet is named for the song, not the release it sits on: the cover already lists the release.
      label: found ? found.title.trim() || "This song" : "No song selected",
    };
  }
  if (choice.mode === "release") {
    const key = albumKey(choice.release ?? "");
    const ids = key
      ? tracks
          .filter((track) => albumKey(packetReleaseName(track)) === key)
          .map((track) => track.id)
      : [];
    return { ids, label: (choice.release ?? "").trim() || "Choose a release" };
  }
  if (choice.mode === "songs") {
    const picked = new Set(choice.songIds ?? []);
    const ids = tracks.filter((track) => picked.has(track.id)).map((track) => track.id);
    return {
      ids,
      label: ids.length === 1 ? "1 selected song" : `${ids.length} selected songs`,
    };
  }
  return { ids: tracks.map((track) => track.id), label: "Entire catalog" };
}

/** The kind of release each song belongs to, by song id — the same map My Catalog uses. */
export function packetKinds(tracks: readonly PacketTrack[]): Map<string, RoutedKind> {
  return routedKinds(
    tracks,
    (track) => ({ ...track.metadata, title: track.title }),
    (track) => track.id,
  );
}

/* ----------------------------------------------------------------------------------------------------------------
 * Royalties
 * --------------------------------------------------------------------------------------------------------------*/

export type PacketPlatformLine = {
  id: string;
  name: string;
  streams: number;
  /** The rate the row is priced at: the member's own, blended across the scope. */
  rate: number;
  /** The whole platform pool for the row, before the member's shares. */
  pool: number;
  /** The member's part of the pool, after the master/song shares and before the distributor's cut. */
  yoursBefore: number;
  /** The exact share of this row's pool before the distributor; mixed song splits can make this differ by row. */
  sharePct: number;
  /** The member's estimate after the master/song shares and the distributor's cut. */
  yours: number;
};

/** One platform's tallied streams for a scope, as typed in the Lab. A blank or absent row keeps the saved streams. */
export type PacketTally = Record<string, string>;

export type PacketRoyalty = {
  streams: number;
  /** After the master and song shares, before the distributor. */
  gross: number;
  /** What reaches the member after the distributor's cut. */
  net: number;
  distributor: number;
  radio: number;
  platforms: PacketPlatformLine[];
};

const share = (value: string): number => Math.min(100, Math.max(0, Number(value) || 0));

/**
 * One song's projection, read exactly the way the Earnings panel reads it: its own saved streams, its own rates, a
 * listener mix when one is on, then the master and song shares. The distributor's cut is applied at the end, because a
 * route keeps its share of what the platforms paid, not of the member's split.
 */
export function packetRoyalty(song: PacketSong): PacketRoyalty {
  const n = song.numbers;
  const streams: Record<string, number> = {};
  const rates: Record<string, number> = {};
  for (const platform of PLATFORMS) {
    streams[platform.id] = Number(n.streams[platform.id]) || 0;
    const base = Number(n.rates[platform.id]) || platform.rate;
    const mix = n.territories[platform.id];
    rates[platform.id] = mix?.on ? base * territoryBlend(mix) : base;
  }
  const estimate = estimateEarnings({
    streams,
    rates,
    masterShare: share(n.master),
    songShare: share(n.songShare),
    radioPlays: Number(n.radio.plays) || 0,
    perPlay: Number(n.radio.perPlay) || 0,
  });
  const distributor = share(n.distributor);
  // The distributor takes its share of what the platforms paid, never of the radio and live money.
  const platformYours = estimate.platforms.reduce((sum, line) => sum + line.yours, 0);
  return {
    streams: Object.values(streams).reduce((sum, value) => sum + value, 0),
    gross: platformYours + estimate.radio,
    net: platformYours * (1 - distributor / 100) + estimate.radio,
    distributor,
    radio: estimate.radio,
    platforms: estimate.platforms.map((line) => {
      const platform = PLATFORMS.find((p) => p.id === line.id);
      return {
        id: line.id,
        name: line.name,
        streams: streams[line.id] ?? 0,
        rate: rates[line.id] ?? platform?.rate ?? 0,
        pool: line.total,
        yoursBefore: line.yours,
        sharePct: line.total > 0 ? (line.yours / line.total) * 100 : 0,
        yours: line.yours * (1 - distributor / 100),
      };
    }),
  };
}

/** The scope's share of a platform pool before and after the distributor, weighted by what each song earned. */
export function packetScopeCuts(songs: readonly PacketSong[]): { before: number; after: number } {
  let pool = 0;
  let before = 0;
  let after = 0;
  for (const song of songs) {
    const n = song.numbers;
    const cut =
      (MASTER_PORTION * share(n.master) + (1 - MASTER_PORTION) * share(n.songShare)) / 100;
    const keep = 1 - share(n.distributor) / 100;
    for (const line of packetRoyalty(song).platforms) {
      pool += line.pool;
      before += line.pool * cut;
      after += line.pool * cut * keep;
    }
  }
  if (pool > 0) return { before: before / pool, after: after / pool };
  const n = songs[0]?.numbers;
  const cut = n
    ? (MASTER_PORTION * share(n.master) + (1 - MASTER_PORTION) * share(n.songShare)) / 100
    : 0;
  return { before: cut, after: cut * (n ? 1 - share(n.distributor) / 100 : 1) };
}

/** A typed stream count is the member's own tally; blank means this platform keeps the saved streams. */
export const packetTallyTotal = (tally: PacketTally | undefined): number =>
  PLATFORMS.reduce((sum, platform) => sum + (Number(tally?.[platform.id]) || 0), 0);

/** Any typed box counts, including an explicit 0: a blank box is the only one that keeps the saved streams. */
export const packetTallyUsed = (tally: PacketTally | undefined): boolean =>
  !!tally &&
  PLATFORMS.some((platform) => tally[platform.id] !== undefined && tally[platform.id] !== "");

/** Anything read back from storage: digits only, known platforms only, blanks dropped. */
export function sanitizePacketTally(raw: unknown): PacketTally {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const tally: PacketTally = {};
  for (const platform of PLATFORMS) {
    const value = o[platform.id];
    const digits = typeof value === "string" ? value.replace(/\D/g, "").slice(0, 12) : "";
    if (digits) tally[platform.id] = digits;
  }
  return tally;
}

/**
 * A tally belongs to one scope and tax year. The slot is a short hash of both, so switching the scope never shows one
 * packet's totals under another's heading and a long catalog never becomes a long storage key.
 */
export function packetTallySlot(ids: readonly string[], year: number): string {
  let hash = 2166136261;
  for (const ch of `${year}|${[...ids].sort().join(",")}`) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `packet-${(hash >>> 0).toString(36)}`;
}

/**
 * The scope's platform rows: every song's saved streams added together, priced at the rate the scope actually paid —
 * the blended rate, `pool ÷ streams`, so a member who edited one song's rate is not silently averaged away.
 */
export function packetPlatforms(
  songs: readonly PacketSong[],
  tally?: PacketTally,
): PacketPlatformLine[] {
  const rows = new Map<string, PacketPlatformLine>(
    PLATFORMS.map((platform) => [
      platform.id,
      {
        id: platform.id,
        name: platform.name,
        streams: 0,
        rate: 0,
        pool: 0,
        yoursBefore: 0,
        sharePct: 0,
        yours: 0,
      },
    ]),
  );
  for (const song of songs) {
    for (const line of packetRoyalty(song).platforms) {
      const row = rows.get(line.id);
      if (!row) continue;
      row.streams += line.streams;
      row.pool += line.pool;
      row.yoursBefore += line.yoursBefore;
      row.yours += line.yours;
    }
  }
  const saved = [...rows.values()].map((row) => ({
    ...row,
    rate: row.streams > 0 ? row.pool / row.streams : 0,
    sharePct: row.pool > 0 ? (row.yoursBefore / row.pool) * 100 : 0,
  }));
  if (!packetTallyUsed(tally)) return saved;
  // A typed total replaces that platform's saved streams; the scope's own share and blended rate still price it.
  const cuts = packetScopeCuts(songs);
  return saved.map((row) => {
    const typed = tally?.[row.id];
    if (typed === undefined || typed === "") return row;
    const streams = Number(typed) || 0;
    const fallback = PLATFORMS.find((platform) => platform.id === row.id)?.rate ?? 0;
    const rate = row.streams > 0 ? row.pool / row.streams : fallback;
    const pool = streams * rate;
    return {
      ...row,
      streams,
      rate,
      pool,
      yoursBefore: pool * cuts.before,
      sharePct: cuts.before * 100,
      yours: pool * cuts.after,
    };
  });
}

/* ----------------------------------------------------------------------------------------------------------------
 * The tax worksheet, merged for the scope and the tax year
 * --------------------------------------------------------------------------------------------------------------*/

export type PacketTaxLine = TaxRow & { song: string };

export type PacketTax = {
  year: number;
  lines: PacketTaxLine[];
  rate: number;
  seRate: number;
  status: FilingStatus | "";
  /** The bracket table the year is priced with, and the year it actually came from. */
  tableYear: number;
  tableSource: string;
  gap: { asked: number; used: number } | null;
  total: number;
  income: number;
  se: number;
  savings: number;
  /** Songs whose worksheet went into the packet. */
  included: string[];
  /** Songs whose worksheet names a different year, so it stayed out. */
  skipped: string[];
};

/**
 * Every song's worksheet for one tax year, as a single set of lines. A sheet with no year belongs to the calendar year,
 * exactly as the drawer reads it, and a sheet naming another year stays out — a 2025 cost must never land in a 2026
 * packet. The rate, filing status and self-employment choice come from the member's own sheets, never from a default.
 */
export function packetTax(
  songs: readonly PacketSong[],
  year: number,
  tables?: TaxYearTable[],
  madeAt: Date = new Date(),
): PacketTax {
  const lines: PacketTaxLine[] = [];
  const included: string[] = [];
  const skipped: string[] = [];
  let rate = 0;
  let status: FilingStatus | "" = "";
  let selfEmployment: TaxSheet["selfEmployment"] = "none";

  for (const song of songs) {
    const sheetYear = Number(song.tax.year) || currentTaxYear(madeAt);
    if (sheetYear !== year) {
      if (song.tax.rows.length) skipped.push(song.title);
      continue;
    }
    if (!song.tax.rows.length) continue;
    included.push(song.title);
    for (const row of song.tax.rows) lines.push({ ...row, song: song.title });
    if (!rate) rate = taxSheetIncomeRate(song.tax);
    if (!status && song.tax.status) status = song.tax.status;
    // The scope counts self-employment tax when any worksheet in it did, so a member who counted it is never quietly
    // dropped back to the income-tax-only figure.
    if (song.tax.selfEmployment === "full") selfEmployment = "full";
    else if (song.tax.selfEmployment === "medicare" && selfEmployment === "none")
      selfEmployment = "medicare";
  }

  const combined: TaxSheet = {
    year: String(year),
    rate: String(rate),
    status,
    selfEmployment,
    rows: lines,
  };
  const table = taxSheetTable(combined, tables, madeAt);
  const seRate = taxSheetSelfEmploymentRate(combined, tables, madeAt);
  const total = taxSheetTotal(combined);
  // Cents, the same place the worksheets' own formatters round.
  const income = Math.round(total * rate) / 100;
  const se = Math.round(total * seRate) / 100;
  return {
    year,
    lines,
    rate,
    seRate,
    status,
    tableYear: table.year,
    tableSource: table.source,
    gap: table.year === year ? null : { asked: year, used: table.year },
    total,
    income,
    se,
    savings: income + se,
    included,
    skipped,
  };
}

/* ----------------------------------------------------------------------------------------------------------------
 * The budget, and the scope's combined totals
 * --------------------------------------------------------------------------------------------------------------*/

export type PacketBudgetTotals = {
  plans: number;
  target: number;
  planned: number;
  spent: number;
  remaining: number;
};

/** The scope's budget figure: every plan's target, what its lines plan, and what has actually been paid. */
export function packetBudgetTotals(songs: readonly PacketSong[]): PacketBudgetTotals {
  let plans = 0;
  let target = 0;
  let planned = 0;
  let spent = 0;
  for (const song of songs) {
    if (!song.budget) continue;
    plans += 1;
    target += Number(song.budget.target) || 0;
    const progress = budgetProgress(song.budget.rows, song.budget.target);
    planned += progress.planned;
    spent += progress.spent;
  }
  return { plans, target, planned, spent, remaining: target - spent };
}

export type PacketTotals = {
  songs: number;
  releases: number;
  streams: number;
  /** After the distributor's cut. */
  royalty: number;
  gross: number;
  budget: PacketBudgetTotals;
  deductible: number;
  incomeTax: number;
  seTax: number;
  savings: number;
};

/** Every combined figure the summary page prints, from the same rows the sections below it show. */
export function packetTotals(
  songs: readonly PacketSong[],
  tax: PacketTax,
  tally?: PacketTally,
): PacketTotals {
  const radio = songs.reduce((sum, song) => sum + packetRoyalty(song).radio, 0);
  let streams = 0;
  let royalty = 0;
  let gross = 0;
  if (packetTallyUsed(tally)) {
    const rows = packetPlatforms(songs, tally);
    for (const row of rows) {
      streams += row.streams;
      royalty += row.yours;
      gross += row.yoursBefore;
    }
  } else {
    for (const song of songs) {
      const projection = packetRoyalty(song);
      streams += projection.streams;
      royalty += projection.net;
      gross += projection.gross;
    }
  }
  royalty += radio;
  gross += radio;
  return {
    songs: songs.length,
    releases: new Set(songs.map((song) => albumKey(song.release))).size,
    streams,
    royalty,
    gross,
    budget: packetBudgetTotals(songs),
    deductible: tax.total,
    incomeTax: tax.income,
    seTax: tax.se,
    savings: tax.savings,
  };
}

/** The tax years a packet can be built for: the bracket tables and this calendar year, newest first. */
export function packetYears(tables: TaxYearTable[], now: Date = new Date()): number[] {
  const years = new Set<number>([...tables.map((table) => table.year), currentTaxYear(now)]);
  return [...years].sort((a, b) => b - a);
}
