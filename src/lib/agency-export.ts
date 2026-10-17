import type { CatalogTrack } from "@/lib/catalog";
import { MLC_ROLE, writerRole, type Contributor } from "@/lib/metadata";
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
const usDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[2]}/${m[3]}/${m[1]}` : "";
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
      const pub = pubs[i] ?? pubs[0];
      rows.push([
        i === 0 ? m.title : "", "", "", i === 0 ? m.iswc.replace(/[.\s-]/g, "").toUpperCase() : "", "", "",
        last.toUpperCase(), first.toUpperCase(), num(c.ipi), role, "",
        pub?.name.toUpperCase() ?? "", pub ? num(pub.ipi) : "", "", "", "",
        num(c.percentage), i === 0 ? m.title : "", i === 0 ? m.artist : "", i === 0 ? m.isrc.replace(/-/g, "").toUpperCase() : "", i === 0 ? m.label : "",
      ]);
    });
  }
  return rows;
}

/** Rows for the official SoundExchange Direct ISRC Ingest "Form" sheet (29 columns), one row per recording. */
export function soundExchangeRows(tracks: CatalogTrack[]): (string | number)[][] {
  return tracks.map(({ metadata: m }) => {
    const year = (m.releaseDate ?? "").slice(0, 4);
    return [
      m.artist, m.title, m.isrc.replace(/-/g, "").toUpperCase(), "Copyright Owner", 100, usDate(m.releaseDate), "", "", "",
      hms(m.duration), m.primaryGenre ?? "", "", "United States", "", "United States", usDate(m.releaseDate), "United States",
      year && m.label ? `℗ ${year} ${m.label}` : "", m.iswc.replace(/[.\s-]/g, "").toUpperCase(),
      registrationWriters(m).map((c) => c.name).join("; "), named(m.publishers).map((p) => p.name).join("; "),
      m.artist, m.album || m.title, "", m.upc, "", usDate(m.releaseDate), "United States", m.label,
    ];
  });
}

const cell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** Field-by-field sheet for typing into ASCAP Member Access / BMI Online Services work registration. */
export function proCheatSheet(tracks: CatalogTrack[]): string {
  const rows: unknown[][] = [["Work Title", "ISWC", "ISRC", "Performing Artist", "Party Type", "Name", "Role", "Share %", "PRO", "IPI #"]];
  for (const { metadata: m } of tracks) {
    const base = [m.title, m.iswc, m.isrc, m.artist];
    for (const w of registrationWriters(m)) rows.push([...base, "Writer", w.name, w.role, w.percentage, w.pro, w.ipi]);
    for (const p of named(m.publishers)) rows.push([...base, "Publisher", p.name, "Original Publisher", p.percentage, p.pro, p.ipi]);
  }
  return rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function fillTemplate(path: string, sheet: string, firstRow: number, clearTo: number, rows: (string | number)[][]) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await (await fetch(path)).arrayBuffer());
  const ws = wb.getWorksheet(sheet)!;
  for (let r = firstRow; r <= Math.max(clearTo, firstRow + rows.length); r++) ws.getRow(r).eachCell({ includeEmpty: true }, (c) => { c.value = null; });
  rows.forEach((vals, i) => vals.forEach((v, j) => { ws.getCell(firstRow + i, j + 1).value = v === "" ? null : v; }));
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
  else if (agency === "soundexchange") save(await fillTemplate("/templates/ISRC_Ingest_Form.xlsx", "Form", 11, 11, soundExchangeRows(ready)), `${name} - SoundExchange ISRC Ingest.xlsx`);
  else save(new Blob([proCheatSheet(ready)], { type: "text/csv;charset=utf-8" }), `${name} - BMI-ASCAP Registration Cheat Sheet.csv`);
  return held;
}
