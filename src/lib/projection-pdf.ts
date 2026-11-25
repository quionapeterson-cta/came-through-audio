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
  RULE,
  sectionTitle,
} from "@/lib/brand-pdf";
import type { PdfBrand } from "@/lib/brand-kit";
import { saveBlob } from "@/lib/catalog";
import type { CopyContext } from "@/lib/financial-lab-copy";
import { MASTER_PORTION, PLATFORMS } from "@/lib/royalty-calc";

/**
 * The Earnings panel's projection as the fillable choice in its download menu, the same three-format menu the Production
 * Budget Planner uses (founder, 2026-11-25). jsPDF draws the branded page; pdf-lib lays real fields over the Streams and
 * Rate boxes, so a member can type a platform's report figures and Acrobat recalculates platform pays, their share and
 * the totals using the same master/song cut the Lab shows.
 *
 * The figures are read from the Earnings snapshot the panel already produced. Nothing is recalculated here: the printed
 * numbers are what the panel shows, and the fields only reproduce its arithmetic.
 */
const MM_TO_PT = 72 / 25.4;
const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

type Field = {
  name: string;
  page: number;
  left: number;
  top: number;
  width: number;
  height: number;
  value?: string;
  readOnly?: boolean;
  calculate?: string;
};

const JS_NUMBER =
  'function ctaNumber(v){var s=String(v),out="",i,ch;for(i=0;i<s.length;i++){ch=s.charAt(i);if((ch>="0"&&ch<="9")||ch==="."||ch==="-"){out+=ch;}}var n=parseFloat(out);return isNaN(n)?0:n;}';
const JS_MONEY =
  'function ctaMoney(n){var neg=n<0;if(neg){n=-n;}var p=n.toFixed(2).split("."),w=p[0],out="",c=0,i;for(i=w.length-1;i>=0;i--){out=w.charAt(i)+out;c++;if(c%3===0&&i>0){out=","+out;}}return (neg?"-$":"$")+out+"."+p[1];}';
const HELPERS = `${JS_NUMBER}\n${JS_MONEY}\nvar ctaCut=(ctaNumber(this.getField("master").value)*${MASTER_PORTION}+ctaNumber(this.getField("song").value)*(1-${MASTER_PORTION}))/100;`;

const fieldsFor = (count: number) => ({
  streams: `streams-${count}`,
  rate: `rate-${count}`,
  pool: `pool-${count}`,
  estimate: `estimate-${count}`,
});

function text(pdf: JsPDF, y: number, value: string, size = 9, color = MUTED, width?: number) {
  const w = pdf.internal.pageSize.getWidth();
  const lines = width
    ? (pdf.splitTextToSize(value, width) as string[])
    : (pdf.splitTextToSize(value, w - MARGIN * 2) as string[]);
  font(pdf, "regular", size).setTextColor(...color);
  lines.forEach((line, i) => pdf.text(line, MARGIN, y + i * (size * 0.42)));
  return y + Math.max(1, lines.length) * (size * 0.42) + 2.2;
}

function headerCell(pdf: JsPDF, y: number, value: string, x: number, align: "left" | "right") {
  font(pdf, "semibold", 7)
    .setTextColor(...MUTED)
    .text(value.toUpperCase(), x, y, { align, charSpace: 0.3 });
}

export function projectionPdfLayout(pdf: JsPDF, c: CopyContext, brand?: PdfBrand | null) {
  const w = pdf.internal.pageSize.getWidth();
  const fields: Field[] = [];
  let y = brandHeader(
    pdf,
    "Royalty projection",
    c.title || "No song selected",
    `Prepared ${headerDate()}`,
    brand ?? null,
  );

  y = text(
    pdf,
    y,
    "Type a platform's streams and rate from its report; platform pays, your share and the totals recalculate in Adobe Acrobat or Reader. Platform pays = streams × rate, before your master and song share. The printed figures are the ones the Lab shows.",
    8.5,
    MUTED,
  );
  y += 2;

  // The shares that price every row, editable so the sheet can follow a corrected split sheet.
  const shareY = y + 1;
  const shareField = (name: string, x: number, value: string) => {
    const width = 17;
    fields.push({
      name,
      page: pdf.getNumberOfPages(),
      left: x,
      top: shareY - 4,
      width,
      height: 5.6,
      value,
    });
    pdf
      .setDrawColor(...RULE)
      .setLineWidth(0.3)
      .rect(x, shareY - 4, width, 5.6);
    font(pdf, "regular", 8)
      .setTextColor(...INK)
      .text(value, x + width - 1.4, shareY - 0.4, { align: "right" });
  };
  font(pdf, "semibold", 7.5)
    .setTextColor(...MUTED)
    .text("MASTER SHARE (%)", MARGIN, shareY);
  shareField("master", MARGIN + 30, String(c.earnings?.masterShare ?? 0));
  font(pdf, "semibold", 7.5)
    .setTextColor(...MUTED)
    .text("SONG SHARE (%)", MARGIN + 54, shareY);
  shareField("song", MARGIN + 82, String(c.earnings?.songShare ?? 0));
  font(pdf, "semibold", 7.5)
    .setTextColor(...MUTED)
    .text("DISTRIBUTOR CUT (%)", MARGIN + 106, shareY);
  shareField("distributor", MARGIN + 143, String(c.earnings?.distributor ?? 0));
  y += 10;

  y = sectionTitle(pdf, y, "Platforms");
  const headerY = y;
  headerCell(pdf, headerY, "Platform", MARGIN, "left");
  headerCell(pdf, headerY, "Streams", MARGIN + 92, "right");
  headerCell(pdf, headerY, "Rate", MARGIN + 122, "right");
  headerCell(pdf, headerY, "Platform pays", MARGIN + 150, "right");
  headerCell(pdf, headerY, "Your share", w - MARGIN, "right");
  y = headerY + 5;

  const e = c.earnings;
  const cut =
    (MASTER_PORTION * (e?.masterShare ?? 0) + (1 - MASTER_PORTION) * (e?.songShare ?? 0)) / 100;
  const platforms = PLATFORMS.map((platform) => {
    const saved = e?.platforms.find((row) => row.name === platform.name);
    return {
      id: platform.id,
      name: platform.name,
      streams: saved?.streams ?? 0,
      rate: saved?.rate ?? 0,
    };
  });

  const cell = (field: Field) => {
    fields.push(field);
    pdf
      .setDrawColor(...RULE)
      .setLineWidth(0.3)
      .rect(field.left, field.top, field.width, field.height);
    if (field.value)
      font(pdf, "regular", 8)
        .setTextColor(...INK)
        .text(field.value, field.left + field.width - 1.4, field.top + field.height / 2 + 1.2, {
          align: "right",
        });
  };

  platforms.forEach((platform, i) => {
    const rowY = y;
    const top = rowY - 3.9;
    const names = fieldsFor(i + 1);
    font(pdf, "regular", 9)
      .setTextColor(...INK)
      .text(platform.name, MARGIN, rowY);
    cell({
      name: names.streams,
      page: pdf.getNumberOfPages(),
      left: MARGIN + 66,
      top,
      width: 26,
      height: 5.4,
      value: platform.streams ? String(platform.streams) : "",
    });
    cell({
      name: names.rate,
      page: pdf.getNumberOfPages(),
      left: MARGIN + 100,
      top,
      width: 22,
      height: 5.4,
      value: platform.rate ? String(platform.rate) : "",
    });
    const pool = platform.streams * platform.rate;
    cell({
      name: names.pool,
      page: pdf.getNumberOfPages(),
      left: MARGIN + 124,
      top,
      width: 26,
      height: 5.4,
      value: platform.streams ? money(pool) : "",
      readOnly: true,
      calculate: `${JS_NUMBER}\n${JS_MONEY}\nevent.value=ctaMoney(ctaNumber(this.getField("${names.streams}").value)*ctaNumber(this.getField("${names.rate}").value));`,
    });
    cell({
      name: names.estimate,
      page: pdf.getNumberOfPages(),
      left: w - MARGIN - 24,
      top,
      width: 24,
      height: 5.4,
      value: platform.streams ? money(pool * cut) : "",
      readOnly: true,
      calculate: `${HELPERS}\nevent.value=ctaMoney(ctaNumber(this.getField("${names.pool}").value)*ctaCut());`,
    });
    y += 6.2;
  });

  const radio = e?.radio ?? 0;
  if (radio > 0) {
    font(pdf, "regular", 9)
      .setTextColor(...INK)
      .text("Radio / SiriusXM / live", MARGIN, y);
    font(pdf, "regular", 8.5)
      .setTextColor(...MUTED)
      .text(money(radio), w - MARGIN, y, { align: "right" });
    y += 6.2;
  }

  pdf
    .setDrawColor(...RULE)
    .setLineWidth(0.35)
    .line(MARGIN, y - 1, w - MARGIN, y - 1);
  y += 4.4;

  const totalPool = platforms.reduce((sum, p) => sum + p.streams * p.rate, 0);
  const totalYours = e?.total ?? 0;
  const totalNet = e?.net ?? totalYours;
  const poolSum = platforms
    .map((_, i) => `ctaNumber(this.getField("pool-${i + 1}").value)`)
    .join("+");
  const totalRow = (
    label: string,
    value: string,
    field: { name: string; calculate: string } | null,
    bold = true,
  ) => {
    font(pdf, bold ? "bold" : "regular", 9.5)
      .setTextColor(...INK)
      .text(label, MARGIN, y);
    if (field) {
      cell({
        name: field.name,
        page: pdf.getNumberOfPages(),
        left: w - MARGIN - 24,
        top: y - 3.9,
        width: 24,
        height: 5.6,
        value,
        readOnly: true,
        calculate: field.calculate,
      });
    } else {
      font(pdf, "semibold", 9.5)
        .setTextColor(...accentOf(pdf))
        .text(value, w - MARGIN, y, { align: "right" });
    }
    y += 6.6;
  };
  const estimateSum = [
    ...platforms.map((_, i) => `ctaNumber(this.getField("estimate-${i + 1}").value)`),
    // Radio has no editable field, so carry its printed amount into the recalculated share and keep totals.
    radio ? String(radio) : "",
  ]
    .filter(Boolean)
    .join("+");
  // The platform-pays total sits in its column, on the same line as the share total.
  font(pdf, "regular", 9)
    .setTextColor(...MUTED)
    .text("Total platform pays", MARGIN, y);
  cell({
    name: "total-pool",
    page: pdf.getNumberOfPages(),
    left: MARGIN + 124,
    top: y - 3.9,
    width: 26,
    height: 5.6,
    value: money(totalPool),
    readOnly: true,
    calculate: `${HELPERS}\nevent.value=ctaMoney(${poolSum || "0"});`,
  });
  y += 6.6;
  totalRow("Your share total", money(totalYours), {
    name: "total-estimate",
    calculate: `${HELPERS}\nevent.value=ctaMoney(${estimateSum || "0"});`,
  });
  totalRow("You keep after distributor", money(totalNet), {
    name: "total-keep",
    calculate: `${HELPERS}\nvar t=ctaNumber(this.getField("total-estimate").value);var d=ctaNumber(this.getField("distributor").value);event.value=ctaMoney(t*(1-d/100));`,
  });
  y += 4;

  if (c.tax && c.tax.deductible > 0) {
    y = sectionTitle(pdf, y, "Tax worksheet");
    const line = (left: string, right: string) => {
      font(pdf, "regular", 9)
        .setTextColor(...INK)
        .text(left, MARGIN, y);
      font(pdf, "regular", 9)
        .setTextColor(...INK)
        .text(right, w - MARGIN, y, { align: "right" });
      y += 5.6;
    };
    line("Deductible expenses", money(c.tax.deductible));
    line(
      c.tax.seRate
        ? `Estimated tax savings at ${c.tax.rate}% + ${c.tax.seRate}% self-employment`
        : `Estimated tax savings at ${c.tax.rate}%`,
      money(c.tax.savings),
    );
    if (c.tax.year) line("Tax year", c.tax.year);
    y += 2;
  }

  font(pdf, "regular", 7.5)
    .setTextColor(...MUTED)
    .text(
      "Estimates only. Platform rates vary by country, subscription tier and agreement; the master and song shares are the member's own, and nothing here is tax advice.",
      MARGIN,
      Math.min(y, pdf.internal.pageSize.getHeight() - 30),
      { maxWidth: w - MARGIN * 2 },
    );
  brandFooter(pdf, brand ?? undefined);
  return fields;
}

async function withFields(bytes: ArrayBuffer, fields: Field[], pageHeight: number) {
  const { PDFDocument, PDFName, PDFString, StandardFonts, TextAlignment, rgb } =
    await import("pdf-lib");
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();
  const pages = doc.getPages();
  const order: PDFRef[] = [];
  for (const field of fields) {
    const page = pages[field.page - 1];
    if (!page) continue;
    const textField = form.createTextField(field.name);
    // Sit a hair inside the drawn frame: the white field face hides the printed value without eating the frame.
    const inset = 0.3;
    textField.addToPage(page, {
      x: (field.left + inset) * MM_TO_PT,
      y: (pageHeight - field.top - field.height + inset) * MM_TO_PT,
      width: (field.width - inset * 2) * MM_TO_PT,
      height: (field.height - inset * 2) * MM_TO_PT,
      borderWidth: 0,
      backgroundColor: rgb(1, 1, 1),
    });
    textField.setFontSize(8);
    textField.setAlignment(TextAlignment.Right);
    if (field.value) textField.setText(field.value);
    if (field.readOnly) textField.enableReadOnly();
    if (field.calculate) {
      const dict = (textField.acroField as unknown as { dict: PDFDict }).dict;
      dict.set(
        PDFName.of("AA"),
        doc.context.obj({
          C: doc.context.obj({ S: "JavaScript", JS: PDFString.of(field.calculate) }),
        }),
      );
      order.push(textField.ref);
    }
  }
  if (order.length) form.acroForm.dict.set(PDFName.of("CO"), doc.context.obj(order));
  form.updateFieldAppearances(await doc.embedFont(StandardFonts.Helvetica));
  return new Uint8Array(await doc.save());
}

export async function buildProjectionPdfBytes(c: CopyContext, brand?: PdfBrand | null) {
  const pdf = await newBrandedPdf(brand);
  const fields = projectionPdfLayout(pdf, c, brand);
  const bytes = pdf.output("arraybuffer");
  try {
    return await withFields(bytes, fields, pdf.internal.pageSize.getHeight());
  } catch (error) {
    console.warn("Projection PDF came out without its fillable fields:", error);
    const fallback = await newBrandedPdf(brand);
    projectionPdfLayout(fallback, c, brand);
    return new Uint8Array(fallback.output("arraybuffer"));
  }
}

export async function downloadProjectionPdf(c: CopyContext, brand?: PdfBrand | null) {
  const bytes = await buildProjectionPdfBytes(c, brand);
  saveBlob(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    `${c.title || "financial-lab"} projection.pdf`,
  );
}
