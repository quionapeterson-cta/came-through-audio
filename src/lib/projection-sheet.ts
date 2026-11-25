import type { CopyContext, TaxSnapshot } from "@/lib/financial-lab-copy";
import { saveBlob } from "@/lib/catalog";
import { argb, inkOn, labBrand, type LabBrandSource } from "@/lib/financial-lab-brand";
import { MASTER_PORTION } from "@/lib/royalty-calc";

/**
 * The royalty projection as the two spreadsheet choices in its download menu, carrying the same shapes the budget
 * sheet offers (founder, 2026-11-25): a plain `.csv` Google Sheets imports with live formulas, and a styled `.xlsx`
 * workbook that recalculates as the member types a stream count or a rate.
 *
 * The figures are read from the snapshot the Earnings panel already produced, never recomputed here, and the one
 * arithmetic the sheet adds is the pool and the member's cut — the same two steps the panel shows. The CSV and the
 * workbook spell that arithmetic the same way, so the two can never disagree.
 */
export type ProjectionSheetFlavor = "excel" | "sheets";

const MONEY = '"$"#,##0.00';
const RATE = '"$"#,##0.000000';
const HEADER_ROW = 10;
const FIRST_ROW = 11;
const TAX_LABEL = (tax: TaxSnapshot) =>
  tax.seRate
    ? `Estimated tax savings at ${tax.rate}% + ${tax.seRate}% self-employment`
    : `Estimated tax savings at ${tax.rate}%`;

const today = (at: Date) =>
  at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** One CSV cell: quoted only when it has to be, which keeps a formula's own commas inside one cell. */
function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const shares = (c: CopyContext) => {
  const master = c.earnings?.masterShare ?? 0;
  const song = c.earnings?.songShare ?? 0;
  return { master, song, distributor: c.earnings?.distributor ?? 0 };
};

/**
 * The projection as a CSV for Google Sheets: a header block, the share inputs, one row per platform whose pool and
 * estimate are formulas, then the radio line, the totals, the distributor and the tax worksheet block. A member can
 * change a stream count, a rate or a share and the sheet follows.
 */
export function projectionSheetCsv(c: CopyContext, brand?: LabBrandSource): string {
  const name = labBrand(brand);
  const { master, song, distributor } = shares(c);
  const platforms = c.earnings?.platforms ?? [];
  const rows: (string | number)[][] = [
    [`${name.name.toUpperCase()} — ROYALTY PROJECTION`],
    [name.tagline],
    ["The Financial Lab · self-calculating sheet"],
    [],
    ["Song", c.title, "", "Artist", c.artist],
    ["Album", c.album, "", "ISRC", c.isrc],
    [],
    ["Master share (%)", master, "Song share (%)", song, "Distributor cut (%)", distributor],
    [],
    ["Platform", "Streams", "Rate (USD)", "Platform pays (USD)", "Your share (USD)"],
  ];

  const first = rows.length + 1;
  for (const platform of platforms) {
    const row = rows.length + 1;
    rows.push([
      platform.name,
      platform.streams || "",
      platform.rate,
      `=B${row}*C${row}`,
      `=D${row}*((${MASTER_PORTION}*$B$8+(1-${MASTER_PORTION})*$D$8)/100)`,
    ]);
  }
  const last = rows.length;
  const radioRow = rows.length + 1;
  rows.push(["Radio / SiriusXM / live", "", "", "", c.earnings?.radio ?? 0]);
  const totalRow = rows.length + 1;
  rows.push([
    "Your share total",
    `=SUM(B${first}:B${last})`,
    "",
    `=SUM(D${first}:D${last})`,
    `=SUM(E${first}:E${radioRow})`,
  ]);
  const cutRow = rows.length + 1;
  rows.push(["Distributor's cut", "", "", "", `=E${totalRow}*$F$8/100`]);
  rows.push(["You keep after distributor", "", "", "", `=E${totalRow}-E${cutRow}`]);
  rows.push(
    [],
    [
      "Platform pays = streams × rate, before your share. Your share = platform pays × your master/song cut.",
    ],
  );

  if (c.earnings?.territories?.length) {
    rows.push([], ["Listener mix"], ["Market", "Share (%)"]);
    for (const item of c.earnings.territories) if (item.share) rows.push([item.label, item.share]);
  }
  if (c.tax && c.tax.deductible > 0) {
    rows.push([], ["TAX WORKSHEET"]);
    rows.push(["Deductible expenses", "", "", "", `$${c.tax.deductible.toFixed(2)}`]);
    rows.push([TAX_LABEL(c.tax), "", "", "", `$${c.tax.savings.toFixed(2)}`]);
    if (c.tax.year) rows.push(["Tax year", c.tax.year]);
  }
  rows.push(
    [],
    [
      "Estimates only. Platform rates vary by country, subscription tier and agreement; whether a cost qualifies and how much of it is your tax professional's call.",
    ],
  );

  return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export async function projectionWorkbook(c: CopyContext, brand?: LabBrandSource) {
  const { default: ExcelJS } = await import("exceljs");
  const name = labBrand(brand);
  const { master, song, distributor } = shares(c);
  const platforms = c.earnings?.platforms ?? [];
  const wb = new ExcelJS.Workbook();
  wb.creator = name.name;
  wb.company = name.name;
  wb.title = `${c.title} royalty projection`;
  wb.calcProperties.fullCalcOnLoad = true;

  const ws = wb.addWorksheet("Projection", { views: [{ state: "frozen", ySplit: HEADER_ROW }] });
  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 15;
  ws.getColumn(3).width = 15;
  ws.getColumn(4).width = 15;
  ws.getColumn(5).width = 20;
  ws.getColumn(6).width = 12;

  ws.mergeCells("A1:F1");
  const title = ws.getCell("A1");
  title.value = `${name.name} — Royalty Projection`;
  title.font = { bold: true, size: 18, color: { argb: inkOn(name.accent) } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(name.accent) } };
  title.alignment = { vertical: "middle" };
  ws.getRow(1).height = 30;

  ws.mergeCells("A2:F2");
  ws.getCell("A2").value = name.tagline;
  ws.getCell("A2").font = { size: 10, bold: true, color: { argb: argb(name.accent) } };
  ws.mergeCells("A3:F3");
  ws.getCell("A3").value =
    `${c.title}  ·  ${c.artist || "No artist"}${c.album ? `  ·  ${c.album}` : ""}`;
  ws.getCell("A3").font = { size: 11, color: { argb: "FF525252" } };
  ws.mergeCells("A4:F4");
  ws.getCell("A4").value = `Prepared ${today(new Date())}  ·  The Financial Lab`;
  ws.getCell("A4").font = { size: 9, color: { argb: "FF525252" } };

  const input = (cell: string, value: string | number, fmt?: string) => {
    const box = ws.getCell(cell);
    box.value = value;
    if (fmt) box.numFmt = fmt;
    box.font = { bold: true };
    box.border = {
      top: { style: "thin", color: { argb: "FFDEE2EA" } },
      bottom: { style: "thin", color: { argb: "FFDEE2EA" } },
      left: { style: "thin", color: { argb: "FFDEE2EA" } },
      right: { style: "thin", color: { argb: "FFDEE2EA" } },
    };
  };
  ws.getCell("A6").value = "Master share (%)";
  ws.getCell("A6").font = { bold: true };
  input("B6", master, "0.00");
  ws.getCell("C6").value = "Song share (%)";
  ws.getCell("C6").font = { bold: true };
  input("D6", song, "0.00");
  ws.getCell("E6").value = "Distributor cut (%)";
  ws.getCell("E6").font = { bold: true };
  input("F6", distributor, "0.00");
  ws.mergeCells("A7:F7");
  ws.getCell("A7").value =
    "Change a stream count, a rate, a share or the cut, and platform pays, your share and totals recalculate.";
  ws.getCell("A7").font = { size: 9, italic: true, color: { argb: "FF525252" } };

  const headers = ["Platform", "Streams", "Rate (USD)", "Platform pays (USD)", "Your share (USD)"];
  headers.forEach((label, i) => {
    const cell = ws.getRow(HEADER_ROW).getCell(i + 1);
    cell.value = label;
    cell.font = { bold: true, size: 10, color: { argb: argb(name.accent) } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEFF5" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FFDEE2EA" } } };
  });

  platforms.forEach((platform, i) => {
    const row = FIRST_ROW + i;
    ws.getCell(`A${row}`).value = platform.name;
    const streams = ws.getCell(`B${row}`);
    if (platform.streams) {
      streams.value = platform.streams;
      streams.numFmt = "#,##0";
    }
    const rate = ws.getCell(`C${row}`);
    rate.value = platform.rate;
    rate.numFmt = RATE;
    const pool = ws.getCell(`D${row}`);
    pool.value = { formula: `B${row}*C${row}` };
    pool.numFmt = MONEY;
    const yours = ws.getCell(`E${row}`);
    yours.value = {
      formula: `D${row}*((${MASTER_PORTION}*$B$6+(1-${MASTER_PORTION})*$D$6)/100)`,
    };
    yours.numFmt = MONEY;
    for (const col of ["A", "B", "C", "D", "E"])
      ws.getCell(`${col}${row}`).border = {
        bottom: { style: "hair", color: { argb: "FFE7EAF0" } },
      };
  });

  const last = FIRST_ROW + Math.max(0, platforms.length - 1);
  const radioRow = last + 1;
  ws.getCell(`A${radioRow}`).value = "Radio / SiriusXM / live";
  const radio = ws.getCell(`E${radioRow}`);
  radio.value = c.earnings?.radio ?? 0;
  radio.numFmt = MONEY;

  const totalRow = radioRow + 1;
  ws.getCell(`A${totalRow}`).value = "Your share total";
  ws.getCell(`A${totalRow}`).font = { bold: true };
  const totalStreams = ws.getCell(`B${totalRow}`);
  totalStreams.value = { formula: `SUM(B${FIRST_ROW}:B${last})` };
  totalStreams.numFmt = "#,##0";
  const totalPool = ws.getCell(`D${totalRow}`);
  totalPool.value = { formula: `SUM(D${FIRST_ROW}:D${last})` };
  totalPool.numFmt = MONEY;
  const totalYours = ws.getCell(`E${totalRow}`);
  totalYours.value = { formula: `SUM(E${FIRST_ROW}:E${radioRow})` };
  totalYours.numFmt = MONEY;
  totalYours.font = { bold: true };
  for (const col of ["A", "B", "C", "D", "E"])
    ws.getCell(`${col}${totalRow}`).border = {
      top: { style: "thin", color: { argb: "FFDEE2EA" } },
    };

  const cutRow = totalRow + 1;
  ws.getCell(`A${cutRow}`).value = "Distributor's cut";
  const cut = ws.getCell(`E${cutRow}`);
  cut.value = { formula: `E${totalRow}*$F$6/100` };
  cut.numFmt = MONEY;
  const keepRow = cutRow + 1;
  ws.getCell(`A${keepRow}`).value = "You keep after distributor";
  ws.getCell(`A${keepRow}`).font = { bold: true };
  const keep = ws.getCell(`E${keepRow}`);
  keep.value = { formula: `E${totalRow}-E${cutRow}` };
  keep.numFmt = MONEY;
  keep.font = { bold: true, color: { argb: argb(name.accent) } };

  let noteRow = keepRow + 2;
  if (c.earnings?.territories?.length) {
    ws.getCell(`A${noteRow}`).value = "Listener mix";
    ws.getCell(`A${noteRow}`).font = { bold: true };
    noteRow += 1;
    for (const item of c.earnings.territories)
      if (item.share) {
        ws.getCell(`A${noteRow}`).value = item.label;
        ws.getCell(`B${noteRow}`).value = `${item.share}%`;
        noteRow += 1;
      }
  }
  if (c.tax && c.tax.deductible > 0) {
    noteRow += 1;
    ws.getCell(`A${noteRow}`).value = "Tax worksheet";
    ws.getCell(`A${noteRow}`).font = { bold: true, color: { argb: argb(name.accent) } };
    noteRow += 1;
    ws.getCell(`A${noteRow}`).value = "Deductible expenses";
    ws.getCell(`E${noteRow}`).value = c.tax.deductible;
    ws.getCell(`E${noteRow}`).numFmt = MONEY;
    noteRow += 1;
    ws.getCell(`A${noteRow}`).value = TAX_LABEL(c.tax);
    ws.getCell(`A${noteRow}`).alignment = { wrapText: true };
    ws.getCell(`E${noteRow}`).value = c.tax.savings;
    ws.getCell(`E${noteRow}`).numFmt = MONEY;
    noteRow += 1;
    if (c.tax.year) {
      ws.getCell(`A${noteRow}`).value = "Tax year";
      ws.getCell(`B${noteRow}`).value = c.tax.year;
      noteRow += 1;
    }
  }
  noteRow += 1;
  ws.mergeCells(`A${noteRow}:F${noteRow}`);
  ws.getCell(`A${noteRow}`).value =
    "Platform pays = streams × rate, before your share. Your share = platform pays × your master/song cut.";
  ws.getCell(`A${noteRow}`).font = { size: 9, italic: true, color: { argb: "FF525252" } };
  ws.getCell(`A${noteRow}`).alignment = { wrapText: true, vertical: "top" };
  ws.getRow(noteRow).height = 24;
  noteRow += 2;
  ws.mergeCells(`A${noteRow}:F${noteRow}`);
  ws.getCell(`A${noteRow}`).value =
    "Estimates only. Platform rates vary by country, subscription tier and agreement, and the master and song shares are the member's own. Nothing here is tax advice.";
  ws.getCell(`A${noteRow}`).font = { size: 9, italic: true, color: { argb: "FF525252" } };
  ws.getCell(`A${noteRow}`).alignment = { wrapText: true, vertical: "top" };
  ws.getRow(noteRow).height = 30;

  return wb;
}

export async function downloadProjectionXlsx(c: CopyContext, brand?: LabBrandSource) {
  const wb = await projectionWorkbook(c, brand);
  const buffer = await wb.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${c.title || "financial-lab"} projection.xlsx`,
  );
}

/** The Google Sheets choice: a plain `.csv` whose formulas Sheets evaluates on import. */
export function downloadProjectionSheetCsv(c: CopyContext, brand?: LabBrandSource) {
  saveBlob(
    new Blob([projectionSheetCsv(c, brand)], { type: "text/csv;charset=utf-8" }),
    `${c.title || "financial-lab"} projection.csv`,
  );
}
