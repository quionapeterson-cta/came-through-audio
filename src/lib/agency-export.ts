import { saveBlob, type CatalogTrack } from "@/lib/catalog";
import { isoDate, MLC_ROLE, parentGenre, performers, writerRole, type Contributor } from "@/lib/metadata";
import { isBmi } from "@/lib/audit";
import { registrationReadiness, registrationWriters, type MissingItem } from "@/lib/readiness";

export type Agency = "mlc" | "soundexchange" | "pro";
export const AGENCY_LABEL: Record<Agency, string> = {
  mlc: "The MLC Bulk Work Registration (.xlsx)",
  soundexchange: "SoundExchange Direct ISRC Ingest (.xlsx)",
  pro: "BMI / ASCAP Registration Cheat Sheet (.xlsx)",
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
/**
 * A date for an agency form that insists on MM/DD/YYYY (founder, 2026-11-12): Spotify and a hand-typed year publish
 * "2019" or "2019-05", and `sheetDate` alone turned either into a blank cell — the release date disappeared from the
 * export although the catalog had it. `isoDate` completes the day exactly the way the database already does, so what the
 * agency receives matches what the catalog itself holds. A full date passes through untouched.
 */
const formDate = (iso: string) => sheetDate(isoDate(iso));
/**
 * A SoundExchange collection rights cell: the date when the song has one, otherwise blank — because a blank Collection
 * Rights Begin/End date is exactly how SoundExchange reads inception and perpetuity (founder, 2026-11-14). A date column
 * holding the words "Inception" or "Perpetuity" is a date the form cannot parse.
 */
const rightsCell = (date: string): Date | string => sheetDate(date) || "";
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

/** mm:ss with two-digit minutes ("3:45" → "03:45"), the way agency forms want it, so nobody adds the zero by hand. */
const mmss = (d: string) => {
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(d ?? "");
  return m ? `${m[1]!.padStart(2, "0")}:${m[2]}` : "";
};

/**
 * The MLC's bulk file requires a publisher name and IPI on every writer's row. A publisher with no IPI (e.g. HFA only),
 * or a song with no publisher (BMI writers paid the publisher share by BMI, or self-published), gets this placeholder so
 * the file is accepted; the user removes it in The MLC Portal after the upload (founder-verified, 2026-10-25).
 */
export const MLC_PLACEHOLDER_IPI = "123456789";
const mlcNeedsPlaceholder = (m: CatalogTrack["metadata"]) => {
  const pubs = named(m.publishers);
  if (!pubs.length || pubs.some((p) => !ipi(p.ipi))) return true;
  // More writers than publishers: the leftover rows have no publisher to pair with, so they carry the placeholder too
  // (the notes have to name those songs, or the member never learns to remove it in The MLC Portal).
  return pubs.length > 1 && registrationWriters(m).length > pubs.length;
};
/** Titles whose MLC rows carry the placeholder publisher IPI, so the export can say which songs to tidy up. */
export const mlcPlaceholderSongs = (tracks: CatalogTrack[]) => tracks.filter((t) => mlcNeedsPlaceholder(t.metadata)).map((t) => t.title || "Untitled");

/**
 * Rows for the official MLC "Format" sheet (21 columns), one row per writer; title only on the first row of a work.
 * The publisher's HFA P# fills the MLC PUBLISHER NUMBER column, separate from its IPI. With no publisher, each writer
 * is listed as their own publisher (legal name) with the placeholder IPI.
 */
export function mlcRows(tracks: CatalogTrack[]): (string | number)[][] {
  const rows: (string | number)[][] = [];
  for (const { metadata: m } of tracks) {
    const people = registrationWriters(m).map((w) => ({ c: w, role: MLC_ROLE[writerRole(w.role)] }));
    const pubs = named(m.publishers);
    // Alternate titles go in the AKA columns, one per writer row ("AT" = alternative title), as the template's example does.
    const akas = (m.alternateTitles ?? []).map((t) => t.trim()).filter(Boolean);
    people.forEach(({ c, role }, i) => {
      const { last, first } = splitName(c.name);
      // One publisher covers every writer; with several, they pair up with writers in order.
      const pub = pubs.length === 1 ? pubs[0] : pubs[i];
      rows.push([
        i === 0 ? m.title : "", "", "", i === 0 ? m.iswc.replace(/[.\s-]/g, "").toUpperCase() : "", akas[i]?.toUpperCase() ?? "", akas[i] ? "AT" : "",
        last.toUpperCase(), first.toUpperCase(), ipi(c.ipi), role, pub?.hfa?.trim().toUpperCase() ?? "",
        (pub?.name ?? c.name).toUpperCase(), (pub && ipi(pub.ipi)) || MLC_PLACEHOLDER_IPI, "", "", "",
        num(c.percentage), i === 0 ? m.title : "", i === 0 ? m.artist : "", i === 0 ? m.isrc.replace(/-/g, "").toUpperCase() : "",
        // A self-released song goes out under the artist as its label, the same rule the SoundExchange row uses.
        i === 0 ? m.label || m.artist : "",
      ]);
    });
  }
  return rows;
}

/**
 * Rows for the official SoundExchange Direct ISRC Ingest "Form" sheet (29 columns), one row per recording.
 * Following its instructions: the claim comes from the song's Master ownership (100% is written as 1, the column is a
 * percent), a collection right that starts at inception or runs in perpetuity is left blank because that is how the form
 * reads an empty date, a self-released song uses the artist as label, and anything we don't know (a country, the recording's full date, a catalog number) stays blank rather than
 * guessed.
 *
 * Every column the catalog answers is filled (founder, 2026-11-12): the recording version and the country of recording
 * were there all along and were being dropped, which is what made a member's own ingest file look half-empty.
 */
export function soundExchangeRows(tracks: CatalogTrack[]): (string | number | Date)[][] {
  return tracks.map(({ metadata: m }) => {
    const year = (m.releaseDate ?? "").slice(0, 4);
    const label = m.label || m.artist;
    return [
      artistCredit(m.artist, m.featured), m.title, m.isrc.replace(/-/g, "").toUpperCase(), m.masterBasis || "Copyright Owner",
      // The claim is the catalog's Master ownership section: who claims it, how much, and from when (blank = inception /
      // perpetuity, which is what the form reads an empty date as).
      Number(m.masterShare || 100) / 100, rightsCell(m.rightsStart), rightsCell(m.rightsEnd), m.collectionTerritories,
      // "Recording Version, if applicable" (live, remix, sped up): the catalog keeps it apart from the title.
      m.version,
      // Duration, then SoundExchange's main genre ("Trap" goes as Hip-Hop/Rap), then the recording date: blank unless a
      // full day was entered, because a year alone can't be made into an honest MM/DD/YYYY.
      hms(m.duration), m.primaryGenre ? parentGenre(m.primaryGenre) : "", formDate(m.recordingDate), m.recordedIn, m.masteredIn, m.ownerNationality, formDate(m.releaseDate), m.firstReleaseCountry,
      pLine(m.phonographic) || (year && label ? `${year} ${label}` : ""), m.iswc.replace(/[.\s-]/g, "").toUpperCase(),
      registrationWriters(m).map((c) => c.name).join("; "), named(m.publishers).map((p) => p.name).join("; "),
      m.artist, m.album || m.title, m.releaseVersion, m.upc, m.catalogNumber, formDate(m.releaseDate), m.releaseCountry, label,
    ];
  });
}

/**
 * A copy-and-paste sheet (founder, 2026-11-06): an .xlsx where every cell is stored as plain text, so IPI 00549852210
 * keeps its zeros and a duration stays 03:20, with no `="…"` wrapper to delete after pasting. The header row is bold and
 * frozen, and columns are sized to their longest value.
 */
async function textSheet(rows: string[][], sheetName: string) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
  rows.forEach((r, i) => {
    const row = ws.addRow(r);
    row.eachCell({ includeEmpty: true }, (c) => {
      c.numFmt = "@";
      c.font = { name: "Calibri", size: 12, bold: i === 0, color: { argb: "FF0B0B0B" } };
      c.alignment = { vertical: "top", horizontal: "left" };
    });
  });
  (rows[0] ?? []).forEach((_, j) => { ws.getColumn(j + 1).width = Math.min(60, Math.max(10, ...rows.map((r) => (r[j] ?? "").length + 2))); });
  return new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
const text = (v: unknown) => (v === undefined || v === null ? "" : String(v));

/** Field-by-field sheet for typing into ASCAP Member Access / BMI Online Services work registration. */
export function proCheatSheet(tracks: CatalogTrack[]): string[][] {
  // The work-level answers ASCAP and BMI ask for sit on every party row (founder, 2026-11-12): the catalog has them and
  // the sheet was leaving them behind, so a member had to look them up again while filling the form.
  const rows: unknown[][] = [["Work Title", "ISWC", "ISRC", "Performing Artist", "Duration (mm:ss)", "Party Type", "Name", "Role", "Share %", "PRO", "IPI #", "Alternate Titles", "Samples", "Written For", "Instrumental"]];
  for (const { metadata: m } of tracks) {
    // BMI asks for the duration; a text cell keeps 03:45 from turning into a time of day.
    const work = [
      (m.alternateTitles ?? []).map((t) => t.trim()).filter(Boolean).join("; "),
      m.samples === "Yes" ? `Yes${m.sampleTitle ? `: ${m.sampleTitle}` : ""}${m.sampleWriters ? ` (${m.sampleWriters})` : ""}` : m.samples,
      m.writtenFor === "" ? "" : m.writtenFor === "No" ? "No" : `Yes: ${m.writtenFor}${m.productionTitle ? ` — ${m.productionTitle}` : ""}`,
      m.instrumental ? "Yes" : "No",
    ];
    const base = [m.title, m.iswc, m.isrc, m.artist, mmss(m.duration)];
    for (const w of registrationWriters(m)) rows.push([...base, "Writer", w.name, w.role, w.percentage, w.pro, w.ipi, ...work]);
    for (const p of named(m.publishers)) rows.push([...base, "Publisher", p.name, "Original Publisher", p.percentage, p.pro, p.ipi, ...work]);
    // No publisher: BMI pays its writers the publisher share, so the sheet says so instead of leaving it blank.
    if (!named(m.publishers).length && registrationWriters(m).some(isBmi)) rows.push([...base, "Publisher", "None: BMI pays the publisher share to its writers", "", "", "BMI", "", ...work]);
  }
  return rows.map((r) => r.map(text));
}

/** Master owner from the ℗ line ("℗ 2026 Came Through Audio" → "Came Through Audio"), else the label, else the artist. */
const masterOwner = (m: CatalogTrack["metadata"]) => pLine(m.phonographic).replace(/^\d{4}\s+/, "").trim() || m.label || m.artist;

/**
 * Neighbouring Rights Pack: one row per performer per recording, with the fields PPL and SoundExchange International
 * ask for. Songs without an ISRC are left out (societies match recordings by ISRC) and returned so the UI can say so.
 */
export function neighbouringRows(tracks: CatalogTrack[]) {
  const rows: string[][] = [["ISRC", "Title", "Main Artist", "Performer", "Featured / Non-featured", "Role", "Instrument", "Recorded In", "Year Recorded", "Master Owner", "Label", "Release Date", "UPC", "Duration"]];
  const skipped: CatalogTrack[] = [];
  for (const t of tracks) {
    const m = t.metadata;
    if (!m.isrc.trim()) { skipped.push(t); continue; }
    const year = m.recordedYear || (m.releaseDate ?? "").slice(0, 4);
    for (const p of performers(m)) {
      rows.push([m.isrc.replace(/-/g, "").toUpperCase(), m.title, artistCredit(m.artist, m.featured), p.name, p.featured ? "Featured" : "Non-featured", p.role, p.instrument,
        m.recordedIn, year, masterOwner(m), m.label, m.releaseDate, m.upc, mmss(m.duration)].map(text));
    }
  }
  return { rows, skipped };
}

export async function downloadNeighbouringPack(tracks: CatalogTrack[], name: string) {
  const { rows, skipped } = neighbouringRows(tracks);
  if (skipped.length < tracks.length) save(await textSheet(rows, "Neighbouring Rights"), `${name} - Neighbouring Rights Pack.xlsx`);
  return skipped;
}

/** One save path for every file: it says so honestly and offers a Save button when the browser blocks it. */
function save(blob: Blob, filename: string) {
  saveBlob(blob, filename);
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

/** The MLC accepts at most this many rows per bulk file (one row per writer). */
export const MLC_MAX_ROWS = 300;
/** Splits songs into MLC files of at most 300 rows, never splitting one song's rows across files. */
export function mlcFiles(tracks: CatalogTrack[]): CatalogTrack[][] {
  const files: CatalogTrack[][] = [];
  let cur: CatalogTrack[] = [], rows = 0;
  for (const t of tracks) {
    const n = Math.max(1, mlcRows([t]).length);
    if (cur.length && rows + n > MLC_MAX_ROWS) { files.push(cur); cur = []; rows = 0; }
    cur.push(t); rows += n;
  }
  if (cur.length) files.push(cur);
  return files;
}

/** Exports the ready songs and returns the ones held back so the UI can say what to fix. */
export async function downloadAgencyExport(agency: Agency, tracks: CatalogTrack[], name: string): Promise<Held[]> {
  const { ready, held } = exportGate(agency, tracks);
  if (!ready.length) return held;
  if (agency === "mlc") {
    const files = mlcFiles(ready);
    for (const [i, part] of files.entries()) {
      const suffix = files.length > 1 ? ` (${i + 1} of ${files.length})` : "";
      save(await fillTemplate("/templates/MLCBulkWork_V1.2.xlsx", "Format", 2, 11, mlcRows(part)), `${name} - MLC Bulk Work Registration${suffix}.xlsx`);
      // Browsers can drop back-to-back downloads; a short pause lets each file through.
      if (i < files.length - 1) await new Promise((r) => setTimeout(r, 600));
    }
  }
  else if (agency === "soundexchange") save(await fillTemplate("/templates/ISRC_Ingest_Form.xlsx", "Form", 11, 11, soundExchangeRows(ready), [5]), `${name} - SoundExchange ISRC Ingest.xlsx`);
  else save(await textSheet(proCheatSheet(ready), "BMI-ASCAP"), `${name} - BMI-ASCAP Registration Cheat Sheet.xlsx`);
  return held;
}

/** When each song was last exported to each agency: `${trackId}:${agency}` → ISO date. Empty until the migration runs. */
export async function listExports(): Promise<Map<string, string>> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.from("agency_exports" as never).select("track_id, agency, exported_at");
  return new Map(((data ?? []) as { track_id: string; agency: string; exported_at: string }[]).map((r) => [`${r.track_id}:${r.agency}`, r.exported_at]));
}

/**
 * Forgets that these songs were exported to one agency, so the next export can include them again. A member who
 * downloaded the wrong scope (or the wrong file) starts that agency over instead of waiting for a portal to come back.
 * The files already downloaded are untouched; this only clears the bookmark.
 */
export async function deleteExports(agency: Agency) {
  const { supabase } = await import("@/integrations/supabase/client");
  const { error } = await supabase.from("agency_exports" as never).delete().eq("agency", agency);
  if (error) throw error;
}

/** Records an export of these songs (best effort: a failure never blocks the download). */
export async function recordExports(agency: Agency, trackIds: string[]) {
  if (!trackIds.length) return;
  const { supabase } = await import("@/integrations/supabase/client");
  const now = new Date().toISOString();
  await supabase.from("agency_exports" as never).upsert(trackIds.map((track_id) => ({ track_id, agency, exported_at: now })) as never, { onConflict: "track_id,agency" });
}
