import { saveBlob } from "@/lib/catalog";
import { argb, inkOn, labBrand, type LabBrandSource } from "@/lib/financial-lab-brand";
import { PLATFORMS } from "@/lib/royalty-calc";
import {
  packetBudgetTotals,
  packetPlatforms,
  packetRoyalty,
  packetScopeCuts,
  packetTax,
  packetTotals,
  type PacketSong,
  type PacketTally,
} from "@/lib/lab-packet";
import type { TaxYearTable } from "@/lib/tax-brackets";

/**
 * The Financial Lab packet as the two spreadsheet choices in its download menu, alongside the fillable PDF: a styled
 * `.xlsx` workbook with a worksheet for each section, and a plain `.csv` for Google Sheets that keeps the arithmetic in
 * formulas. Same facts, same order and the same brand band as the PDF (founder, 2026-11-25).
 *
 * The live cells are the ones a member would edit: a worksheet line's amount, a platform's tally, a budget line's
 * actual. The totals follow them, so a downloaded record never freezes the figures it is meant to prove.
 */
export type PacketSheetFlavor = "excel" | "sheets";

export type PacketSheetMeta = {
  label: string;
  year: number;
  tables?: TaxYearTable[];
  tally?: PacketTally;
  madeAt?: Date;
  brand?: LabBrandSource;
};

const MONEY = '"$"#,##0.00';
const RATE = '"$"#,##0.000000';
const today = (at: Date) =>
  at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const count = (n: number) => Math.round(n).toLocaleString("en-US");
const moneyNumber = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

/** One CSV cell: quoted only when it has to be, which keeps a formula's own commas inside one cell. */
function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function packetData(songs: PacketSong[], meta: PacketSheetMeta) {
  const madeAt = meta.madeAt ?? new Date();
  const tax = packetTax(songs, meta.year, meta.tables, madeAt);
  const totals = packetTotals(songs, tax, meta.tally);
  const saved = packetPlatforms(songs);
  const cuts = packetScopeCuts(songs);
  // The scope's blended distributor cut, derived from the same before/after shares the projection uses.
  const distPct =
    cuts.before > 0 ? Math.max(0, Math.min(100, 100 - (cuts.after / cuts.before) * 100)) : 0;
  const budget = packetBudgetTotals(songs);
  return { madeAt, tax, totals, saved, cuts, distPct, budget };
}

const rateOf = (saved: ReturnType<typeof packetPlatforms>, id: string) =>
  saved.find((row) => row.id === id)?.rate ||
  PLATFORMS.find((platform) => platform.id === id)?.rate ||
  0;

/* ----------------------------------------------------------------------------------------------------------------
 * The Google Sheets copy: one sheet, sections in the packet's order, and formulas where a member edits a figure.
 * --------------------------------------------------------------------------------------------------------------*/

export function packetSheetCsv(songs: PacketSong[], meta: PacketSheetMeta): string {
  const data = packetData(songs, meta);
  const radio = songs.reduce((sum, song) => sum + packetRoyalty(song).radio, 0);
  const brand = labBrand(meta.brand);
  const rows: (string | number)[][] = [];
  const push = (row: (string | number)[] = []) => {
    rows.push(row);
    return rows.length;
  };

  push([`${brand.name.toUpperCase()} — FINANCIAL LAB PACKET`]);
  push([brand.tagline]);
  push([`${meta.label}  ·  tax year ${meta.year}  ·  ${today(data.madeAt)}`]);
  push([
    `${count(songs.length)} ${songs.length === 1 ? "song" : "songs"}  ·  ${count(data.totals.releases)} ${data.totals.releases === 1 ? "release" : "releases"}`,
  ]);
  push();

  push(["TOTALS SUMMARY"]);
  push(["Your share before distributor", moneyNumber(data.totals.gross)]);
  push(["You keep after distributor", moneyNumber(data.totals.royalty)]);
  push(["Streams", data.totals.streams]);
  push(["Deductible expenses", moneyNumber(data.tax.total)]);
  push(["Income tax", moneyNumber(data.tax.income)]);
  push(["Self-employment tax", moneyNumber(data.tax.se)]);
  push(["Estimated tax savings", moneyNumber(data.tax.savings)]);
  push();

  push(["SONG BY SONG"]);
  push(["Song", "Release", "Streams", "Royalties", "Deductible"]);
  const songFirst = rows.length + 1;
  for (const song of songs) {
    const projection = projectionOf(song);
    push([
      song.title,
      song.release,
      projection.streams,
      moneyNumber(projection.net),
      moneyNumber(taxOf(song, data.tax)),
    ]);
  }
  const songLast = rows.length;
  push([
    "Total",
    "",
    `=SUM(C${songFirst}:C${songLast})`,
    `=SUM(D${songFirst}:D${songLast})`,
    `=SUM(E${songFirst}:E${songLast})`,
  ]);
  push();

  push(["TAX WORKSHEET"]);
  const rateRow = push([
    "Marginal rate (%)",
    data.tax.rate,
    "",
    "Self-employment rate (%)",
    data.tax.seRate,
  ]);
  push(["Cost category", "What it was", "Amount", "Paperwork kept"]);
  const taxFirst = rows.length + 1;
  for (const line of data.tax.lines)
    push([
      line.category || "Not chosen yet",
      line.label || "",
      Number(line.amount) || 0,
      line.kept ? "Yes" : "No",
    ]);
  if (!data.tax.lines.length)
    push(["No cost lines were saved for this scope in this tax year.", "", "", ""]);
  const taxLast = rows.length;
  const taxTotalRow = push(["Total deductible", "", `=SUM(C${taxFirst}:C${taxLast})`, ""]);
  const incomeRow = push(["Income tax", "", `=ROUND(C${taxTotalRow}*B${rateRow}/100,2)`, ""]);
  const seRow = push(["Self-employment tax", "", `=ROUND(C${taxTotalRow}*D${rateRow}/100,2)`, ""]);
  push(["Estimated tax savings", "", `=C${incomeRow}+C${seRow}`, ""]);
  push();

  push(["PRODUCTION BUDGET"]);
  push(["Song", "Project", "Target", "Planned", "Spent", "Remaining"]);
  for (const song of songs) {
    if (!song.budget) continue;
    const progress = progressOf(song);
    push([
      song.title,
      song.budget.project,
      Number(song.budget.target) || 0,
      progress.planned,
      progress.spent,
      (Number(song.budget.target) || 0) - progress.spent,
    ]);
  }
  push(["", "", "", "", "", ""]);
  push(["Budget spent in total", "", "", "", data.budget.spent, data.budget.remaining]);
  push();

  push(["PLATFORM STREAMS TALLY"]);
  push(["Platform", "Saved in the Lab", "Your tally"]);
  const tallyFirst = rows.length + 1;
  for (const platform of PLATFORMS) {
    const saved = data.saved.find((row) => row.id === platform.id)?.streams ?? 0;
    const typed = meta.tally?.[platform.id] ?? "";
    push([platform.name, saved || "", typed ? Number(typed) : ""]);
  }
  const tallyLast = rows.length;
  push([
    "Total streams",
    `=SUM(B${tallyFirst}:B${tallyLast})`,
    `=SUM(C${tallyFirst}:C${tallyLast})`,
  ]);
  push();

  push(["ROYALTY PROJECTION"]);
  push(["Your share before distributor (%)", data.cuts.before * 100]);
  const beforeRow = rows.length;
  push(["Distributor cut (%)", moneyNumber(data.distPct)]);
  const distRow = rows.length;
  push([
    "Platform",
    "Saved streams",
    "Streams",
    "Rate (USD)",
    "Platform pays (USD)",
    "Your share (USD)",
  ]);
  const projectionFirst = rows.length + 1;
  PLATFORMS.forEach((platform) => {
    const index = PLATFORMS.indexOf(platform);
    const saved = data.saved.find((row) => row.id === platform.id)?.streams ?? 0;
    const rate = rateOf(data.saved, platform.id);
    const row = rows.length + 1;
    push([
      platform.name,
      saved || "",
      `=IF(COUNT(C${tallyFirst + index})=0,B${row},C${tallyFirst + index})`,
      rate,
      `=C${row}*D${row}`,
      `=E${row}*$B$${beforeRow}/100`,
    ]);
  });
  let radioRow = 0;
  if (radio > 0) {
    radioRow = push(["Radio / SiriusXM / live", "", "", "", "", moneyNumber(radio)]);
  }
  const projectionLast = rows.length;
  push([
    "Your share total",
    `=SUM(B${projectionFirst}:B${projectionLast})`,
    `=SUM(C${projectionFirst}:C${projectionLast})`,
    "",
    `=SUM(E${projectionFirst}:E${projectionLast})`,
    `=SUM(F${projectionFirst}:F${projectionLast})`,
  ]);
  const shareTotalRow = rows.length;
  const cutBase = radioRow ? `(F${shareTotalRow}-F${radioRow})` : `F${shareTotalRow}`;
  push(["Distributor's cut", "", "", "", "", `=${cutBase}*$B$${distRow}/100`]);
  const cutRow = rows.length;
  push(["You keep after distributor", "", "", "", "", `=F${shareTotalRow}-F${cutRow}`]);
  push();
  push([
    "Platform pays = streams × rate, before your share. Your share = platform pays × your master/song cut; the distributor cut comes after.",
  ]);
  push();

  push([
    "Edit a tally, a rate, a tax amount or a budget actual and the formulas follow. Estimates only; platform rates vary and nothing here is tax advice.",
  ]);
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

const projectionOf = (song: PacketSong) => {
  // The saved per-song projection, read from the same model the packet uses (radio included, no double count).
  const projection = packetRoyalty(song);
  return { streams: projection.streams, net: projection.net };
};

const taxOf = (song: PacketSong, tax: ReturnType<typeof packetTax>) =>
  tax.included.includes(song.title)
    ? tax.lines
        .filter((line) => line.song === song.title)
        .reduce((sum, line) => sum + (Number(line.amount) || 0), 0)
    : 0;

const progressOf = (song: PacketSong) => {
  const progress = song.budget
    ? song.budget.rows.reduce(
        (acc, row) => {
          const budget = Number(row.budget) || 0;
          const actual = row.paid ? Number(row.actual) || budget : 0;
          return { planned: acc.planned + budget, spent: acc.spent + actual };
        },
        { planned: 0, spent: 0 },
      )
    : { planned: 0, spent: 0 };
  return progress;
};

/* ----------------------------------------------------------------------------------------------------------------
 * The Excel workbook: one worksheet per section, with the same live cells.
 * --------------------------------------------------------------------------------------------------------------*/

export async function packetWorkbook(songs: PacketSong[], meta: PacketSheetMeta) {
  const { default: ExcelJS } = await import("exceljs");
  const data = packetData(songs, meta);
  const brand = labBrand(meta.brand);
  const wb = new ExcelJS.Workbook();
  wb.creator = brand.name;
  wb.company = brand.name;
  wb.title = `${meta.label} financial lab packet`;
  wb.calcProperties.fullCalcOnLoad = true;

  const band = (
    ws: import("exceljs").Worksheet,
    title: string,
    subtitle: string,
    columns: string,
  ) => {
    ws.mergeCells(`A1:${columns}1`);
    const head = ws.getCell("A1");
    head.value = `${brand.name} — ${title}`;
    head.font = { bold: true, size: 18, color: { argb: inkOn(brand.accent) } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(brand.accent) } };
    head.alignment = { vertical: "middle" };
    ws.getRow(1).height = 30;
    ws.mergeCells(`A2:${columns}2`);
    const tag = ws.getCell("A2");
    tag.value = brand.tagline;
    tag.font = { size: 10, bold: true, color: { argb: argb(brand.accent) } };
    ws.mergeCells(`A3:${columns}3`);
    const sub = ws.getCell("A3");
    sub.value = subtitle;
    sub.font = { size: 11, color: { argb: "FF525252" } };
    ws.mergeCells(`A4:${columns}4`);
    const prepared = ws.getCell("A4");
    prepared.value = `Prepared ${today(data.madeAt)}`;
    prepared.font = { size: 9, color: { argb: "FF525252" } };
  };
  const tableHead = (ws: import("exceljs").Worksheet, row: number, labels: string[]) => {
    labels.forEach((label, i) => {
      const cell = ws.getRow(row).getCell(i + 1);
      cell.value = label;
      cell.font = { bold: true, size: 10, color: { argb: argb(brand.accent) } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEFF5" } };
      cell.border = { bottom: { style: "thin", color: { argb: "FFDEE2EA" } } };
    });
  };
  const widths = (ws: import("exceljs").Worksheet, values: number[]) =>
    values.forEach((width, i) => (ws.getColumn(i + 1).width = width));

  // ---- Summary
  const summary = wb.addWorksheet("Summary");
  widths(summary, [34, 22, 16, 16, 16]);
  band(summary, "Financial Lab Packet", `${meta.label}  ·  tax year ${meta.year}`, "E");
  const tiles: [string, number][] = [
    ["Your share before distributor", data.totals.gross],
    ["You keep after distributor", data.totals.royalty],
    ["Streams", data.totals.streams],
    ["Deductible expenses", data.tax.total],
    ["Estimated tax savings", data.tax.savings],
  ];
  tiles.forEach(([label, value], i) => {
    const row = 6 + i;
    summary.getCell(`A${row}`).value = label;
    summary.getCell(`A${row}`).font = { bold: true };
    const cell = summary.getCell(`B${row}`);
    cell.value = value;
    cell.numFmt = i === 2 ? "#,##0" : MONEY;
  });
  tableHead(summary, 13, ["Song", "Release", "Streams", "Royalties", "Deductible"]);
  let sRow = 14;
  for (const song of songs) {
    const projection = projectionOf(song);
    summary.getCell(`A${sRow}`).value = song.title;
    summary.getCell(`B${sRow}`).value = song.release;
    summary.getCell(`C${sRow}`).value = projection.streams || "";
    summary.getCell(`D${sRow}`).value = projection.net;
    summary.getCell(`D${sRow}`).numFmt = MONEY;
    summary.getCell(`E${sRow}`).value = taxOf(song, data.tax);
    summary.getCell(`E${sRow}`).numFmt = MONEY;
    sRow += 1;
  }
  summary.getCell(`A${sRow}`).value = "Total";
  summary.getCell(`A${sRow}`).font = { bold: true };
  summary.getCell(`C${sRow}`).value = { formula: `SUM(C14:C${sRow - 1})` };
  summary.getCell(`C${sRow}`).numFmt = "#,##0";
  summary.getCell(`D${sRow}`).value = { formula: `SUM(D14:D${sRow - 1})` };
  summary.getCell(`D${sRow}`).numFmt = MONEY;
  summary.getCell(`D${sRow}`).font = { bold: true };
  summary.getCell(`E${sRow}`).value = { formula: `SUM(E14:E${sRow - 1})` };
  summary.getCell(`E${sRow}`).numFmt = MONEY;

  // ---- Tax worksheet
  const taxSheet = wb.addWorksheet("Tax worksheet");
  widths(taxSheet, [34, 30, 16, 22, 14]);
  band(taxSheet, "Artist Tax Write-Off", `${meta.label}  ·  tax year ${meta.year}`, "E");
  taxSheet.getCell("A6").value = "Marginal rate (%)";
  taxSheet.getCell("A6").font = { bold: true };
  taxSheet.getCell("B6").value = data.tax.rate;
  taxSheet.getCell("B6").numFmt = "0.00";
  taxSheet.getCell("D6").value = "Self-employment rate (%)";
  taxSheet.getCell("D6").font = { bold: true };
  taxSheet.getCell("E6").value = data.tax.seRate;
  taxSheet.getCell("E6").numFmt = "0.00";
  tableHead(taxSheet, 8, ["Cost category", "What it was", "Amount", "Paperwork kept"]);
  const taxFirst = 9;
  let tRow = taxFirst;
  data.tax.lines.forEach((line) => {
    taxSheet.getCell(`A${tRow}`).value = line.category || "Not chosen yet";
    taxSheet.getCell(`B${tRow}`).value = line.label || "";
    taxSheet.getCell(`C${tRow}`).value = Number(line.amount) || 0;
    taxSheet.getCell(`C${tRow}`).numFmt = MONEY;
    taxSheet.getCell(`D${tRow}`).value = line.kept ? "Yes" : "No";
    tRow += 1;
  });
  if (!data.tax.lines.length) tRow = taxFirst + 1;
  const taxLast = tRow - 1;
  const totalRow = tRow;
  taxSheet.getCell(`A${totalRow}`).value = "Total deductible";
  taxSheet.getCell(`A${totalRow}`).font = { bold: true };
  taxSheet.getCell(`C${totalRow}`).value = { formula: `SUM(C${taxFirst}:C${taxLast})` };
  taxSheet.getCell(`C${totalRow}`).numFmt = MONEY;
  taxSheet.getCell(`A${totalRow + 1}`).value = "Income tax";
  taxSheet.getCell(`C${totalRow + 1}`).value = { formula: `ROUND(C${totalRow}*B6/100,2)` };
  taxSheet.getCell(`C${totalRow + 1}`).numFmt = MONEY;
  taxSheet.getCell(`A${totalRow + 2}`).value = "Self-employment tax";
  taxSheet.getCell(`C${totalRow + 2}`).value = { formula: `ROUND(C${totalRow}*E6/100,2)` };
  taxSheet.getCell(`C${totalRow + 2}`).numFmt = MONEY;
  taxSheet.getCell(`A${totalRow + 3}`).value = "Estimated tax savings";
  taxSheet.getCell(`A${totalRow + 3}`).font = { bold: true };
  taxSheet.getCell(`C${totalRow + 3}`).value = { formula: `C${totalRow + 1}+C${totalRow + 2}` };
  taxSheet.getCell(`C${totalRow + 3}`).numFmt = MONEY;
  taxSheet.getCell(`C${totalRow + 3}`).font = { bold: true };
  taxSheet.getCell(`A${totalRow + 5}`).value =
    "Estimate only. Whether a cost qualifies, how much of it, and the rate that applies are your tax professional's call.";
  taxSheet.getCell(`A${totalRow + 5}`).font = {
    size: 9,
    italic: true,
    color: { argb: "FF525252" },
  };

  // ---- Production budget
  const budgetSheet = wb.addWorksheet("Production budget");
  widths(budgetSheet, [34, 24, 16, 16, 12]);
  band(budgetSheet, "Production Budget", `${meta.label}  ·  tax year ${meta.year}`, "E");
  tableHead(budgetSheet, 6, ["Song / item", "Category", "Budgeted", "Actual", "Paid"]);
  let bRow = 7;
  for (const song of songs) {
    if (!song.budget) continue;
    budgetSheet.getCell(`A${bRow}`).value = `${song.title} — ${song.budget.project}`;
    budgetSheet.getCell(`A${bRow}`).font = { bold: true, color: { argb: argb(brand.accent) } };
    bRow += 1;
    for (const row of song.budget.rows) {
      budgetSheet.getCell(`A${bRow}`).value = row.item || row.category;
      budgetSheet.getCell(`B${bRow}`).value = row.category;
      budgetSheet.getCell(`C${bRow}`).value = Number(row.budget) || 0;
      budgetSheet.getCell(`C${bRow}`).numFmt = MONEY;
      budgetSheet.getCell(`D${bRow}`).value = row.actual ? Number(row.actual) || 0 : "";
      budgetSheet.getCell(`D${bRow}`).numFmt = MONEY;
      budgetSheet.getCell(`E${bRow}`).value = row.paid ? "Yes" : "";
      bRow += 1;
    }
    const planned = progressOf(song).planned;
    const spent = progressOf(song).spent;
    budgetSheet.getCell(`A${bRow}`).value = "Target / planned / spent";
    budgetSheet.getCell(`A${bRow}`).font = { bold: true };
    budgetSheet.getCell(`B${bRow}`).value = Number(song.budget.target) || 0;
    budgetSheet.getCell(`B${bRow}`).numFmt = MONEY;
    budgetSheet.getCell(`C${bRow}`).value = planned;
    budgetSheet.getCell(`C${bRow}`).numFmt = MONEY;
    budgetSheet.getCell(`D${bRow}`).value = spent;
    budgetSheet.getCell(`D${bRow}`).numFmt = MONEY;
    bRow += 2;
  }
  if (bRow === 7)
    budgetSheet.getCell("A7").value = "No production plan has been started for this scope yet.";

  // ---- Tally
  const tallySheet = wb.addWorksheet("Tally");
  widths(tallySheet, [30, 18, 18]);
  band(tallySheet, "Platform Streams Tally", `${meta.label}  ·  tax year ${meta.year}`, "C");
  tableHead(tallySheet, 8, ["Platform", "Saved in the Lab", "Your tally"]);
  const tallyFirst = 9;
  PLATFORMS.forEach((platform, i) => {
    const row = tallyFirst + i;
    const saved = data.saved.find((item) => item.id === platform.id)?.streams ?? 0;
    tallySheet.getCell(`A${row}`).value = platform.name;
    tallySheet.getCell(`B${row}`).value = saved || "";
    tallySheet.getCell(`B${row}`).numFmt = "#,##0";
    const typed = meta.tally?.[platform.id];
    if (typed) {
      tallySheet.getCell(`C${row}`).value = Number(typed) || 0;
      tallySheet.getCell(`C${row}`).numFmt = "#,##0";
    }
  });
  const tallyLast = tallyFirst + PLATFORMS.length - 1;
  const tallyTotalRow = tallyLast + 1;
  tallySheet.getCell(`A${tallyTotalRow}`).value = "Total streams";
  tallySheet.getCell(`A${tallyTotalRow}`).font = { bold: true };
  tallySheet.getCell(`B${tallyTotalRow}`).value = {
    formula: `SUM(B${tallyFirst}:B${tallyLast})`,
  };
  tallySheet.getCell(`B${tallyTotalRow}`).numFmt = "#,##0";
  tallySheet.getCell(`C${tallyTotalRow}`).value = {
    formula: `SUM(C${tallyFirst}:C${tallyLast})`,
  };
  tallySheet.getCell(`C${tallyTotalRow}`).numFmt = "#,##0";

  // ---- Projection
  const projection = wb.addWorksheet("Projection", { views: [{ state: "frozen", ySplit: 8 }] });
  widths(projection, [30, 15, 15, 14, 16, 18]);
  band(projection, "Royalty Projection", `${meta.label}  ·  tax year ${meta.year}`, "F");
  projection.getCell("A6").value = "Your share before distributor (%)";
  projection.getCell("A6").font = { bold: true };
  projection.getCell("B6").value = data.cuts.before * 100;
  projection.getCell("B6").numFmt = "0.00";
  projection.getCell("A7").value = "Distributor cut (%)";
  projection.getCell("A7").font = { bold: true };
  projection.getCell("B7").value = data.distPct;
  projection.getCell("B7").numFmt = "0.00";
  projection.getCell("A8").value =
    "Edit a tally on the Tally sheet; platform pays and your share here follow.";
  projection.getCell("A8").font = { size: 9, italic: true, color: { argb: "FF525252" } };
  tableHead(projection, 9, [
    "Platform",
    "Saved streams",
    "Streams",
    "Rate (USD)",
    "Platform pays (USD)",
    "Your share (USD)",
  ]);
  PLATFORMS.forEach((platform, i) => {
    const row = 10 + i;
    const saved = data.saved.find((item) => item.id === platform.id)?.streams ?? 0;
    const rate = rateOf(data.saved, platform.id);
    projection.getCell(`A${row}`).value = platform.name;
    projection.getCell(`B${row}`).value = saved || "";
    projection.getCell(`B${row}`).numFmt = "#,##0";
    projection.getCell(`C${row}`).value = {
      formula: `IF(COUNT(Tally!C${tallyFirst + i})=0,B${row},Tally!C${tallyFirst + i})`,
    };
    projection.getCell(`C${row}`).numFmt = "#,##0";
    projection.getCell(`D${row}`).value = rate;
    projection.getCell(`D${row}`).numFmt = RATE;
    projection.getCell(`E${row}`).value = { formula: `C${row}*D${row}` };
    projection.getCell(`E${row}`).numFmt = MONEY;
    projection.getCell(`F${row}`).value = { formula: `E${row}*$B$6/100` };
    projection.getCell(`F${row}`).numFmt = MONEY;
  });
  const projectionLast = 10 + PLATFORMS.length - 1;
  const radio = songs.reduce((sum, song) => sum + packetRoyalty(song).radio, 0);
  const radioRow = radio > 0 ? projectionLast + 1 : 0;
  if (radioRow) {
    projection.getCell(`A${radioRow}`).value = "Radio / SiriusXM / live";
    projection.getCell(`F${radioRow}`).value = radio;
    projection.getCell(`F${radioRow}`).numFmt = MONEY;
  }
  const projectionTotal = projectionLast + (radioRow ? 2 : 1);
  const projectionLastValue = radioRow || projectionLast;
  projection.getCell(`A${projectionTotal}`).value = "Your share total";
  projection.getCell(`A${projectionTotal}`).font = { bold: true };
  projection.getCell(`C${projectionTotal}`).value = {
    formula: `SUM(C10:C${projectionLastValue})`,
  };
  projection.getCell(`C${projectionTotal}`).numFmt = "#,##0";
  projection.getCell(`E${projectionTotal}`).value = {
    formula: `SUM(E10:E${projectionLastValue})`,
  };
  projection.getCell(`E${projectionTotal}`).numFmt = MONEY;
  projection.getCell(`F${projectionTotal}`).value = {
    formula: `SUM(F10:F${projectionLastValue})`,
  };
  projection.getCell(`F${projectionTotal}`).numFmt = MONEY;
  projection.getCell(`F${projectionTotal}`).font = {
    bold: true,
    color: { argb: argb(brand.accent) },
  };
  const cutRow = projectionTotal + 1;
  projection.getCell(`A${cutRow}`).value = "Distributor's cut";
  const cutBase = radioRow ? `(F${projectionTotal}-F${radioRow})` : `F${projectionTotal}`;
  projection.getCell(`F${cutRow}`).value = { formula: `${cutBase}*$B$7/100` };
  projection.getCell(`F${cutRow}`).numFmt = MONEY;
  const keepRow = cutRow + 1;
  projection.getCell(`A${keepRow}`).value = "You keep after distributor";
  projection.getCell(`A${keepRow}`).font = { bold: true };
  projection.getCell(`F${keepRow}`).value = { formula: `F${projectionTotal}-F${cutRow}` };
  projection.getCell(`F${keepRow}`).numFmt = MONEY;
  projection.getCell(`F${keepRow}`).font = { bold: true, color: { argb: argb(brand.accent) } };
  projection.getCell(`A${keepRow + 2}`).value =
    "Platform pays = streams × rate, before your share. Your share = platform pays × your master/song cut; the distributor cut comes after.";
  projection.getCell(`A${keepRow + 2}`).font = {
    size: 9,
    italic: true,
    color: { argb: "FF525252" },
  };
  return wb;
}

export async function downloadPacketXlsx(songs: PacketSong[], meta: PacketSheetMeta) {
  const wb = await packetWorkbook(songs, meta);
  const buffer = await wb.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${meta.label} financial lab packet.xlsx`,
  );
}

/** The Google Sheets choice: a plain `.csv` the packet's sections import into one sheet. */
export function downloadPacketSheetCsv(songs: PacketSong[], meta: PacketSheetMeta) {
  saveBlob(
    new Blob([packetSheetCsv(songs, meta)], { type: "text/csv;charset=utf-8" }),
    `${meta.label} financial lab packet.csv`,
  );
}
