import type { CatalogTrack } from "@/lib/catalog";
import { MLC_ROLE, writerRole, type Contributor } from "@/lib/metadata";

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
    const people = [
      ...named(m.writers).map((w) => ({ c: w, role: MLC_ROLE[writerRole(w.role)] })),
      ...named(m.composers).map((w) => ({ c: w, role: "C" })),
    ];
    const pubs = named(m.publishers);
    if (!people.length) people.push({ c: { name: "", pro: "", ipi: "", percentage: "" }, role: "" });
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
      [...named(m.writers), ...named(m.composers)].map((c) => c.name).join("; "), named(m.publishers).map((p) => p.name).join("; "),
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
    for (const w of named(m.writers)) rows.push([...base, "Writer", w.name, writerRole(w.role), w.percentage, w.pro, w.ipi]);
    for (const c of named(m.composers)) rows.push([...base, "Writer", c.name, "Composer", c.percentage, c.pro, c.ipi]);
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

export async function downloadAgencyExport(agency: Agency, tracks: CatalogTrack[], name: string) {
  if (agency === "mlc") return save(await fillTemplate("/templates/MLCBulkWork_V1.2.xlsx", "Format", 2, 11, mlcRows(tracks)), `${name} - MLC Bulk Work Registration.xlsx`);
  if (agency === "soundexchange") return save(await fillTemplate("/templates/ISRC_Ingest_Form.xlsx", "Form", 11, 11, soundExchangeRows(tracks)), `${name} - SoundExchange ISRC Ingest.xlsx`);
  save(new Blob([proCheatSheet(tracks)], { type: "text/csv;charset=utf-8" }), `${name} - BMI-ASCAP Registration Cheat Sheet.csv`);
}
