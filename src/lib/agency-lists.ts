import type { CatalogTrack } from "@/lib/catalog";
import { creditName } from "@/lib/metadata";

/**
 * "Confirm with your agency lists" (PLAN-royalty-health-report §3A): the user downloads their own list of registered
 * works or recordings from an agency account and uploads it. The file is read in the browser and never stored; only
 * the comparison is saved. Every agency formats its export differently, so columns are found by their headings.
 */
export type ListWriter = { name: string; share?: number | undefined; ipi?: string | undefined; pro?: string | undefined };
export type ListWork = { title: string; iswc: string; isrc: string; workId: string; writers: ListWriter[] };
export type ListMatch = { trackId: string; title: string; work?: ListWork; issues: string[] };
export type ListResult = { matched: ListMatch[]; differences: ListMatch[]; notListed: { trackId: string; title: string }[]; extra: ListWork[]; works: number };

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/\s*[([](feat|ft|featuring)\.?[^)\]]*[)\]]/g, "").replace(/\b(feat|ft|featuring)\.?\s.*$/, "").replace(/[^a-z0-9]/g, "");
/** Agencies often list writers "LAST FIRST" or "LAST, FIRST": compare the name's words in any order. */
const nameKey = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
const digits = (s: string) => s.replace(/\D/g, "").replace(/^0+/, "");
const code = (s: string) => s.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

/** Minimal CSV/TSV reader (quoted fields, doubled quotes, newlines inside quotes). */
export function parseDelimited(text: string): string[][] {
  const sep = (text.split("\n", 1)[0] ?? "").includes("\t") ? "\t" : (text.split("\n", 1)[0] ?? "").split(";").length > (text.split("\n", 1)[0] ?? "").split(",").length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
}

/** Reads an uploaded .csv, .tsv, .txt or .xlsx into rows of text. */
export async function readTable(file: File): Promise<string[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets.find((w) => w.rowCount > 1) ?? wb.worksheets[0];
    const rows: string[][] = [];
    ws?.eachRow((r) => rows.push((r.values as unknown[]).slice(1).map((v) => cellText(v))));
    return rows.filter((r) => r.some(Boolean));
  }
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const items: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      for (const it of content.items) { const t = "str" in it ? it.str.trim() : ""; if (t) items.push(t); }
    }
    const rows = bmiPdfRows(items);
    if (rows.length < 2) throw new Error("We couldn't read songs from this PDF. Upload BMI's Catalog Detail PDF, or a CSV/Excel export.");
    return rows;
  }
  if (/\.xls$/i.test(file.name)) throw new Error("Save the file as .xlsx or .csv first (older .xls files can't be read).");
  return parseDelimited(await file.text());
}
/**
 * BMI's "Catalog Detail" PDF: each work is "Title, Registered date, [ISWC], BMI Work #, Participant Name …", then
 * participant lines "NAME, W|P, share%, affiliation, [CAE/IPI]". Turned into the same one-row-per-writer table a CSV gives.
 */
export function bmiPdfRows(items: string[]): string[][] {
  const rows: string[][] = [["Title", "ISWC", "BMI Work #", "Writer", "Party Type", "Share", "IPI"]];
  for (let i = 0; i < items.length; i++) {
    if (items[i] !== "Participant Name") continue;
    const workId = items[i - 1] ?? "";
    if (!/^\d{5,12}$/.test(workId)) continue;
    const hasIswc = /^T\d/.test(items[i - 2] ?? "");
    const title = items[i - (hasIswc ? 4 : 3)] ?? "";
    const iswc = hasIswc ? items[i - 2]! : "";
    if (!title) continue;
    let any = false;
    for (let j = i + 1; j < items.length && items[j] !== "Participant Name"; j++) {
      const share = items[j + 1] ?? "";
      if (!/^(W|P)$/.test(items[j]!) || !/%$/.test(share)) continue;
      const ipi = /^\d{8,11}$/.test(items[j + 3] ?? "") ? items[j + 3]! : "";
      if (items[j] === "W") { rows.push([title, iswc, workId, items[j - 1] ?? "", "Writer", share, ipi]); any = true; }
    }
    if (!any) rows.push([title, iswc, workId, "", "", "", ""]);
  }
  return rows;
}

function cellText(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") { const o = v as { text?: string; result?: unknown; richText?: { text: string }[] }; return o.richText ? o.richText.map((x) => x.text).join("") : String(o.text ?? o.result ?? ""); }
  return String(v).trim();
}

type Columns = Partial<Record<"title" | "iswc" | "isrc" | "workId" | "writer" | "share" | "ipi" | "party" | "pro", number>>;
const HEADINGS: [keyof Columns, RegExp][] = [
  ["iswc", /iswc/i], ["isrc", /isrc/i], ["ipi", /(\b(ipi|cae)|ip\s*name\s*n(umber|o))/i],
  ["workId", /(title\s*(number|no|#|code|id)|work\s*(id|#|number|no)|song\s*(code|id|#|number)|mlc\s*song|work\s*code|registration\s*(id|#)|^bmi\s*#|^ascap\s*#)/i],
  ["share", /(share|%|percent|ownership|split)/i], ["pro", /(affil|afflia|^society$|^pro$)/i], ["party", /(indicator|party\s*type|participant\s*(type|role)|designation|capacity|role|^type$)/i],
  ["writer", /(writer|composer|author|songwriter|interested\s*part|party\s*name|participant|^name$)/i],
  ["title", /(title|work\s*name|song\s*name|track\s*name|^song$|^work$)/i],
];
function columns(header: string[]): Columns {
  const out: Columns = {};
  header.forEach((h, i) => {
    if (/alternate|alt\.|other\s*title|publisher/i.test(h) && !/writer/i.test(h)) return;
    const hit = HEADINGS.find(([k, re]) => out[k] === undefined && re.test(h));
    if (hit) out[hit[0]] = i;
  });
  return out;
}

/** Finds the heading row (the first with a title or ISRC column among the first 15) and groups rows into works. */
export function readWorks(rows: string[][]): ListWork[] {
  const at = rows.slice(0, 40).findIndex((r) => { const c = columns(r); return c.title !== undefined || c.isrc !== undefined; });
  if (at < 0) throw new Error("Couldn't find a title or ISRC column. Upload the list as your agency exported it.");
  const col = columns(rows[at]!);
  const get = (r: string[], k: keyof Columns) => (col[k] === undefined ? "" : (r[col[k]!] ?? "").trim());
  const works = new Map<string, ListWork>();
  let last: ListWork | undefined;
  for (const r of rows.slice(at + 1)) {
    const title = get(r, "title"), iswc = code(get(r, "iswc")), isrc = code(get(r, "isrc")), workId = get(r, "workId");
    // One row per writer: rows without a title continue the work above.
    const key = workId || iswc || (title ? norm(title) : "") || isrc;
    const work = key ? works.get(key) ?? { title, iswc, isrc, workId, writers: [] } : last;
    if (!work) continue;
    if (key && !works.has(key)) works.set(key, work);
    if (!work.iswc && iswc) work.iswc = iswc;
    if (!work.isrc && isrc) work.isrc = isrc;
    const party = get(r, "party");
    const name = get(r, "writer");
    if (name && !/publisher|^p$|^e$|^op$|^se$|^am$|^pa$/i.test(party)) {
      const share = Number(get(r, "share").replace(/[%\s]/g, "").replace(",", "."));
      work.writers.push({ name, share: Number.isFinite(share) && share > 0 ? share : undefined, ipi: digits(get(r, "ipi")) || undefined, pro: get(r, "pro").replace(/^na$/i, "") || undefined });
    }
    last = work;
  }
  return [...works.values()].filter((w) => w.title || w.isrc);
}

export const loose = (s: string) => norm(s.replace(/\(.*?\)|\[.*?\]/g, "").replace(/\b(feat|ft)\.?\b.*$/i, ""));

/** Shares on any scale (100, 200 or the writer half) compared as each writer's part of the total. */
const parts = (list: { key: string; share?: number | undefined }[]) => {
  const total = list.reduce((n, x) => n + (x.share ?? 0), 0);
  return total > 0 ? new Map(list.filter((x) => x.share).map((x) => [x.key, (x.share! / total) * 100])) : new Map<string, number>();
};

/**
 * Compares one agency's list with the songs that should be registered there. Matches by ISWC, then ISRC, then title.
 * `recordings` lists (SoundExchange) carry no writers, so only presence is compared.
 */
export function compareList(works: ListWork[], tracks: CatalogTrack[], recordings = false): ListResult {
  const used = new Set<ListWork>();
  const matched: ListMatch[] = [], differences: ListMatch[] = [], notListed: ListResult["notListed"] = [];
  for (const t of tracks) {
    const m = t.metadata;
    const work = (m.iswc && works.find((w) => w.iswc && w.iswc === code(m.iswc)))
      || (m.isrc && works.find((w) => w.isrc && w.isrc === code(m.isrc)))
      || works.find((w) => w.title && norm(w.title) === norm(t.title))
      || works.find((w) => w.title && loose(w.title) === loose(t.title));
    if (!work) { notListed.push({ trackId: t.id, title: t.title }); continue; }
    used.add(work);
    const issues: string[] = [];
    if (!recordings && work.writers.length) {
      const mine = [...m.writers, ...m.composers].filter((w) => creditName(w)).map((w) => ({ key: nameKey(creditName(w)), name: creditName(w), ipi: digits(w.ipi ?? ""), share: Number(w.percentage) || undefined }));
      const theirs = work.writers.map((w) => ({ ...w, key: nameKey(w.name) }));
      const same = (a: { key: string; ipi?: string | undefined }, b: { key: string; ipi?: string | undefined }) => a.key === b.key || (!!a.ipi && a.ipi === b.ipi);
      for (const w of mine) if (!theirs.some((x) => same(w, x))) issues.push(`${w.name} isn't on the agency's registration`);
      for (const x of theirs) if (!mine.some((w) => same(w, x))) issues.push(`The agency lists ${x.name}, who isn't in your catalog`);
      for (const w of mine) {
        const x = theirs.find((y) => same(w, y));
        if (x?.ipi && w.ipi && x.ipi !== w.ipi) issues.push(`${w.name}'s IPI is ${x.ipi} there, ${w.ipi} here`);
      }
      const a = parts(mine), b = parts(theirs);
      for (const w of mine) {
        const x = theirs.find((y) => same(w, y));
        const here = a.get(w.key), there = x && b.get(x.key);
        if (here !== undefined && there !== undefined && Math.abs(here - there) > 1) issues.push(`${w.name}'s share is ${Math.round(there)}% there, ${Math.round(here)}% here`);
      }
    }
    (issues.length ? differences : matched).push({ trackId: t.id, title: t.title, work, issues });
  }
  return { matched, differences, notListed, extra: works.filter((w) => !used.has(w)), works: works.length };
}

/** What's kept in a song's checklist state after an upload: the step key and its saved value. */
export const listKey = (societyId: string) => `list:${societyId}`;
export type SavedListNote = { at: string; issues: string[] } | { at: string; missing: true };
export type SavedListSummary = { at: string; file: string; works: number; matched: number; differences: number; notListed: number };
export const readNote = (v: string | undefined): SavedListNote | null => { try { return v ? (JSON.parse(v) as SavedListNote) : null; } catch { return null; } };
