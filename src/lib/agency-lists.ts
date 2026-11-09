import type { CatalogTrack } from "@/lib/catalog";
import { creditName, type Contributor, type Metadata } from "@/lib/metadata";

/**
 * "Confirm with your agency lists" (PLAN-royalty-health-report §3A): the user downloads their own list of registered
 * works or recordings from an agency account and uploads it. The file is read in the browser and never stored; only
 * the comparison is saved. Every agency formats its export differently, so columns are found by their headings.
 */
export type ListWriter = { name: string; share?: number | undefined; ipi?: string | undefined; pro?: string | undefined };
export type ListWork = { title: string; iswc: string; isrc: string; workId: string; writers: ListWriter[]; /** BMI prints the publisher half as its own P rows; kept so a published work is not read as writers only. */ publishers?: ListWriter[] };
export type ListMatch = { trackId: string; title: string; work?: ListWork; issues: string[] };
/** A work the list has under the song's title, with no writer in common: not the song, and not simply missing either. */
export type ListClash = { trackId: string; title: string; work: ListWork; issues: string[] };
export type ListResult = { matched: ListMatch[]; differences: ListMatch[]; clashes: ListClash[]; notListed: { trackId: string; title: string }[]; extra: ListWork[]; works: number };

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/\s*[([](feat|ft|featuring)\.?[^)\]]*[)\]]/g, "").replace(/\b(feat|ft|featuring)\.?\s.*$/, "").replace(/[^a-z0-9]/g, "");
/**
 * Titles an agency prints as part of a party name — "STEPHENS CALVIN ANDRE JR (MR)". They are noise when comparing two
 * spellings of one writer, and never shown or written into a catalog. A generation ("Jr") stays, because it is sometimes
 * the only thing telling a father and son apart.
 */
const NAME_NOISE = new Set(["mr", "mrs", "ms", "miss", "dr", "esq", "phd", "md"]);
/** Agencies often list writers "LAST FIRST" or "LAST, FIRST": compare the name's words in any order. */
const nameKey = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean).filter((w) => !NAME_NOISE.has(w)).sort().join(" ");
/**
 * The same *person*, whatever the spelling (founder, 2026-11-09): BMI prints "STEPHENS CALVIN ANDRE JR (MR)" where the
 * catalog holds "Calvin Stephens", so one key's words containing the other's means one writer, never a stranger. Only a
 * name long enough to be a person may match that way, so a single word never swallows a full name.
 */
export function sameWriter(a: string, b: string): boolean {
  const x = nameKey(a), y = nameKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const xs = x.split(" "), ys = y.split(" ");
  if (Math.min(xs.length, ys.length) < 2) return false;
  const [small, large] = xs.length <= ys.length ? [xs, ys] : [ys, xs];
  return small.every((w) => large.includes(w));
}
/**
 * Whether the two spellings carry different name parts, which the member should fix (founder, 2026-11-09): the catalog
 * holds "Calvin Stephens", BMI registers "Calvin Andre Stephens Jr." — the same writer, and a catalog worth correcting so
 * the two records read alike. Word order and titles are not a difference; a missing middle name or suffix is.
 */
export function spelledDifferently(a: string, b: string): boolean {
  const x = nameKey(a).split(" ").filter(Boolean), y = nameKey(b).split(" ").filter(Boolean);
  return x.length !== y.length || x.some((w) => !y.includes(w));
}
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
      // Both halves are kept: a W row is a writer, a P row is a publisher, and dropping P lost the publisher half entirely.
      rows.push([title, iswc, workId, items[j - 1] ?? "", items[j] === "W" ? "Writer" : "Publisher", share, ipi]);
      if (items[j] === "W") any = true;
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
    const isPublisherRow = /publisher|^p$/i.test(party);
    if (name && (isPublisherRow || !/^e$|^op$|^se$|^am$|^pa$/i.test(party))) {
      const share = Number(get(r, "share").replace(/[%\s]/g, "").replace(",", "."));
      const row = { name, share: Number.isFinite(share) && share > 0 ? share : undefined, ipi: digits(get(r, "ipi")) || undefined, pro: get(r, "pro").replace(/^na$/i, "") || undefined };
      // The publisher half belongs to the publisher, never to the writers: keeping it apart is what stops a P row
      // being compared as a co-writer.
      if (isPublisherRow) (work.publishers ??= []).push(row);
      else work.writers.push(row);
    }
    last = work;
  }
  return [...works.values()].filter((w) => w.title || w.isrc);
}

export const loose = (s: string) => norm(s.replace(/\(.*?\)|\[.*?\]/g, "").replace(/\b(feat|ft)\.?\b.*$/i, ""));

/** Every work on the list with this title, exactly first, then loosely (a remix or a feature in brackets still counts). */
export function titledWorks(works: ListWork[], title: string): ListWork[] {
  const exact = works.filter((w) => w.title && norm(w.title) === norm(title));
  return exact.length ? exact : works.filter((w) => w.title && loose(w.title) === loose(title));
}

/**
 * A title clash, in the member's own words (founder, 2026-11-09): the list has this title but not one writer matches, so
 * calling the song "not on the list" was true and useless. The diagnosis says what the two records disagree about, and the
 * treatment says what each possible cause needs — the member's to fix when it is their song, the agency's when it isn't.
 */
export function clashIssues(work: ListWork, metadata: Metadata, agency = "the agency"): string[] {
  const named = work.writers.map((w) => w.name).filter(Boolean);
  const who = named.length ? named.slice(0, 3).join(", ") + (named.length > 3 ? ` and ${named.length - 3} more` : "") : "nobody";
  const mine = [...(metadata.writers ?? []), ...(metadata.composers ?? [])].map((w) => creditName(w)).filter(Boolean);
  const issues = [`${agency} has a work called "${work.title}", but none of its writers are on your song — it lists ${who}${mine.length ? `, and your catalog has ${mine.slice(0, 3).join(", ")}` : ""}.`];
  issues.push(`If it's your work: put ${named[0] ?? "that writer"} on the song's writers in My Catalog, or correct the legal name there if it's only a spelling, then upload the list again.`);
  issues.push(`If it's another writer's song: your catalog needs nothing here — the work at ${agency} is theirs to settle.`);
  return issues;
}

/**
 * The work on an agency list that is this song: the ISRC first, because that is the code the agencies match recordings
 * by, then the ISWC, which names the composition exactly, and the title last, because two recordings can share a name.
 * One rule for the comparison and for filling a catalog from a list, so the two can't disagree.
 */
export function matchWork(
  works: ListWork[],
  t: { title: string; metadata: { iswc?: string | undefined; isrc?: string | undefined; writers?: Contributor[] | undefined; composers?: Contributor[] | undefined } },
): ListWork | undefined {
  const iswc = t.metadata.iswc ?? "", isrc = t.metadata.isrc ?? "";
  const byIsrc = isrc ? works.find((w) => w.isrc && w.isrc === code(isrc)) : undefined;
  if (byIsrc) return byIsrc;
  const byIswc = iswc ? works.find((w) => w.iswc && w.iswc === code(iswc)) : undefined;
  if (byIswc) return byIswc;
  // A shared title is real (a re-record, a live version, two artists' songs): the writers say which work it is.
  const titled = titledWorks(works, t.title);
  if (titled.length <= 1) return titled[0];
  const mine = new Set([...(t.metadata.writers ?? []), ...(t.metadata.composers ?? [])].map((w) => nameKey(creditName(w))).filter(Boolean));
  let best = titled[0], bestHits = 0;
  for (const w of titled) {
    const hits = w.writers.filter((x) => mine.has(nameKey(x.name))).length;
    if (hits > bestHits) { best = w; bestHits = hits; }
  }
  // Two works share this title and not one writer is in common: that is a different song, not this one. Saying "not on
  // the list" is honest; matching the first same-titled work put someone else's registration on the member's song.
  return bestHits > 0 ? best : undefined;
}

/**
 * What the agency's own record leaves out: the codes and writer details its portals match a work by. Read from the
 * uploaded file itself, so a member with nothing catalogued yet still gets a real check out of their list.
 */
export function listGaps(w: ListWork, recording = false, society = ""): string[] {
  // SoundExchange registers the recording, not the composition: only the ISRC is what it matches by.
  if (recording) return w.isrc ? [] : ["No ISRC — SoundExchange matches a recording by it"];
  const gaps: string[] = [];
  // A PRO registers the composition, not the recording (founder, 2026-11-05), so a BMI, ASCAP, SESAC or GMR list is never
  // missing an ISRC and must not say it is. Only The MLC and SoundExchange match a recording by one.
  const proOnly = ["bmi", "ascap", "sesac", "gmr"].includes(society);
  if (!w.isrc && !proOnly) gaps.push("No ISRC — The MLC and SoundExchange match a recording by it");
  if (!w.iswc) gaps.push("No ISWC — your PRO registers the composition by it");
  if (!w.writers.length) gaps.push("No writers on the list");
  else {
    if (w.writers.some((x) => !x.ipi)) gaps.push("A writer with no IPI number");
    if (w.publishers?.some((x) => !x.ipi)) gaps.push("A publisher with no IPI number");
    // Lists use the whole song or the writer half, so 100 and 200 both add up; anything else is a split to settle.
    const total = w.writers.reduce((n, x) => n + (x.share ?? 0), 0);
    if (total > 0 && Math.abs(total - 100) > 1 && Math.abs(total - 200) > 1) gaps.push("The shares don't add up to 100%");
  }
  return gaps;
}

/**
 * A list's shares on the composition's own 100% scale (founder, 2026-11-09). BMI prints the writer's half and the
 * publisher's half together, so a fully published work totals 200% there and 100% here — both correct. Every scale is
 * brought back to 100, so the comparison, the dialog and the fill read the same numbers. Rounding is carried by the last
 * writer with a share, so three 33.33% rows still total 100.
 */
export function scaledShares(writers: ListWriter[]): number[] {
  const total = writers.reduce((n, w) => n + (w.share ?? 0), 0);
  const out = writers.map((w) => (w.share === undefined || total <= 0 ? 0 : Math.round((w.share / total) * 10000) / 100));
  const sum = out.reduce((n, x) => n + x, 0);
  const last = out.map((v, i) => [v, i] as const).filter(([v]) => v > 0).pop();
  if (last && Math.abs(sum - 100) >= 0.01) out[last[1]] = Math.round((out[last[1]]! + (100 - sum)) * 100) / 100;
  return out;
}
/** The total the list itself prints, to explain a 200% column without calling it wrong. */
export const listShareTotal = (work: ListWork) => work.writers.reduce((n, x) => n + (x.share ?? 0), 0);
/** True when the list counts the writer's half and the publisher's half together (BMI's 200%). */
export const combinedHalves = (work: ListWork) => listShareTotal(work) > 100.5;

/** Shares on any scale (100, 200 or the writer half) compared as each writer's part of the total. */
const parts = (list: { key: string; share?: number | undefined }[]) => {
  const total = list.reduce((n, x) => n + (x.share ?? 0), 0);
  return total > 0 ? new Map(list.filter((x) => x.share).map((x) => [x.key, (x.share! / total) * 100])) : new Map<string, number>();
};

/**
 * What the agency's registration and the catalog disagree about, in the member's own words. The same rule runs in the
 * comparison and in the fill dialog, so a difference the report names is the difference the member is asked to settle.
 * `recordings` lists (SoundExchange) carry no writers, so only the codes are compared.
 */
export function workIssues(work: ListWork, metadata: Metadata, recordings = false): string[] {
  const issues: string[] = [];
  const isrc = code(metadata.isrc ?? ""), iswc = code(metadata.iswc ?? "");
  if (work.isrc && work.isrc !== isrc) issues.push(isrc ? `The agency has ISRC ${work.isrc}, your catalog has ${metadata.isrc.trim()}` : `The agency has ISRC ${work.isrc}, your catalog has none`);
  if (work.iswc && work.iswc !== iswc) issues.push(iswc ? `The agency has ISWC ${work.iswc}, your catalog has ${metadata.iswc.trim()}` : `The agency has ISWC ${work.iswc}, your catalog has none`);
  if (recordings || !work.writers.length) return issues;
  const mine = [...metadata.writers, ...metadata.composers].filter((w) => creditName(w)).map((w) => ({ key: nameKey(creditName(w)), name: creditName(w), ipi: digits(w.ipi ?? ""), share: Number(w.percentage) || undefined }));
  const theirs = work.writers.map((w) => ({ ...w, key: nameKey(w.name) }));
  const same = (a: { key: string; name?: string; ipi?: string | undefined }, b: { key: string; name?: string; ipi?: string | undefined }) =>
    a.key === b.key || (!!a.ipi && a.ipi === b.ipi) || (!!a.name && !!b.name && sameWriter(a.name, b.name));
  for (const w of mine) if (!theirs.some((x) => same(w, x))) issues.push(`${w.name} isn't on the agency's registration`);
  for (const x of theirs) if (!mine.some((w) => same(w, x))) issues.push(`The agency lists ${x.name}, who isn't in your catalog`);
  for (const w of mine) {
    const x = theirs.find((y) => same(w, y));
    if (x && spelledDifferently(w.name, x.name)) issues.push(`The agency has ${x.name} where your catalog has ${w.name} — same writer, fix the spelling so both records match`);
    if (x?.ipi && w.ipi && x.ipi !== w.ipi) issues.push(`${w.name}'s IPI is ${x.ipi} there, ${w.ipi} here`);
  }
  const a = parts(mine), b = parts(theirs);
  for (const w of mine) {
    const x = theirs.find((y) => same(w, y));
    const here = a.get(w.key), there = x && b.get(x.key);
    if (here !== undefined && there !== undefined && Math.abs(here - there) > 1) issues.push(`${w.name}'s share is ${Math.round(there)}% there, ${Math.round(here)}% here`);
  }
  return issues;
}

/**
 * Compares one agency's list with the songs that should be registered there. Matches by ISRC, then ISWC, then title
 * (the writers break a shared title).
 * `recordings` lists (SoundExchange) carry no writers, so only presence is compared.
 */
export function compareList(works: ListWork[], tracks: CatalogTrack[], recordings = false, agency = "the agency"): ListResult {
  const used = new Set<ListWork>();
  const matched: ListMatch[] = [], differences: ListMatch[] = [], clashes: ListClash[] = [], notListed: ListResult["notListed"] = [];
  for (const t of tracks) {
    const m = t.metadata;
    const work = matchWork(works, t);
    if (!work) {
      // The list does have this title, but not one writer agrees: a clash to diagnose, never a silent "not on the list" —
      // and never a match, which would pin another writer's registration to this song.
      const titled = titledWorks(works, t.title);
      if (titled.length) {
        for (const w of titled) used.add(w);
        clashes.push({ trackId: t.id, title: t.title, work: titled[0]!, issues: clashIssues(titled[0]!, m, agency) });
        continue;
      }
      notListed.push({ trackId: t.id, title: t.title });
      continue;
    }
    used.add(work);
    const issues = workIssues(work, m, recordings);
    (issues.length ? differences : matched).push({ trackId: t.id, title: t.title, work, issues });
  }
  return { matched, differences, clashes, notListed, extra: works.filter((w) => !used.has(w)), works: works.length };
}

/**
 * How to find and download your own catalog at each agency, shown under its card. Agencies move their menus, so these
 * name the area ("Works Catalog", "Catalog Export Tool") rather than pretending to know every click of today's site.
 * The MLC's Catalog Export Tool is also the honest way round its search API being unavailable.
 */
export const LIST_DOWNLOAD_STEPS: Record<string, string[]> = {
  bmi: [
    "Sign in to BMI Online Services (bmi.com/login) and open Works Catalog.",
    "Open the catalog view for all your works, not a single work, and use its print or export option.",
    "Save it as a PDF or as a CSV/Excel file. BMI's Catalog Detail PDF is read directly here.",
  ],
  ascap: [
    "Sign in to ASCAP Member Access and open Works → My Catalog.",
    "Open your works list and print it to PDF, or copy its title, writer, IPI and share columns into a spreadsheet.",
    "Upload that file here. One row per writer is what we match against.",
  ],
  sesac: [
    "Sign in to your SESAC member account and open your registered works.",
    "Print the list to PDF, or copy its title, writer and share columns into a spreadsheet.",
    "Upload that file here.",
  ],
  gmr: [
    "Sign in to your GMR member account and open your registered works.",
    "Print the list to PDF, or copy its title, writer and share columns into a spreadsheet.",
    "Upload that file here.",
  ],
  mlc: [
    "Sign in to The MLC Portal (portal.themlc.com) and open the Member Hub or the Songwriter Hub.",
    "Open the Catalog Export Tool, choose all your works and download the Excel-compatible file (.xlsx).",
    "Upload that file here. Reading it here never sends anything to The MLC.",
  ],
  soundexchange: [
    "Sign in to SoundExchange Direct (sxdirect.soundexchange.com).",
    "Open My Catalog → Submit Recordings → Upload History and download the .csv of everything you've submitted.",
    "Upload that file here. Recordings are matched by ISRC.",
  ],
};

/** Directions for a society we have no named path for: the same honest route, without inventing a menu. */
export const downloadSteps = (societyId: string): string[] => LIST_DOWNLOAD_STEPS[societyId] ?? [
  "Sign in to your account at this society and open your registered works or recordings.",
  "Download or print that list as a PDF or a spreadsheet.",
  "Upload that file here.",
];

/** What's kept in a song's checklist state after an upload: the step key and its saved value. */
export const listKey = (societyId: string) => `list:${societyId}`;
export type SavedListNote = { at: string; issues: string[] } | { at: string; missing: true };
export type SavedListSummary = { at: string; file: string; works: number; matched: number; differences: number; notListed: number };
export const readNote = (v: string | undefined): SavedListNote | null => { try { return v ? (JSON.parse(v) as SavedListNote) : null; } catch { return null; } };
