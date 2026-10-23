import type { CatalogTrack } from "@/lib/catalog";
import { MLC_ROLE, performers, writerRole, type Contributor } from "@/lib/metadata";
import { isBmi } from "@/lib/audit";
import { registrationReadiness, registrationWriters, type MissingItem } from "@/lib/readiness";

export type Agency = "mlc" | "soundexchange" | "pro";
export const AGENCY_LABEL: Record<Agency, string> = {
  mlc: "The MLC Bulk Work Registration (.xlsx)",
  soundexchange: "SoundExchange Direct ISRC Ingest (.xlsx)",
  pro: "BMI / ASCAP Registration Cheat Sheet (.csv)",
};

const named = (r: Contributor[] | undefined) => (r ?? []).filter((x) => x.name.trim());
const splitName = (full: string) => {
  const p = full.trim().split(/\s+/);
  return p.length > 1 ? { last: p.pop()!, first: p.join(" ") } : { last: p[0] ?? "", first: "" };
};
const num = (v: string) => (v && Number.isFinite(Number(v)) ? Number(v) : "");
/** IPI numbers are identifiers: keep them as text so leading zeros survive (00123456789 stays 11 digits). */
const ipi = (v: string) => (v ?? "").replace(/\D/g, "");
/** Real spreadsheet dates (UTC midnight), shown as MM/DD/YYYY by the column format. */
const sheetDate = (iso: string): Date | "" => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : "";
};
/** The (P) line without its symbol, as SoundExchange writes it ("2007 XYZ Records"). */
// A bare "P" counts as the symbol only before a space or the year, so "Prince Records" keeps its P.
const pLine = (v: string) => (v ?? "").replace(/^\s*(℗|\(P\)|P(?=[\s\d]))\s*/i, "").trim();
/** Artist credit with featured artists, as SoundExchange asks ("James Jamz feat. Plain Jane"). */
const artistCredit = (artist: string, featured: string[] = []) => {
  const f = featured.map((x) => x.trim()).filter(Boolean);
  return f.length ? `${artist} feat. ${f.join(", ")}` : artist;
};
const hms = (d: string) => {
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(d ?? "");
  if (!m) return "";
  const t = Number(m[1]) * 60 + Number(m[2]);
  return [Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60].map((n) => String(n).padStart(2, "0")).join(":");
};

/** Rows for the official MLC "Format" sheet (21 columns), one row per writer; title only on the first row of a work. */
export function mlcRows(tracks: CatalogTrack[]): (string | number)[][] {
  const rows: (string | number)[][] = [];
  for (const { metadata: m } of tracks) {
    const people = registrationWriters(m).map((w) => ({ c: w, role: MLC_ROLE[writerRole(w.role)] }));
    const pubs = named(m.publishers);
    people.forEach(({ c, role }, i) => {
      const { last, first } = splitName(c.name);
      // One publisher covers every writer; with several, they pair up with writers in order.
      const pub = pubs.length === 1 ? pubs[0] : pubs[i];
      rows.push([
        i === 0 ? m.title : "", "", "", i === 0 ? m.iswc.replace(/[.\s-]/g, "").toUpperCase() : "", "", "",
        last.toUpperCase(), first.toUpperCase(), ipi(c.ipi), role, "",
        pub?.name.toUpperCase() ?? "", pub ? ipi(pub.ipi) : "", "", "", "",
        num(c.percentage), i === 0 ? m.title : "", i === 0 ? m.artist : "", i === 0 ? m.isrc.replace(/-/g, "").toUpperCase() : "", i === 0 ? m.label : "",
      ]);
    });
  }
  return rows;
}

/**
 * Rows for the official SoundExchange Direct ISRC Ingest "Form" sheet (29 columns), one row per recording.
 * Following its instructions: the claim comes from the song's Master ownership (100% is written as 1, the column is a
 * percent), begin/end dates stay blank for rights from inception in perpetuity, a self-released song uses the artist as
 * label, and anything we don't know (countries, recording date) stays blank rather than guessed.
 */
export function soundExchangeRows(tracks: CatalogTrack[]): (string | number | Date)[][] {
  return tracks.map(({ metadata: m }) => {
    const year = (m.releaseDate ?? "").slice(0, 4);
    const label = m.label || m.artist;
    return [
      artistCredit(m.artist, m.featured), m.title, m.isrc.replace(/-/g, "").toUpperCase(), m.masterBasis || "Copyright Owner",
      Number(m.masterShare || 100) / 100, sheetDate(m.rightsStart ?? ""), sheetDate(m.rightsEnd ?? ""), "", "",
      hms(m.duration), m.primaryGenre ?? "", "", "", "", "", sheetDate(m.releaseDate), "",
      pLine(m.phonographic) || (year && label ? `${year} ${label}` : ""), m.iswc.replace(/[.\s-]/g, "").toUpperCase(),
      registrationWriters(m).map((c) => c.name).join("; "), named(m.publishers).map((p) => p.name).join("; "),
      m.artist, m.album || m.title, "", m.upc, "", sheetDate(m.releaseDate), "", label,
    ];
  });
}

const cell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** Keeps digit-only IDs as text when the CSV opens in Excel or Google Sheets, so IPI 00123456789 keeps its zeros. */
const idText = (v: string) => (v && /^\d+$/.test(v) ? `="${v}"` : v);
/** Field-by-field sheet for typing into ASCAP Member Access / BMI Online Services work registration. */
export function proCheatSheet(tracks: CatalogTrack[]): string {
  const rows: unknown[][] = [["Work Title", "ISWC", "ISRC", "Performing Artist", "Party Type", "Name", "Role", "Share %", "PRO", "IPI #"]];
  for (const { metadata: m } of tracks) {
    const base = [m.title, m.iswc, m.isrc, m.artist];
    for (const w of registrationWriters(m)) rows.push([...base, "Writer", w.name, w.role, w.percentage, w.pro, idText(w.ipi)]);
    for (const p of named(m.publishers)) rows.push([...base, "Publisher", p.name, "Original Publisher", p.percentage, p.pro, idText(p.ipi)]);
    // No publisher: BMI pays its writers the publisher share, so the sheet says so instead of leaving it blank.
    if (!named(m.publishers).length && registrationWriters(m).some(isBmi)) rows.push([...base, "Publisher", "None: BMI pays the publisher share to its writers", "", "", "BMI", ""]);
  }
  return rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

/** Master owner from the ℗ line ("℗ 2026 Came Through Audio" → "Came Through Audio"), else the label, else the artist. */
const masterOwner = (m: CatalogTrack["metadata"]) => pLine(m.phonographic).replace(/^\d{4}\s+/, "").trim() || m.label || m.artist;

/**
 * Neighbouring Rights Pack: one row per performer per recording, with the fields PPL and SoundExchange International
 * ask for. Songs without an ISRC are left out (societies match recordings by ISRC) and returned so the UI can say so.
 */
export function neighbouringRows(tracks: CatalogTrack[]) {
  const rows: unknown[][] = [["ISRC", "Title", "Main Artist", "Performer", "Featured / Non-featured", "Role", "Instrument", "Recorded In", "Year Recorded", "Master Owner", "Label", "Release Date", "UPC", "Duration"]];
  const skipped: CatalogTrack[] = [];
  for (const t of tracks) {
    const m = t.metadata;
    if (!m.isrc.trim()) { skipped.push(t); continue; }
    const year = m.recordedYear || (m.releaseDate ?? "").slice(0, 4);
    for (const p of performers(m)) {
      rows.push([m.isrc.replace(/-/g, "").toUpperCase(), m.title, artistCredit(m.artist, m.featured), p.name, p.featured ? "Featured" : "Non-featured", p.role, p.instrument,
        m.recordedIn, year, masterOwner(m), m.label, m.releaseDate, idText(m.upc), m.duration]);
    }
  }
  return { csv: rows.map((r) => r.map(cell).join(",")).join("\r\n"), skipped };
}

export function downloadNeighbouringPack(tracks: CatalogTrack[], name: string) {
  const { csv, skipped } = neighbouringRows(tracks);
  if (skipped.length < tracks.length) save(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${name} - Neighbouring Rights Pack.csv`);
  return skipped;
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

type Cell = string | number | Date;
/** Number format for a filled cell: dates as MM/DD/YYYY, the percent column as 0%, everything else as plain text. */
const cellFormat = (v: Cell, percentCols: number[], col: number) =>
  v instanceof Date ? "mm/dd/yyyy" : percentCols.includes(col) ? "0%" : typeof v === "number" ? "0" : "@";

/**
 * Fills an official agency template. The templates' leftover example rows carry mixed fonts and formats
 * (tiny text, 0.00%, mm-dd-yy), so every data cell gets one clean, readable style instead of inheriting them.
 */
async function fillTemplate(path: string, sheet: string, firstRow: number, clearTo: number, rows: Cell[][], percentCols: number[] = []) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await (await fetch(path)).arrayBuffer());
  const ws = wb.getWorksheet(sheet)!;
  const width = Math.max(ws.columnCount, ...rows.map((r) => r.length));
  for (let r = firstRow; r <= Math.max(clearTo, firstRow + rows.length); r++) {
    // Drop the template's fixed row heights so wrapped titles and names show in full.
    const row = ws.getRow(r) as { height?: number; customHeight?: boolean };
    delete row.height; row.customHeight = false;
    for (let c = 1; c <= width; c++) {
      const cell = ws.getCell(r, c);
      cell.value = null;
      cell.style = { font: { name: "Calibri", size: 12, color: { argb: "FF0B0B0B" } }, alignment: { vertical: "top", horizontal: "left", wrapText: true } };
    }
  }
  rows.forEach((vals, i) => {
    let lines = 1;
    vals.forEach((v, j) => {
      if (v === "") return;
      const cell = ws.getCell(firstRow + i, j + 1);
      cell.value = v;
      cell.numFmt = cellFormat(v, percentCols, j + 1);
      // Spreadsheet apps don't auto-size rows on open, so size each row to its longest wrapped value.
      const chars = Math.max(4, Math.floor((ws.getColumn(j + 1).width ?? 10) * 1.1));
      if (typeof v === "string") lines = Math.max(lines, Math.ceil(v.length / chars));
    });
    ws.getRow(firstRow + i).height = Math.min(lines, 6) * 16 + 2;
  });
  // Open on the first column and first data row (the MLC template was saved scrolled to column L).
  ws.views = [{ state: "normal", activeCell: `A${firstRow}`, zoomScale: 100 }];
  wb.views = (wb.views ?? []).map((v) => ({ ...v, activeTab: 0, firstSheet: 0 }));
  return new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export type Held = { track: CatalogTrack; missing: MissingItem[] };
/** Splits tracks by the shared readiness check; only ready songs may enter an agency export. */
export function exportGate(agency: Agency, tracks: CatalogTrack[]) {
  const ready: CatalogTrack[] = [];
  const held: Held[] = [];
  for (const track of tracks) {
    const r = registrationReadiness(track.metadata, agency);
    if (r.ready) ready.push(track); else held.push({ track, missing: r.missing });
  }
  return { ready, held };
}

/** Exports the ready songs and returns the ones held back so the UI can say what to fix. */
export async function downloadAgencyExport(agency: Agency, tracks: CatalogTrack[], name: string): Promise<Held[]> {
  const { ready, held } = exportGate(agency, tracks);
  if (!ready.length) return held;
  if (agency === "mlc") save(await fillTemplate("/templates/MLCBulkWork_V1.2.xlsx", "Format", 2, 11, mlcRows(ready)), `${name} - MLC Bulk Work Registration.xlsx`);
  else if (agency === "soundexchange") save(await fillTemplate("/templates/ISRC_Ingest_Form.xlsx", "Form", 11, 11, soundExchangeRows(ready), [5]), `${name} - SoundExchange ISRC Ingest.xlsx`);
  else save(new Blob([proCheatSheet(ready)], { type: "text/csv;charset=utf-8" }), `${name} - BMI-ASCAP Registration Cheat Sheet.csv`);
  return held;
}
