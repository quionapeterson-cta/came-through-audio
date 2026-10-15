import type { CatalogTrack } from "@/lib/catalog";

export type Agency = "mlc" | "soundexchange" | "pro";
export const AGENCY_LABEL: Record<Agency, string> = { mlc: "The MLC", soundexchange: "SoundExchange", pro: "ASCAP / BMI" };

const cell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n");
const named = <T extends { name: string }>(r: T[] | undefined) => (r ?? []).filter((x) => x.name.trim());

/** Builds an agency-formatted CSV (one row per writer/publisher for works, one row per track for masters). */
export function agencyCsv(agency: Agency, tracks: CatalogTrack[]): string {
  if (agency === "soundexchange") {
    return csv([["ISRC", "Track Title", "Featured Artist", "Album Title", "UPC", "Label", "Release Date", "Duration", "Genre", "Producers"],
      ...tracks.map(({ metadata: m }) => [m.isrc, m.title, m.artist, m.album, m.upc, m.label, m.releaseDate, m.duration, m.primaryGenre, named(m.producers).map((p) => p.name).join("; ")])]);
  }
  const head = ["Work Title", "ISWC", "ISRC", "Performing Artist", "Party Type", "Party Name", "Role", "Share %", "PRO", "IPI"];
  const rows: unknown[][] = [head];
  for (const { metadata: m } of tracks) {
    const base = [m.title, m.iswc, m.isrc, m.artist];
    const start = rows.length;
    for (const w of named(m.writers)) rows.push([...base, "Writer", w.name, "Writer", w.percentage, w.pro, w.ipi]);
    for (const c of named(m.composers)) rows.push([...base, "Writer", c.name, "Composer", c.percentage, c.pro, c.ipi]);
    for (const p of named(m.publishers)) rows.push([...base, "Publisher", p.name, "Publisher", p.percentage, p.pro, p.ipi]);
    if (rows.length === start) rows.push([...base, "", "", "", "", "", ""]);
  }
  return csv(rows);
}

export function downloadAgencyCsv(agency: Agency, tracks: CatalogTrack[], name: string) {
  const blob = new Blob([agencyCsv(agency, tracks)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name} - ${AGENCY_LABEL[agency].replace(/[^\w]+/g, "")} registration.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
