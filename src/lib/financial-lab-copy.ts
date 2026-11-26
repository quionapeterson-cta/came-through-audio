import type { PdfBrand } from "@/lib/brand-kit";
import { labBrand } from "@/lib/financial-lab-brand";
import { creditName, performers, writerRole, type Metadata } from "@/lib/metadata";
import { convertBetween, songShareRows, PRO_SCALES, type ProScale } from "@/lib/royalty-calc";

/**
 * Agency-ready text for The Financial Lab. This module only formats numbers the calculator already produced; it never
 * re-computes a stream payout or a PRO conversion.
 */
export type CopyAgency = "ascap" | "bmi" | "sesac" | "mlc" | "soundexchange";

export const COPY_AGENCIES: { id: CopyAgency; label: string }[] = [
  { id: "ascap", label: "ASCAP" },
  { id: "bmi", label: "BMI" },
  { id: "sesac", label: "SESAC" },
  { id: "mlc", label: "THE MLC" },
  { id: "soundexchange", label: "SOUNDEXCHANGE" },
];

export const AGENCY_LABEL: Record<CopyAgency, string> = {
  ascap: "ASCAP",
  bmi: "BMI",
  sesac: "SESAC",
  mlc: "The MLC",
  soundexchange: "SoundExchange",
};

export type TrackLike = { title: string; metadata: Metadata };

export type CopyRow = {
  name: string;
  role: string;
  pro: string;
  ipi: string;
  /** The catalog's writer share, out of 100% of the writer half. */
  writer: number;
  /** The catalog's publisher share, out of 100% of the publisher half. */
  publisher: number;
};

export type EarningsSnapshot = {
  total: number;
  radio: number;
  masterShare: number;
  songShare: number;
  platforms: { name: string; streams: number; rate: number; total: number; yours: number }[];
  /** The distributor's cut in percent; 0 leaves the report exactly as it was. */
  distributor?: number;
  /** What reaches the member after that cut. */
  net?: number;
  /** The listener mix a platform was priced on, when one is on. */
  territories?: { label: string; share: number }[];
};

/**
 * The tax worksheet's totals for the open song, when it has any. Carried on the context so the projection CSV can
 * end with the deductible total and the estimate at the member's own rate — the same figures the drawer shows.
 */
export type TaxSnapshot = {
  /** The member's own marginal rate in percent — the bracket they picked. */
  rate: number;
  deductible: number;
  /** The whole estimate, self-employment tax included when the member counted it. */
  savings: number;
  year?: string;
  /** The self-employment part of the estimate, or nothing when it is not counted. */
  seRate?: number;
};

export type CopyContext = {
  title: string;
  artist: string;
  album: string;
  isrc: string;
  iswc: string;
  upc: string;
  duration: string;
  releaseDate: string;
  label: string;
  rows: CopyRow[];
  manual?: { scale: ProScale; value: number };
  master: { share: string; basis: string; performers: string[] };
  earnings?: EarningsSnapshot;
  tax?: TaxSnapshot;
};

const pct = (n: number) => `${Math.round(n * 100) / 100}%`;
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const blank = (v: string | undefined) => (v?.trim() ? v.trim() : "—");

/** The closing line every agency copy carries, so a pasted result says where it came from. */
const CATALOG_FOOTER =
  "Prepared from your Came Through Audio catalog. Verify every IPI and legal name before filing.";

export function taxSavings(expenses: string | number, rate: string | number): number {
  return ((Number(expenses) || 0) * (Number(rate) || 0)) / 100;
}

/** Streams needed to recover a release cost at the member's own net-per-stream estimate. */
export function breakEvenStreams(
  cost: string | number,
  netPerStream: string | number,
): number | null {
  const per = Number(netPerStream) || 0;
  return per > 0 ? Math.ceil((Number(cost) || 0) / per) : null;
}

/** Build the copy context from the selected catalog song, or from a hand-entered converter share. */
export function contextForTrack(
  track: TrackLike | undefined,
  options: {
    focus?: string | undefined;
    manual?: { scale: ProScale; value: number } | undefined;
    earnings?: EarningsSnapshot | undefined;
    tax?: TaxSnapshot | undefined;
  } = {},
): CopyContext {
  const m = track?.metadata;
  const rows = m ? copyRows(m) : [];
  const focus = options.focus?.trim();
  return {
    title: track?.title || (options.manual ? "Manual PRO share conversion" : "No song selected"),
    artist: m?.artist ?? "",
    album: m?.album ?? "",
    isrc: m?.isrc ?? "",
    iswc: m?.iswc ?? "",
    upc: m?.upc ?? "",
    duration: m?.duration ?? "",
    releaseDate: m?.releaseDate ?? "",
    label: m?.label ?? "",
    rows: focus ? rows.filter((r) => r.name === focus) : rows,
    ...(options.manual ? { manual: options.manual } : {}),
    master: {
      share: m?.masterShare ? `${m.masterShare}%` : "—",
      basis: m?.masterBasis ?? "Copyright Owner",
      performers: m
        ? performers(m).map(
            (p) => `${p.name} — ${p.role}${p.instrument ? ` (${p.instrument})` : ""}`,
          )
        : [],
    },
    ...(options.earnings ? { earnings: options.earnings } : {}),
    ...(options.tax ? { tax: options.tax } : {}),
  };
}

function copyRows(m: Metadata): CopyRow[] {
  const writers = [...(m.writers ?? []), ...(m.composers ?? [])].filter((w) => creditName(w));
  const writerByName = new Map(writers.map((w) => [creditName(w), w]));
  const publishers = (m.publishers ?? []).filter((p) => creditName(p));
  const publisherByName = new Map(publishers.map((p) => [creditName(p), p]));
  return songShareRows(m).map((row) => {
    const person =
      row.half === "Writer" ? writerByName.get(row.label) : publisherByName.get(row.label);
    const selfPublished =
      row.half === "Publisher" && !person
        ? writerByName.get(row.label.split(",")[0]!.trim())
        : undefined;
    return {
      name: row.label,
      role: row.half === "Writer" ? writerRole(person?.role) : "Publisher",
      pro: person?.pro ?? selfPublished?.pro ?? "",
      ipi: person?.ipi ?? selfPublished?.ipi ?? "",
      writer: row.half === "Writer" ? row.catalog : 0,
      publisher: row.half === "Publisher" ? row.catalog : 0,
    };
  });
}

function header(label: string, c: CopyContext): string[] {
  return [
    `CAME THROUGH AUDIO — ${label}`,
    "The Financial Lab · agency-ready copy",
    "=".repeat(52),
    `Song: ${blank(c.title)}`,
    `Artist: ${blank(c.artist)}`,
    `Album: ${blank(c.album)}`,
    `ISRC: ${blank(c.isrc)}  |  ISWC: ${blank(c.iswc)}  |  UPC: ${blank(c.upc)}`,
    `Duration: ${blank(c.duration)}  |  Release: ${blank(c.releaseDate)}  |  Label: ${blank(c.label)}`,
    "",
  ];
}

function manualLines(c: CopyContext): string[] {
  if (!c.manual) return [];
  const v = c.manual.value;
  return [
    "MANUAL PRO SHARE CONVERSION",
    `Entered on the ${PRO_SCALES[c.manual.scale].name} ${PRO_SCALES[c.manual.scale].total}% scale: ${pct(v)}`,
    `ASCAP (100% scale): ${pct(convertBetween(v, c.manual.scale, "ascap"))}`,
    `SESAC (100% scale): ${pct(convertBetween(v, c.manual.scale, "sesac"))}`,
    `BMI (200% scale): ${pct(convertBetween(v, c.manual.scale, "bmi"))}`,
    "",
  ];
}

function agencyRows(c: CopyContext, factor: number): string[] {
  const lines = ["Name | Role | PRO | IPI | Writer share | Publisher share"];
  for (const r of c.rows) {
    lines.push(
      `${r.name} | ${r.role} | ${blank(r.pro)} | ${blank(r.ipi)} | ${pct(r.writer * factor)} | ${pct(r.publisher * factor)}`,
    );
  }
  lines.push(
    `TOTAL | | | | ${pct(c.rows.reduce((n, r) => n + r.writer * factor, 0))} | ${pct(c.rows.reduce((n, r) => n + r.publisher * factor, 0))}`,
  );
  return lines;
}

export function copyForAgency(agency: CopyAgency, c: CopyContext): string {
  const lines = header(`${AGENCY_LABEL[agency].toUpperCase()} REGISTRATION`, c);
  if (c.manual) return [...lines, ...manualLines(c)].join("\n");

  if (agency === "mlc") {
    lines.push("SONGWRITER MECHANICAL SPLIT & METADATA — 100% SCALE");
    lines.push("Writer | Role | PRO | IPI | Writer share");
    for (const r of c.rows.filter((r) => r.writer > 0)) {
      lines.push(`${r.name} | ${r.role} | ${blank(r.pro)} | ${blank(r.ipi)} | ${pct(r.writer)}`);
    }
    lines.push("", "PUBLISHER COLLECTION (context)");
    for (const r of c.rows.filter((r) => r.publisher > 0))
      lines.push(`${r.name} | ${pct(r.publisher)}`);
    lines.push(
      "",
      "The MLC pays the mechanical side. Publisher shares above are the catalog's publisher half.",
      "",
      CATALOG_FOOTER,
    );
    return lines.join("\n");
  }

  if (agency === "soundexchange") {
    lines.push("PERFORMER / OWNER NOTES");
    lines.push(`Recording owner: ${blank(c.artist)}`);
    lines.push(`Master share: ${c.master.share}  |  Basis: ${blank(c.master.basis)}`);
    lines.push(`ISRC: ${blank(c.isrc)}  |  UPC: ${blank(c.upc)}`);
    lines.push("", "PERFORMERS");
    if (c.master.performers.length) for (const p of c.master.performers) lines.push(`- ${p}`);
    else lines.push("- No performers listed in the catalog.");
    lines.push("", "SPLIT CONTEXT");
    lines.push(`Writer total: ${pct(c.rows.reduce((n, r) => n + r.writer, 0))}`);
    lines.push(`Publisher total: ${pct(c.rows.reduce((n, r) => n + r.publisher, 0))}`);
    lines.push(
      "",
      "SoundExchange registers the recording (the master side), not the composition.",
      "",
      CATALOG_FOOTER,
    );
    return lines.join("\n");
  }

  const factor = agency === "bmi" ? 1 : 0.5;
  lines.push(
    `${AGENCY_LABEL[agency].toUpperCase()} REGISTRATION — ${agency === "bmi" ? "200% (100% writer + 100% publisher)" : "100% (50% writer + 50% publisher)"} SCALE`,
  );
  lines.push(...agencyRows(c, factor));
  lines.push("", CATALOG_FOOTER);
  return lines.join("\n");
}

/** A field safe for a spreadsheet cell: quoted only when it has to be. */
const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * The worksheet's block for the projection file: the deductible total, the estimate at the member's rate and the year
 * they named. Empty when there is no worksheet, so a member who never opened the drawer gets exactly the old file.
 */
function taxCsvRows(c: CopyContext): string[] {
  if (!c.tax || c.tax.deductible <= 0) return [];
  const label = c.tax.seRate
    ? `Estimated tax savings at ${c.tax.rate}% + ${c.tax.seRate}% self-employment`
    : `Estimated tax savings at ${c.tax.rate}%`;
  const rows = [
    "",
    [c.title, "Deductible expenses (tax worksheet)", "", "", "", c.tax.deductible.toFixed(2)]
      .map(cell)
      .join(","),
    [c.title, label, "", "", "", c.tax.savings.toFixed(2)].map(cell).join(","),
  ];
  if (c.tax.year)
    rows.push([c.title, `Tax year ${c.tax.year}`, "", "", "", ""].map(cell).join(","));
  return rows;
}

/**
 * The projection as a CSV, for a manager, an accountant or a spreadsheet: one row per platform with the numbers the Lab
 * already shows, then the radio line, the distributor cut and the total. Plain decimals for the rate, so a spreadsheet
 * reads it as a number rather than text. The tax worksheet's block follows whenever the member has one, even before a
 * single stream has been entered.
 */
export function projectionCsv(
  c: CopyContext,
  brand?: Pick<PdfBrand, "name" | "tagline"> | null,
): string {
  const e = c.earnings;
  const name = labBrand(brand ?? null);
  const rows: string[] = [
    [`${name.name.toUpperCase()} — ROYALTY PROJECTION`].map(cell).join(","),
    [name.tagline].map(cell).join(","),
    "",
    ["Song", "Platform", "Streams", "Rate (USD)", "Platform pays (USD)", "Your share (USD)"]
      .map(cell)
      .join(","),
  ];
  if (!e) return [...rows, cell(c.title), ...taxCsvRows(c)].join("\n");
  for (const p of e.platforms) {
    rows.push(
      [c.title, p.name, p.streams, p.rate, p.total.toFixed(2), p.yours.toFixed(2)]
        .map(cell)
        .join(","),
    );
  }
  rows.push(
    [c.title, "Radio / SiriusXM / live", "", "", "", e.radio.toFixed(2)].map(cell).join(","),
  );
  rows.push([c.title, "Your share total", "", "", "", e.total.toFixed(2)].map(cell).join(","));
  if (e.distributor) {
    rows.push([c.title, "Distributor cut", "", "", "", `${e.distributor}%`].map(cell).join(","));
    rows.push(
      [c.title, "You keep after distributor", "", "", "", (e.net ?? e.total).toFixed(2)]
        .map(cell)
        .join(","),
    );
  }
  rows.push(
    [c.title, "Master share", "", "", "", pct(e.masterShare)].map(cell).join(","),
    [c.title, "Song share", "", "", "", pct(e.songShare)].map(cell).join(","),
  );
  rows.push(...taxCsvRows(c));
  return rows.join("\n");
}

export function fullReport(c: CopyContext): string {
  const lines = header("FULL ROYALTY REPORT", c);
  if (c.manual) lines.push(...manualLines(c));
  else {
    lines.push("PRO SHARE TABLE — CATALOG SHARES (each half out of 100%)");
    lines.push("Name | Role | PRO | IPI | Catalog share | ASCAP | SESAC | BMI");
    for (const r of c.rows) {
      const share = r.writer + r.publisher;
      lines.push(
        `${r.name} | ${r.role} | ${blank(r.pro)} | ${blank(r.ipi)} | ${pct(share)} | ${pct(share * 0.5)} | ${pct(share * 0.5)} | ${pct(share)}`,
      );
    }
    lines.push("", "PRO SCALE TOTALS");
    for (const k of ["ascap", "sesac", "bmi"] as const) {
      const factor = PRO_SCALES[k].factor;
      lines.push(
        `${PRO_SCALES[k].name} (${PRO_SCALES[k].total}%): ${pct(c.rows.reduce((n, r) => n + r.writer * factor, 0))} writer / ${pct(c.rows.reduce((n, r) => n + r.publisher * factor, 0))} publisher`,
      );
    }
    lines.push("");
  }

  if (c.earnings) {
    lines.push("PROJECTED ROYALTY EARNINGS");
    lines.push(
      `Master share: ${pct(c.earnings.masterShare)}  |  Song share: ${pct(c.earnings.songShare)}`,
    );
    lines.push("Platform | Streams | Rate | Platform pays | Your share");
    for (const p of c.earnings.platforms) {
      lines.push(
        `${p.name} | ${p.streams.toLocaleString("en-US")} | $${p.rate.toFixed(4)} | ${money(p.total)} | ${money(p.yours)}`,
      );
    }
    lines.push(`Radio / SiriusXM / live | | | | ${money(c.earnings.radio)}`);
    lines.push("", `YOUR SHARE TOTAL: ${money(c.earnings.total)}`);
    if (c.earnings.distributor) {
      lines.push(
        `Distributor's cut: ${pct(c.earnings.distributor)}  |  You keep after distributor: ${money(c.earnings.net ?? c.earnings.total)}`,
      );
    } else {
      lines.push(`You keep after distributor: ${money(c.earnings.total)}`);
    }
    if (c.earnings.territories?.length) {
      lines.push("", "LISTENER MIX (planning assumption, not a published rate)");
      for (const t of c.earnings.territories) lines.push(`${t.label}: ${pct(t.share)}`);
    }
    lines.push("Estimates only. Platform rates vary by country, subscription tier and agreement.");
  } else {
    lines.push("No projected earnings snapshot was included.");
  }
  return lines.join("\n");
}
