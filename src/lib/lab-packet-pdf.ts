import type { jsPDF as JsPDF } from "jspdf";
import type { PDFDict, PDFRef } from "pdf-lib";
import {
  accentOf,
  brandFooter,
  brandHeader,
  font,
  headerDate,
  INK,
  MARGIN,
  MUTED,
  newBrandedPdf,
  PANEL,
  RULE,
  sectionTitle,
  type Weight,
} from "@/lib/brand-pdf";
import type { PdfBrand } from "@/lib/brand-kit";
import { saveBlob } from "@/lib/catalog";
import { budgetProgress } from "@/lib/financial-lab-budgets";
import { taxCategoryOf, taxRowAmount } from "@/lib/financial-lab-tax";
import {
  packetPlatforms,
  packetRoyalty,
  packetTax,
  packetTallyTotal,
  packetTallyUsed,
  packetTotals,
  type PacketSong,
  type PacketTally,
  type PacketTax,
} from "@/lib/lab-packet";
import { filingStatusLabel, type TaxYearTable } from "@/lib/tax-brackets";

/**
 * The Financial Lab packet as one branded PDF: a cover, a totals summary, then the tax worksheet, the production
 * budget, the platform streams tally and the royalty projection for the same scope and tax year. It is a record to
 * hand to an accountant, so it prints the figures the Lab has saved and tells the member what to do with the file —
 * download it, keep it, and email it to themselves and their preparer.
 *
 * The tally page is the one fillable part: its platform boxes are real form fields and their total adds itself up, so a
 * member can type the numbers from each platform's report and see the scope's streams before the projection prints.
 * Everything else is a record of what the Lab already holds — the fillable worksheet, the workbook and the Sheet remain
 * their own downloads.
 */
export type PacketPdfMeta = {
  /** The scope's name: a song, a release, "12 selected songs" or "Entire catalog". */
  label: string;
  year: number;
  tables?: TaxYearTable[];
  brand?: PdfBrand | null;
  /** The platform totals typed in the Lab, when there are any; they replace the saved streams in the projection. */
  tally?: PacketTally;
  madeAt?: Date;
};

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const count = (n: number) => Math.round(n).toLocaleString("en-US");
const rateMoney = (n: number) => `$${Number(n.toFixed(n >= 0.0001 ? 4 : 6))}`;

/** jsPDF works in mm from the top-left; a PDF form field is in points from the bottom-left. */
const MM_TO_PT = 72 / 25.4;

/** One fillable box on the tally page, in the millimetres jsPDF drew it in. */
type TallyField = {
  name: string;
  page: number;
  left: number;
  top: number;
  width: number;
  height: number;
  value: string;
  readOnly?: boolean;
  calculate?: string;
};

const TALLY_NUMBER =
  'function ctaNumber(v){var s=String(v),out="",i,ch;for(i=0;i<s.length;i++){ch=s.charAt(i);if((ch>="0"&&ch<="9")||ch==="."){out+=ch;}}var n=parseFloat(out);return isNaN(n)?0:n;}';
const TALLY_COUNT =
  'function ctaCount(n){n=Math.round(n);var s=String(n),out="",c=0,i;for(i=s.length-1;i>=0;i--){out=s.charAt(i)+out;c++;if(c%3===0&&i>0){out=","+out;}}return out;}';

/** Acrobat's total for the tally boxes: every typed platform count added up, with thousands separators. */
export function packetTallyScript(ids: readonly string[]) {
  const list = ids.map((id) => `"${id.replace(/"/g, "")}"`).join(",");
  return `${TALLY_NUMBER}\n${TALLY_COUNT}\nvar ctaTotal=0,ctaI,ctaF;var ctaIds=[${list}];for(ctaI=0;ctaI<ctaIds.length;ctaI++){ctaF=this.getField("tally-"+ctaIds[ctaI]);if(ctaF){ctaTotal+=ctaNumber(ctaF.value);}}event.value=ctaCount(ctaTotal);`;
}

type Col = {
  text: string;
  x: number;
  align?: "left" | "right";
  weight?: Weight;
  size?: number;
  color?: [number, number, number];
  /** Text wider than this is shortened, so a long release name never prints over its neighbour. */
  width?: number;
};

/** One line of a table, at the page's own margin. */
function row(pdf: JsPDF, y: number, cols: Col[]) {
  for (const col of cols) {
    const text = col.width ? fit(pdf, col.text, col.width) : col.text;
    font(pdf, col.weight ?? "regular", col.size ?? 9.5)
      .setTextColor(...(col.color ?? INK))
      .text(text, col.x, y, { align: col.align ?? "left" });
  }
}

/** Shortens a string to a width in millimetres, with an ellipsis when it had to be cut. */
function fit(pdf: JsPDF, text: string, width: number) {
  if (pdf.getTextWidth(text) <= width) return text;
  let cut = text;
  while (cut.length > 1 && pdf.getTextWidth(`${cut}…`) > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

function columns(pdf: JsPDF, y: number, labels: [string, number, "left" | "right"][]) {
  for (const [text, x, align] of labels)
    font(pdf, "semibold", 7.5)
      .setTextColor(...MUTED)
      .text(text.toUpperCase(), x, y, { align, charSpace: 0.35 });
  const w = pdf.internal.pageSize.getWidth();
  pdf
    .setDrawColor(...RULE)
    .setLineWidth(0.25)
    .line(MARGIN, y - 2.5, w - MARGIN, y - 2.5);
  return y + 6.5;
}

/**
 * Room for the next block: when there is none, a fresh page carries the section's own small heading, so a table that
 * runs over several pages still reads as the same section.
 */
function room(pdf: JsPDF, y: number, needed: number, running: string) {
  const h = pdf.internal.pageSize.getHeight();
  if (y + needed <= h - 26) return y;
  pdf.addPage();
  font(pdf, "semibold", 9)
    .setTextColor(...MUTED)
    .text(running, MARGIN, 20);
  pdf
    .setDrawColor(...RULE)
    .setLineWidth(0.25)
    .line(MARGIN, 24, pdf.internal.pageSize.getWidth() - MARGIN, 24);
  return 32;
}

/** A light panel with a label and a figure, the shape the Lab's own documents use for their headline numbers. */
function tile(
  pdf: JsPDF,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  note: string,
) {
  pdf.setFillColor(...PANEL).roundedRect(x, y, w, 24, 2.5, 2.5, "F");
  font(pdf, "semibold", 7)
    .setTextColor(...MUTED)
    .text(label.toUpperCase(), x + 4, y + 6.5, { charSpace: 0.3 });
  font(pdf, "bold", 13)
    .setTextColor(...INK)
    .text(fit(pdf, value, w - 8), x + 4, y + 15);
  if (note)
    font(pdf, "regular", 7.5)
      .setTextColor(...MUTED)
      .text(fit(pdf, note, w - 8), x + 4, y + 20.5);
}

function tiles(pdf: JsPDF, y: number, items: [string, string, string][]) {
  const w = pdf.internal.pageSize.getWidth();
  const gap = 4;
  const boxW = (w - MARGIN * 2 - gap) / 2;
  items.forEach(([label, value, note], index) => {
    const x = MARGIN + (index % 2) * (boxW + gap);
    const top = y + Math.floor(index / 2) * 28;
    tile(pdf, x, top, boxW, label, value, note);
  });
  return y + Math.ceil(items.length / 2) * 28;
}

/** A bordered note in the brand's accent — the one thing on the page the member must not miss. */
function callout(
  pdf: JsPDF,
  y: number,
  title: string,
  lines: string[],
  accent: [number, number, number],
) {
  const w = pdf.internal.pageSize.getWidth();
  const boxW = w - MARGIN * 2;
  const padded = lines.flatMap((line) => pdf.splitTextToSize(line, boxW - 12) as string[]);
  const h = 10 + padded.length * 4.6;
  pdf.setFillColor(...PANEL).roundedRect(MARGIN, y, boxW, h, 2.5, 2.5, "F");
  pdf.setFillColor(...accent).rect(MARGIN, y, 1.6, h, "F");
  font(pdf, "semibold", 8)
    .setTextColor(...accent)
    .text(title.toUpperCase(), MARGIN + 6, y + 5.5, { charSpace: 0.3 });
  font(pdf, "regular", 9).setTextColor(...INK);
  padded.forEach((line, index) => pdf.text(line, MARGIN + 6, y + 11 + index * 4.6));
  return y + h + 6;
}

function paragraph(pdf: JsPDF, y: number, text: string, size = 9) {
  const lines = pdf.splitTextToSize(
    text,
    pdf.internal.pageSize.getWidth() - MARGIN * 2,
  ) as string[];
  font(pdf, "regular", size).setTextColor(...MUTED);
  lines.forEach((line, index) => pdf.text(line, MARGIN, y + index * 4.6));
  return y + lines.length * 4.6;
}

function cover(
  pdf: JsPDF,
  songs: PacketSong[],
  meta: PacketPdfMeta,
  tax: PacketTax,
  totals: ReturnType<typeof packetTotals>,
) {
  const w = pdf.internal.pageSize.getWidth();
  const brand = meta.brand ?? null;
  const charged = tax.lines.filter((line) => taxRowAmount(line) > 0).length;
  let y = brandHeader(
    pdf,
    "Financial Lab Packet",
    meta.label,
    `Tax year ${meta.year}  ·  ${headerDate()}`,
    brand,
  );

  y = tiles(pdf, y, [
    [
      "Songs in this packet",
      count(totals.songs),
      totals.releases === 1 ? "1 release" : `${count(totals.releases)} releases`,
    ],
    ["Tax year", String(meta.year), `${charged} deductible ${charged === 1 ? "line" : "lines"}`],
  ]);
  y += 2;

  y = sectionTitle(pdf, y, "What's inside");
  const contents: [string, string][] = [
    ["Totals summary", "Every combined figure on one page, then the same figures song by song"],
    ["Artist Tax Write-Off", `The worksheet for ${meta.year}, merged across the songs in scope`],
    ["Production Budget", "Each song's plan, what it budgeted, what was paid and what is left"],
    ["Platform streams tally", "Where to add up these songs' streams from each platform's report"],
    ["Royalty projection", "The scope's streams, rates and estimated payout, by platform"],
  ];
  contents.forEach(([name, note], index) => {
    font(pdf, "bold", 9.5)
      .setTextColor(...INK)
      .text(`${index + 1}`, MARGIN, y);
    font(pdf, "bold", 9.5)
      .setTextColor(...(index === 0 ? accentOf(pdf) : INK))
      .text(name, MARGIN + 7, y);
    font(pdf, "regular", 8.5)
      .setTextColor(...MUTED)
      .text(fit(pdf, note, w - MARGIN * 2 - 62), MARGIN + 51, y);
    y += 6.5;
  });
  y += 4;

  y = callout(
    pdf,
    y,
    "What to do with this file",
    [
      `Download it and keep it: it is the record of these ${totals.songs === 1 ? "numbers" : `${count(totals.songs)} songs' numbers`} for tax year ${meta.year}.`,
      "Email a copy to yourself, and to your accountant or tax preparer. Nothing is sent for you — the file leaves your computer when you send it.",
      "If a figure changes in the Lab, download the packet again, so the copy you sent and the copy you keep are the same.",
    ],
    accentOf(pdf),
  );

  if (packetTallyUsed(meta.tally)) {
    y = paragraph(
      pdf,
      y,
      "The projection in this file uses the platform totals you tallied in the Lab.",
      8.5,
    );
    y += 2;
  }

  y = sectionTitle(pdf, y, "The songs in scope");
  // The disclaimer sits at the foot of the page; ten rows leave it room even on a catalog-sized packet.
  const listed = songs.slice(0, 10);
  for (const song of listed) {
    font(pdf, "regular", 8.5).setTextColor(...MUTED);
    pdf.text(fit(pdf, song.title || "Untitled", 92), MARGIN, y);
    font(pdf, "regular", 8.5).setTextColor(...MUTED);
    pdf.text(fit(pdf, song.release, 70), MARGIN + 96, y, { align: "left" });
    pdf.text(song.kind, w - MARGIN, y, { align: "right" });
    y += 4.8;
  }
  if (songs.length > listed.length)
    font(pdf, "regular", 8.5)
      .setTextColor(...MUTED)
      .text(
        `and ${count(songs.length - listed.length)} more, listed in the summary and the sections below.`,
        MARGIN,
        y + 1,
      );
  y += 8;

  font(pdf, "regular", 7.5)
    .setTextColor(...MUTED)
    .text(
      "Estimates only. Platform rates vary, and whether a cost qualifies, how much of it and the rate that applies are your tax professional's call. Nothing here is tax advice and nothing here is filed.",
      MARGIN,
      Math.min(y, pdf.internal.pageSize.getHeight() - 30),
      { maxWidth: w - MARGIN * 2 },
    );
  return pdf;
}

function summary(
  pdf: JsPDF,
  songs: PacketSong[],
  meta: PacketPdfMeta,
  tax: PacketTax,
  totals: ReturnType<typeof packetTotals>,
) {
  const brand = meta.brand ?? null;
  const charged = tax.lines.filter((line) => taxRowAmount(line) > 0).length;
  pdf.addPage();
  let y = brandHeader(
    pdf,
    "Totals summary",
    `${meta.label}  ·  tax year ${meta.year}`,
    `${count(totals.songs)} ${totals.songs === 1 ? "song" : "songs"}  ·  ${headerDate()}`,
    brand,
  );

  y = tiles(pdf, y, [
    [
      "You keep after distributor",
      money(totals.royalty),
      totals.gross > totals.royalty
        ? "after master, song and distributor cuts"
        : "after master and song shares; distributor cut 0%",
    ],
    ["Budget spent", money(totals.budget.spent), `of ${money(totals.budget.target)} target`],
    [
      "Deductible total",
      money(totals.deductible),
      `${charged} ${charged === 1 ? "line" : "lines"} for ${meta.year}`,
    ],
    [
      "Estimated tax savings",
      money(totals.savings),
      tax.seRate > 0
        ? `${tax.rate}% income + ${tax.seRate}% self-employment`
        : `${tax.rate}% income tax`,
    ],
  ]);
  y += 2;

  y = sectionTitle(pdf, y, "Song by song");
  y = columns(pdf, y, [
    ["Song", MARGIN, "left"],
    ["Release", MARGIN + 58, "left"],
    ["Streams", MARGIN + 130, "right"],
    ["Royalties", MARGIN + 154, "right"],
    ["Deductible", pdf.internal.pageSize.getWidth() - MARGIN, "right"],
  ]);

  const w = pdf.internal.pageSize.getWidth();
  songs.forEach((song) => {
    y = room(pdf, y, 7, "Totals summary — song by song");
    const projection = packetRoyalty(song);
    const own = packetTax([song], meta.year, meta.tables, meta.madeAt ?? new Date());
    const empty = projection.streams === 0 && own.total === 0;
    row(pdf, y, [
      { text: song.title || "Untitled", x: MARGIN, width: 54, weight: "semibold", size: 8.5 },
      { text: song.release, x: MARGIN + 58, width: 52, size: 8, color: MUTED },
      {
        text: projection.streams ? count(projection.streams) : "—",
        x: MARGIN + 130,
        align: "right",
        size: 8.5,
      },
      {
        text: projection.streams ? money(projection.net) : "—",
        x: MARGIN + 154,
        align: "right",
        size: 8.5,
      },
      { text: own.total ? money(own.total) : "—", x: w - MARGIN, align: "right", size: 8.5 },
    ]);
    if (!empty) {
      pdf
        .setDrawColor(...RULE)
        .setLineWidth(0.2)
        .line(MARGIN, y + 2, w - MARGIN, y + 2);
    }
    y += 6;
  });

  y = room(pdf, y, 10, "Totals summary — song by song");
  pdf
    .setDrawColor(...RULE)
    .setLineWidth(0.35)
    .line(MARGIN, y - 1, w - MARGIN, y - 1);
  y += 4;
  row(pdf, y, [
    { text: "Total", x: MARGIN, weight: "bold", size: 9.5 },
    {
      text: count(totals.streams),
      x: MARGIN + 130,
      align: "right",
      weight: "semibold",
      size: 8.5,
    },
    { text: money(totals.royalty), x: MARGIN + 154, align: "right", weight: "bold", size: 9.5 },
    { text: money(totals.deductible), x: w - MARGIN, align: "right", weight: "bold", size: 9.5 },
  ]);
  y += 8;

  if (tax.skipped.length)
    y = paragraph(
      pdf,
      y,
      `Left out of the tax worksheet because their worksheet names another year: ${tax.skipped.join(", ")}.`,
    );
  y = paragraph(
    pdf,
    y,
    packetTallyUsed(meta.tally)
      ? "The projection above uses the platform totals you tallied for this scope. The song rows show each song's own saved figures; a song with nothing saved yet shows a dash."
      : "Every figure here is what the Lab has saved for these songs. A song with no streams or no cost lines yet shows a dash, not a zero dressed up as a projection.",
  );
  return pdf;
}

function taxSection(pdf: JsPDF, meta: PacketPdfMeta, tax: PacketTax) {
  const w = pdf.internal.pageSize.getWidth();
  pdf.addPage();
  let y = brandHeader(
    pdf,
    "Artist Tax Write-Off",
    `${meta.label}  ·  tax year ${tax.year}`,
    tax.gap ? `${tax.gap.used} federal brackets` : `${tax.tableYear} federal brackets`,
    meta.brand ?? null,
  );

  const status = tax.status ? filingStatusLabel(tax.status) : "Filing status not set";
  const panelLines: [string, string][] = [
    ["Tax year", String(tax.year)],
    ["Filing status", status],
    ["Marginal rate", `${tax.rate}%`],
    ["Self-employment", tax.seRate > 0 ? `${tax.seRate}% counted` : "not counted"],
  ];
  const boxW = (w - MARGIN * 2 - 12) / 2;
  const rows: [string, string][][] = [];
  for (let i = 0; i < panelLines.length; i += 2) rows.push(panelLines.slice(i, i + 2));
  pdf
    .setFillColor(...PANEL)
    .roundedRect(MARGIN, y, w - MARGIN * 2, 10 + rows.length * 10, 2.5, 2.5, "F");
  let py = y + 6.5;
  for (const pair of rows) {
    pair.forEach(([name, value], index) => {
      const x = MARGIN + 4 + index * (boxW + 4);
      font(pdf, "regular", 8)
        .setTextColor(...MUTED)
        .text(name.toUpperCase(), x, py, { charSpace: 0.25 });
      font(pdf, "semibold", 9.5)
        .setTextColor(...INK)
        .text(value, x, py + 4.2);
    });
    py += 10;
  }
  y += 12 + rows.length * 10;

  y = paragraph(
    pdf,
    y,
    `Priced with the ${tax.tableYear} federal brackets (${tax.tableSource}).${
      tax.gap
        ? ` There is no ${tax.gap.asked} table on hand yet, so ${tax.gap.used}'s brackets are used and the year is only a plan.`
        : ""
    }`,
    8.5,
  );
  y += 2;
  if (tax.included.length) y = paragraph(pdf, y, `Included from: ${tax.included.join(", ")}.`, 8.5);
  if (tax.skipped.length)
    y = paragraph(pdf, y, `Left out (another tax year): ${tax.skipped.join(", ")}.`, 8.5);
  y += 3;

  const multi = new Set(tax.lines.map((line) => line.song)).size > 1;
  y = sectionTitle(pdf, y, "What you spent");
  y = columns(
    pdf,
    y,
    multi
      ? [
          ["Song", MARGIN, "left"],
          ["Cost category", MARGIN + 38, "left"],
          ["What it was", MARGIN + 96, "left"],
          ["Amount", MARGIN + 160, "right"],
          ["Kept", w - MARGIN, "right"],
        ]
      : [
          ["Cost category", MARGIN, "left"],
          ["What it was", MARGIN + 64, "left"],
          ["Amount", MARGIN + 160, "right"],
          ["Kept", w - MARGIN, "right"],
        ],
  );

  if (!tax.lines.length) {
    y = paragraph(
      pdf,
      y,
      "No cost lines were saved for these songs in this tax year yet. Add them in the worksheet and download the packet again.",
      9,
    );
  }
  tax.lines.forEach((line) => {
    y = room(pdf, y, 6.5, "Artist Tax Write-Off — continued");
    const category = taxCategoryOf(line.category)?.label ?? "Not chosen yet";
    const amount = taxRowAmount(line);
    if (multi) {
      row(pdf, y, [
        { text: line.song, x: MARGIN, width: 34, size: 7.5, color: MUTED },
        { text: category, x: MARGIN + 38, width: 54, size: 8.5 },
        {
          text: line.label && line.label !== category ? line.label : "",
          x: MARGIN + 96,
          width: 42,
          size: 8,
          color: MUTED,
        },
        { text: amount ? money(amount) : "—", x: MARGIN + 160, align: "right", size: 8.5 },
        {
          text: line.kept ? "KEPT" : "—",
          x: w - MARGIN,
          align: "right",
          size: 7.5,
          color: line.kept ? accentOf(pdf) : MUTED,
        },
      ]);
    } else {
      row(pdf, y, [
        { text: category, x: MARGIN, width: 58, size: 9 },
        {
          text: line.label && line.label !== category ? line.label : "",
          x: MARGIN + 64,
          width: 62,
          size: 8,
          color: MUTED,
        },
        { text: amount ? money(amount) : "—", x: MARGIN + 160, align: "right", size: 9 },
        {
          text: line.kept ? "KEPT" : "—",
          x: w - MARGIN,
          align: "right",
          size: 7.5,
          color: line.kept ? accentOf(pdf) : MUTED,
        },
      ]);
    }
    y += 6;
  });

  y = room(pdf, y, 46, "Artist Tax Write-Off — continued");
  y += 2;
  const results: [string, number][] = [
    ["Deductible total", tax.total],
    ["Income tax", tax.income],
    ...(tax.seRate > 0 ? ([["Self-employment tax", tax.se]] as [string, number][]) : []),
    ["Estimated tax savings", tax.savings],
  ];
  const panelH = 12 + results.length * 8;
  pdf.setFillColor(...PANEL).roundedRect(MARGIN, y, w - MARGIN * 2, panelH, 2.5, 2.5, "F");
  sectionTitle(pdf, y + 6, "The estimate");
  results.forEach(([name, value], index) => {
    const rowY = y + 14 + index * 8;
    font(
      pdf,
      index === results.length - 1 ? "bold" : "regular",
      index === results.length - 1 ? 11 : 9.5,
    )
      .setTextColor(...(index === results.length - 1 ? accentOf(pdf) : INK))
      .text(name, MARGIN + 4, rowY);
    font(pdf, "bold", index === results.length - 1 ? 12 : 10)
      .setTextColor(...(index === results.length - 1 ? accentOf(pdf) : INK))
      .text(money(value), w - MARGIN - 4, rowY, { align: "right" });
  });
  y += panelH + 6;

  y = paragraph(
    pdf,
    y,
    "Estimate only. Whether a cost qualifies where you file, how much of it, and the rate that applies are your tax professional's call. Nothing here is tax advice and nothing here is filed. This is not your worksheet's fillable copy — that is its own download.",
    7.5,
  );
  return pdf;
}

function budgetSection(pdf: JsPDF, songs: PacketSong[], meta: PacketPdfMeta) {
  const w = pdf.internal.pageSize.getWidth();
  const brand = meta.brand ?? null;
  pdf.addPage();
  const total = songs.reduce(
    (sum, song) => {
      if (!song.budget) return sum;
      const progress = budgetProgress(song.budget.rows, song.budget.target);
      return {
        plans: sum.plans + 1,
        target: sum.target + (Number(song.budget.target) || 0),
        planned: sum.planned + progress.planned,
        spent: sum.spent + progress.spent,
      };
    },
    { plans: 0, target: 0, planned: 0, spent: 0 },
  );
  let y = brandHeader(
    pdf,
    "Production Budget",
    meta.label,
    `${money(total.target)} across ${total.plans} ${total.plans === 1 ? "plan" : "plans"}`,
    brand,
  );

  const boxW = (w - MARGIN * 2 - 12) / 4;
  const stats: [string, string][] = [
    ["Budget cap", money(total.target)],
    ["Planned", money(total.planned)],
    ["Spent", money(total.spent)],
    ["Remaining", money(total.target - total.spent)],
  ];
  stats.forEach(([name, value], index) => {
    const x = MARGIN + index * (boxW + 4);
    pdf.setFillColor(...PANEL).roundedRect(x, y, boxW, 17, 2.5, 2.5, "F");
    font(pdf, "semibold", 6.5)
      .setTextColor(...MUTED)
      .text(name.toUpperCase(), x + 3, y + 5.5, { charSpace: 0.2 });
    font(pdf, "bold", 10)
      .setTextColor(...INK)
      .text(fit(pdf, value, boxW - 6), x + 3, y + 13);
  });
  y += 24;

  const planned = songs.filter((song) => song.budget);
  if (!planned.length) {
    y = paragraph(
      pdf,
      y,
      "No budget plans are saved for these songs yet. Build one in the Production Budget Planner and download the packet again.",
      9,
    );
    return pdf;
  }

  for (const song of planned) {
    if (!song.budget) continue;
    y = room(pdf, y, 40, "Production Budget — continued");
    const progress = budgetProgress(song.budget.rows, song.budget.target);
    font(pdf, "bold", 10.5)
      .setTextColor(...INK)
      .text(fit(pdf, song.title || "Untitled", w - MARGIN * 2 - 50), MARGIN, y);
    font(pdf, "semibold", 8)
      .setTextColor(...accentOf(pdf))
      .text(song.budget.project, w - MARGIN, y, { align: "right" });
    y += 5;
    font(pdf, "regular", 8).setTextColor(...MUTED);
    pdf.text(
      `${money(song.budget.target)} cap  ·  ${money(progress.planned)} planned  ·  ${money(progress.spent)} spent  ·  ${money(progress.remaining)} remaining`,
      MARGIN,
      y,
    );
    y += 6;
    y = columns(pdf, y, [
      ["Item", MARGIN, "left"],
      ["Budgeted", MARGIN + 130, "right"],
      ["Actual", MARGIN + 156, "right"],
      ["Status", w - MARGIN, "right"],
    ]);
    for (const line of song.budget.rows) {
      y = room(pdf, y, 6, "Production Budget — continued");
      const actual = line.actual.trim() || (line.paid ? String(line.budget) : "");
      row(pdf, y, [
        { text: line.item || line.category || "—", x: MARGIN, width: 108, size: 8.5 },
        {
          text: money(Number(line.budget) || 0),
          x: MARGIN + 130,
          align: "right",
          size: 8.5,
          color: MUTED,
        },
        {
          text: actual ? money(Number(actual) || 0) : "—",
          x: MARGIN + 156,
          align: "right",
          size: 8.5,
        },
        {
          text: line.paid ? "PAID" : "ESTIMATED",
          x: w - MARGIN,
          align: "right",
          size: 7.5,
          weight: "semibold",
          color: line.paid ? accentOf(pdf) : MUTED,
        },
      ]);
      y += 5.6;
    }
    y = room(pdf, y, 10, "Production Budget — continued");
    pdf
      .setDrawColor(...RULE)
      .setLineWidth(0.3)
      .line(MARGIN, y - 1, w - MARGIN, y - 1);
    y += 4;
    row(pdf, y, [
      { text: "Total", x: MARGIN, weight: "bold", size: 9 },
      { text: money(progress.planned), x: MARGIN + 130, align: "right", weight: "bold", size: 9 },
      { text: money(progress.spent), x: MARGIN + 156, align: "right", weight: "bold", size: 9 },
      {
        text: `${progress.paidCount} of ${progress.total} paid`,
        x: w - MARGIN,
        align: "right",
        size: 7.5,
        color: MUTED,
      },
    ]);
    y += 9;
  }

  y = paragraph(
    pdf,
    y,
    "Spent counts the lines ticked paid. A line with an amount typed but not ticked still prints its actual, and the tick is what moves the total.",
    7.5,
  );
  return pdf;
}

function tallySection(pdf: JsPDF, songs: PacketSong[], meta: PacketPdfMeta, fields?: TallyField[]) {
  const w = pdf.internal.pageSize.getWidth();
  pdf.addPage();
  let y = brandHeader(
    pdf,
    "Platform streams tally",
    `${meta.label}  ·  tax year ${meta.year}`,
    "Add these songs up, platform by platform",
    meta.brand ?? null,
  );

  y = paragraph(
    pdf,
    y,
    `The boxes already hold the platform totals you typed in the Lab. Type or correct them from each platform's report for tax year ${meta.year} — the songs in this packet, not the whole catalog — and the total adds itself up. A typed total replaces that platform's saved streams in this packet's projection; leave a box blank to keep the saved figure.`,
    9,
  );
  y += 4;

  y = columns(pdf, y, [
    ["Platform", MARGIN, "left"],
    ["Rate per stream", MARGIN + 84, "right"],
    ["Saved in the Lab", MARGIN + 125, "right"],
    ["Your tally", w - MARGIN, "right"],
  ]);
  const saved = packetPlatforms(songs);
  const platforms = packetPlatforms(songs, meta.tally);
  for (const platform of platforms) {
    y = room(pdf, y, 9, "Platform streams tally — continued");
    const savedStreams = saved.find((row) => row.id === platform.id)?.streams ?? 0;
    row(pdf, y, [
      { text: platform.name, x: MARGIN, width: 62, size: 9 },
      {
        text: platform.streams ? rateMoney(platform.rate) : "—",
        x: MARGIN + 84,
        align: "right",
        size: 8.5,
        color: MUTED,
      },
      {
        text: savedStreams ? count(savedStreams) : "—",
        x: MARGIN + 125,
        align: "right",
        size: 8.5,
      },
    ]);
    // The box is drawn whether or not the field layer is built, so a copy that loses its fields is still a tally sheet.
    const box = { left: w - MARGIN - 44, top: y - 3.6, width: 44, height: 6.4 };
    pdf
      .setDrawColor(...RULE)
      .setLineWidth(0.3)
      .rect(box.left, box.top, box.width, box.height);
    if (fields)
      fields.push({
        name: `tally-${platform.id}`,
        page: pdf.getNumberOfPages(),
        ...box,
        value: meta.tally?.[platform.id] ?? "",
      });
    y += 8.5;
  }
  y = room(pdf, y, 12, "Platform streams tally — continued");
  pdf
    .setDrawColor(...RULE)
    .setLineWidth(0.35)
    .line(MARGIN, y - 1, w - MARGIN, y - 1);
  y += 4.5;
  row(pdf, y, [
    { text: "Total streams", x: MARGIN, weight: "bold", size: 9.5 },
    {
      text: count(platforms.reduce((sum, platform) => sum + platform.streams, 0)),
      x: MARGIN + 125,
      align: "right",
      weight: "bold",
      size: 9,
    },
  ]);
  const totalBox = { left: w - MARGIN - 44, top: y - 3.6, width: 44, height: 6.4 };
  pdf
    .setDrawColor(...RULE)
    .setLineWidth(0.3)
    .rect(totalBox.left, totalBox.top, totalBox.width, totalBox.height);
  if (fields)
    fields.push({
      name: "tally-total",
      page: pdf.getNumberOfPages(),
      ...totalBox,
      value: packetTallyTotal(meta.tally) ? count(packetTallyTotal(meta.tally)) : "",
      readOnly: true,
      calculate: packetTallyScript(platforms.map((platform) => platform.id)),
    });
  y += 10;

  y = paragraph(
    pdf,
    y,
    "A rate is the Lab's saved rate for this scope, blended where the songs differ, with the platform's standard rate where no song has one yet; the projection page prices the streams above.",
    8,
  );
  return pdf;
}

function projectionSection(
  pdf: JsPDF,
  songs: PacketSong[],
  meta: PacketPdfMeta,
  totals: ReturnType<typeof packetTotals>,
) {
  const w = pdf.internal.pageSize.getWidth();
  pdf.addPage();
  let y = brandHeader(
    pdf,
    "Royalty projection",
    `${meta.label}  ·  tax year ${meta.year}`,
    `${count(totals.songs)} ${totals.songs === 1 ? "song" : "songs"}  ·  ${count(totals.streams)} streams`,
    meta.brand ?? null,
  );

  y = columns(pdf, y, [
    ["Platform", MARGIN, "left"],
    ["Streams", MARGIN + 76, "right"],
    ["Rate", MARGIN + 106, "right"],
    ["Platform pays", MARGIN + 148, "right"],
    ["Your share", w - MARGIN, "right"],
  ]);
  const platforms = packetPlatforms(songs, meta.tally);
  for (const platform of platforms) {
    y = room(pdf, y, 7, "Royalty projection — continued");
    row(pdf, y, [
      { text: platform.name, x: MARGIN, size: 9 },
      {
        text: platform.streams ? count(platform.streams) : "—",
        x: MARGIN + 76,
        align: "right",
        size: 8.5,
      },
      {
        text: platform.streams ? rateMoney(platform.rate) : "—",
        x: MARGIN + 106,
        align: "right",
        size: 8.5,
        color: MUTED,
      },
      {
        text: platform.pool ? money(platform.pool) : "—",
        x: MARGIN + 148,
        align: "right",
        size: 8.5,
      },
      {
        text: platform.yoursBefore ? money(platform.yoursBefore) : "—",
        x: w - MARGIN,
        align: "right",
        size: 8.5,
      },
    ]);
    y += 6.2;
  }

  const radio = songs.reduce((sum, song) => sum + packetRoyalty(song).radio, 0);
  const distributor = songs.reduce(
    (sum, song) => Math.max(sum, packetRoyalty(song).distributor),
    0,
  );
  if (radio > 0) {
    y = room(pdf, y, 7, "Royalty projection — continued");
    row(pdf, y, [
      { text: "Radio / SiriusXM / live", x: MARGIN, size: 9 },
      { text: "—", x: MARGIN + 76, align: "right", size: 8.5, color: MUTED },
      { text: "—", x: MARGIN + 106, align: "right", size: 8.5, color: MUTED },
      { text: "—", x: MARGIN + 148, align: "right", size: 8.5, color: MUTED },
      { text: money(radio), x: w - MARGIN, align: "right", size: 8.5 },
    ]);
    y += 6.2;
  }

  y = room(pdf, y, 22, "Royalty projection — continued");
  pdf
    .setDrawColor(...RULE)
    .setLineWidth(0.35)
    .line(MARGIN, y - 1, w - MARGIN, y - 1);
  y += 4.5;
  const platformPays = platforms.reduce((sum, platform) => sum + platform.pool, 0);
  row(pdf, y, [
    { text: "Your share total", x: MARGIN, weight: "bold", size: 9.5 },
    { text: count(totals.streams), x: MARGIN + 76, align: "right", weight: "semibold", size: 9 },
    {
      text: money(platformPays),
      x: MARGIN + 148,
      align: "right",
      weight: "semibold",
      size: 9,
    },
    { text: money(totals.gross), x: w - MARGIN, align: "right", weight: "bold", size: 9.5 },
  ]);
  y += 6;
  if (totals.gross !== totals.royalty) {
    row(pdf, y, [
      {
        text: `Distributor's cut (up to ${distributor}% on a song)`,
        x: MARGIN,
        size: 8.5,
        color: MUTED,
      },
      {
        text: `(${money(totals.gross - totals.royalty)})`,
        x: w - MARGIN,
        align: "right",
        size: 8.5,
        color: MUTED,
      },
    ]);
    y += 5.5;
  }
  row(pdf, y, [
    { text: "You keep after distributor", x: MARGIN, weight: "bold", size: 9.5 },
    {
      text: money(totals.royalty),
      x: w - MARGIN,
      align: "right",
      weight: "bold",
      size: 9.5,
      color: accentOf(pdf),
    },
  ]);
  y += 7;
  y += 4;

  if (totals.releases > 1) {
    y = room(pdf, y, 24, "Royalty projection — continued");
    y = sectionTitle(
      pdf,
      y,
      packetTallyUsed(meta.tally) ? "By release (saved figures)" : "By release",
    );
    y = columns(pdf, y, [
      ["Release", MARGIN, "left"],
      ["Songs", MARGIN + 92, "right"],
      ["Streams", MARGIN + 122, "right"],
      ["You keep after distributor", w - MARGIN, "right"],
    ]);
    const groups = new Map<string, PacketSong[]>();
    for (const song of songs) groups.set(song.release, [...(groups.get(song.release) ?? []), song]);
    for (const [release, list] of groups) {
      y = room(pdf, y, 7, "Royalty projection — continued");
      const streams = list.reduce((sum, song) => sum + packetRoyalty(song).streams, 0);
      const net = list.reduce((sum, song) => sum + packetRoyalty(song).net, 0);
      row(pdf, y, [
        { text: release || "Untitled release", x: MARGIN, width: 86, size: 8.5 },
        { text: count(list.length), x: MARGIN + 92, align: "right", size: 8.5, color: MUTED },
        { text: streams ? count(streams) : "—", x: MARGIN + 122, align: "right", size: 8.5 },
        { text: net ? money(net) : "—", x: w - MARGIN, align: "right", size: 8.5 },
      ]);
      y += 5.8;
    }
    y += 4;
  }

  y = paragraph(
    pdf,
    y,
    packetTallyUsed(meta.tally)
      ? "Estimates only. The projection uses the platform totals you typed on the tally page; the by-release split remains each song's saved figures. Platform rates vary by country, subscription tier and agreement."
      : "Estimates only. Platform rates vary by country, subscription tier and agreement, and the master and song shares come from this scope's saved numbers. The tally page is where the streams behind these figures are checked.",
    8,
  );
  return pdf;
}

/** The whole packet, in the order the member reads it: summary, tax, budget, tally, projection. */
export async function buildPacketPdfBytes(songs: PacketSong[], meta: PacketPdfMeta) {
  const madeAt = meta.madeAt ?? new Date();
  const tax = packetTax(songs, meta.year, meta.tables, madeAt);
  const totals = packetTotals(songs, tax, meta.tally);
  const pdf = await newBrandedPdf(meta.brand ?? undefined);
  const fields: TallyField[] = [];
  cover(pdf, songs, { ...meta, madeAt }, tax, totals);
  summary(pdf, songs, { ...meta, madeAt }, tax, totals);
  taxSection(pdf, { ...meta, madeAt }, tax);
  budgetSection(pdf, songs, { ...meta, madeAt });
  tallySection(pdf, songs, { ...meta, madeAt }, fields);
  projectionSection(pdf, songs, { ...meta, madeAt }, totals);
  brandFooter(pdf, meta.brand ?? undefined);
  const bytes = pdf.output("arraybuffer");
  if (fields.length) {
    try {
      return await withTallyFields(bytes, fields, pdf.internal.pageSize.getHeight());
    } catch (error) {
      // A copy without form fields is still a usable tally sheet, so the download never fails over the field layer.
      console.warn("Packet built without its fillable tally fields:", error);
    }
  }
  return new Uint8Array(bytes);
}

/** Adds the tally boxes and their total as Acrobat fields over the ruled cells the packet already drew. */
async function withTallyFields(bytes: ArrayBuffer, fields: TallyField[], pageHeight: number) {
  const { PDFDocument, PDFName, PDFString, StandardFonts, TextAlignment } = await import("pdf-lib");
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();
  const pages = doc.getPages();
  const order: PDFRef[] = [];
  for (const field of fields) {
    const page = pages[field.page - 1];
    if (!page) continue;
    const text = form.createTextField(field.name);
    text.addToPage(page, {
      x: field.left * MM_TO_PT,
      y: (pageHeight - field.top - field.height) * MM_TO_PT,
      width: field.width * MM_TO_PT,
      height: field.height * MM_TO_PT,
      borderWidth: 0,
    });
    text.setFontSize(9);
    text.setAlignment(TextAlignment.Right);
    if (field.value) text.setText(field.value);
    if (field.readOnly) text.enableReadOnly();
    if (field.calculate) {
      const dict = (text.acroField as unknown as { dict: PDFDict }).dict;
      dict.set(
        PDFName.of("AA"),
        doc.context.obj({
          C: doc.context.obj({ S: "JavaScript", JS: PDFString.of(field.calculate) }),
        }),
      );
      order.push(text.ref);
    }
  }
  if (order.length) form.acroForm.dict.set(PDFName.of("CO"), doc.context.obj(order));
  form.updateFieldAppearances(await doc.embedFont(StandardFonts.Helvetica));
  return new Uint8Array(await doc.save());
}

/** A filename a member can find again: the scope's own name, with anything a filesystem refuses taken out. */
export function packetFilename(label: string): string {
  const clean = label
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${clean || "Financial Lab"} financial lab packet.pdf`;
}

export async function downloadPacketPdf(songs: PacketSong[], meta: PacketPdfMeta) {
  const bytes = await buildPacketPdfBytes(songs, meta);
  saveBlob(new Blob([bytes], { type: "application/pdf" }), packetFilename(meta.label));
}
