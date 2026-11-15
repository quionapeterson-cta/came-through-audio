import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  BRAND,
  fillTokens,
  headerInk,
  SAMPLE_DATA,
  TAGLINE,
  type PdfTemplate,
} from "./pdf-templates";

/**
 * A template as a real PDF (founder, 2026-11-15). The HTML export is for the web; this is the file an admin prints or
 * sends, built from the same blocks with the sample release filled in, so a document can be reviewed before a song is
 * chosen. Letter pages, 48 pt margins, a page break whenever a block would run into the footer.
 */

const PAGE = { width: 612, height: 792 };
const MARGIN = 48;
const BOTTOM = 56;

const ink = (hex: string) => {
  const value = hex.replace("#", "");
  return rgb(
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  );
};

/** Splits text into lines that fit a width, keeping words whole. */
export function wrapText(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/g).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function templateToPdfBytes(
  template: PdfTemplate,
  data: Record<string, string> = SAMPLE_DATA,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const text = (value: string) => fillTokens(value, data);

  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height;
  const contentWidth = PAGE.width - MARGIN * 2;

  const newPage = () => {
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN;
  };

  /** Reserves height for a block, moving to a new page when the current one is full. */
  const ensure = (height: number) => {
    if (y - height < BOTTOM) newPage();
  };

  for (const block of template.blocks) {
    if (block.kind === "header") {
      // A header sits at the top of a page, so a header that arrives mid-page starts the next one instead of drawing
      // over the text above it.
      if (y < PAGE.height - 40) newPage();
      const colours = headerInk(block.background);
      const band = 96;
      page.drawRectangle({
        x: 0,
        y: PAGE.height - band,
        width: PAGE.width,
        height: band,
        color: ink(colours.surface),
      });
      page.drawLine({
        start: { x: 0, y: PAGE.height - band },
        end: { x: PAGE.width, y: PAGE.height - band },
        thickness: 3,
        color: ink(BRAND.cobalt),
      });
      const nameSize = 22;
      const left = MARGIN;
      const wordmarkY = PAGE.height - 52;
      page.drawText("Came Through", {
        x: left,
        y: wordmarkY,
        size: nameSize,
        font: bold,
        color: ink(colours.name),
      });
      const first = bold.widthOfTextAtSize("Came Through ", nameSize);
      page.drawText("Audio", {
        x: left + first,
        y: wordmarkY,
        size: nameSize,
        font: bold,
        color: ink(colours.audio),
      });
      if (block.showTagline) {
        page.drawText(TAGLINE, {
          x: left,
          y: wordmarkY - 20,
          size: 6.5,
          font: regular,
          color: ink(colours.audio),
        });
      }
      y = PAGE.height - band - 26;
      continue;
    }

    if (block.kind === "meta") {
      ensure(28 + block.rows.length * 22);
      page.drawText(text(block.heading).toUpperCase(), {
        x: MARGIN,
        y,
        size: 8,
        font: bold,
        color: ink(BRAND.cobalt),
      });
      y -= 16;
      for (const row of block.rows) {
        ensure(22);
        page.drawText(text(row.label), {
          x: MARGIN,
          y,
          size: 10,
          font: bold,
          color: ink(BRAND.black),
        });
        const value = wrapText(text(row.value), regular, 10, contentWidth - 150)[0] ?? "";
        page.drawText(value, {
          x: MARGIN + 150,
          y,
          size: 10,
          font: regular,
          color: ink("#333333"),
        });
        page.drawLine({
          start: { x: MARGIN, y: y - 5 },
          end: { x: PAGE.width - MARGIN, y: y - 5 },
          thickness: 0.5,
          color: ink(BRAND.platinum),
        });
        y -= 20;
      }
      y -= 10;
      continue;
    }

    if (block.kind === "clause") {
      const heading = wrapText(text(block.heading), bold, 11.5, contentWidth);
      const body = wrapText(text(block.body), regular, 10, contentWidth);
      const help = block.help ? wrapText(block.help, regular, 8.5, contentWidth - 16) : [];
      ensure(20 + heading.length * 15 + body.length * 14 + (help.length + 1) * 12);
      for (const line of heading) {
        page.drawText(line, { x: MARGIN, y, size: 11.5, font: bold, color: ink(BRAND.black) });
        y -= 15;
      }
      for (const line of body) {
        ensure(14);
        page.drawText(line, { x: MARGIN, y, size: 10, font: regular, color: ink("#333333") });
        y -= 14;
      }
      if (help.length) {
        y -= 4;
        for (const line of help) {
          ensure(12);
          page.drawText(line, {
            x: MARGIN + 16,
            y,
            size: 8.5,
            font: regular,
            color: ink("#666666"),
          });
          y -= 12;
        }
      }
      y -= 12;
      continue;
    }

    if (block.kind === "signatures") {
      ensure(30 + block.parties.length * 44);
      page.drawText(text(block.heading).toUpperCase(), {
        x: MARGIN,
        y,
        size: 8,
        font: bold,
        color: ink(BRAND.cobalt),
      });
      y -= 22;
      for (const party of block.parties) {
        ensure(44);
        page.drawLine({
          start: { x: MARGIN, y },
          end: { x: MARGIN + contentWidth * 0.55, y },
          thickness: 0.8,
          color: ink(BRAND.black),
        });
        page.drawText(text(party.label), {
          x: MARGIN,
          y: y - 12,
          size: 8.5,
          font: regular,
          color: ink("#555555"),
        });
        y -= 40;
      }
      y -= 8;
      continue;
    }

    ensure(110);
    const metal = block.tier === "gold" ? BRAND.gold : BRAND.platinum;
    page.drawCircle({
      x: MARGIN + 46,
      y: y - 46,
      size: 46,
      borderColor: ink(metal),
      borderWidth: 2,
    });
    const label = text(block.label).slice(0, 18);
    page.drawText(label, {
      x: MARGIN + 46 - bold.widthOfTextAtSize(label, 9) / 2,
      y: y - 50,
      size: 9,
      font: bold,
      color: ink(BRAND.black),
    });
    page.drawText(`CTA CERTIFICATION · ${block.tier.toUpperCase()}`, {
      x: MARGIN,
      y: y - 106,
      size: 7,
      font: bold,
      color: ink("#666666"),
    });
    y -= 126;
  }

  page.drawLine({
    start: { x: MARGIN, y: BOTTOM - 18 },
    end: { x: PAGE.width - MARGIN, y: BOTTOM - 18 },
    thickness: 0.5,
    color: ink(BRAND.platinum),
  });
  page.drawText(`CAME THROUGH AUDIO · ${TAGLINE}`, {
    x: MARGIN,
    y: BOTTOM - 30,
    size: 6.5,
    font: regular,
    color: ink("#666666"),
  });

  return doc.save();
}
