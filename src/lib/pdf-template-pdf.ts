import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  BRAND,
  fillTokens,
  formatBlockDate,
  headerInk,
  SAMPLE_DATA,
  SEAL_ART,
  TAGLINE,
  type FillableField,
  type PdfTemplate,
  type TemplateBlock,
} from "./pdf-templates";
import type { PacketAudit, PacketValues, SignatureRecord } from "./pdf-packets";
import fontkit from "@pdf-lib/fontkit";
import { easternDay, easternMoment } from "./eastern-time";
import { SIGNATURE_FILE } from "./signature-font";

/**
 * The approved cursive for every signed name (founder, 2026-11-16). pdf-lib needs the file itself, the way the rest of
 * the app sets the family with jsPDF or on screen; when it can't be read the line keeps Helvetica oblique so a download
 * still finishes, because a signature in the wrong hand beats no contract at all.
 */
async function embedSignatureFont(doc: PDFDocument, fallback: PDFFont): Promise<PDFFont> {
  if (typeof window === "undefined") return fallback;
  try {
    const res = await fetch(`/fonts/${SIGNATURE_FILE}`);
    if (!res.ok) return fallback;
    doc.registerFontkit(fontkit);
    return await doc.embedFont(await res.arrayBuffer(), { subset: true });
  } catch {
    return fallback;
  }
}

// pdf-lib's built-in faces encode Windows-1252, which has no arrows, ticks or ballot boxes. Map the handful a document
// might use instead of letting one glyph fail the whole download.
const GLYPHS: Record<string, string> = {
  "→": "->",
  "←": "<-",
  "↔": "<->",
  "✓": "v",
  "✔": "v",
  "☐": "[ ]",
  "☑": "[x]",
  "☒": "[x]",
  "★": "*",
  "≥": ">=",
  "≤": "<=",
  "≈": "~",
};
const clean = (value: string) =>
  value.replace(/[→←↔✓✔☐☑☒★≥≤≈]/g, (glyph) => GLYPHS[glyph] ?? glyph);

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

/**
 * What a filled field prints (founder, 2026-11-17). A date field keeps yyyy-mm-dd in the record and prints as the
 * document's own words, so an internship's placement reads "16 November 2026" the way the signature dates do. A value
 * that is not a real yyyy-mm-dd day prints as it was typed rather than disappearing.
 */
export function fieldAnswer(field: { type: FillableField["type"] }, value: unknown): string {
  const filled = String(value ?? "").trim();
  if (field.type !== "date") return filled;
  return formatBlockDate({ value: filled, format: "long" }) || filled;
}

/** What a sent packet adds to a template: the filled values, both signatures, and the audit certificate. */
export type PacketRenderOptions = {
  blocks?: TemplateBlock[];
  values?: PacketValues;
  signatures?: { recipient?: SignatureRecord | null; admin?: SignatureRecord | null };
  /**
   * Signatures for a plain "Signature lines" block, in the block's own party order. That block names its signers in the
   * template (Company, then the recipient), so a contract built from blocks maps its parties onto these lines by order.
   */
  lineSignatures?: ({ name: string; signedAt: string } | null)[] | undefined;
  audit?: PacketAudit;
  /**
   * Where the seal artwork is fetched from: the site's own origin, since the pictures are public assets beside the app.
   * Without it a seal prints the drawn ring, so a document always renders.
   */
  artBase?: string;
};

export async function templateToPdfBytes(
  template: PdfTemplate,
  data: Record<string, string> = SAMPLE_DATA,
  options: PacketRenderOptions = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const signatureFont = await embedSignatureFont(
    doc,
    await doc.embedFont(StandardFonts.HelveticaOblique),
  );
  const text = (value: string) => fillTokens(clean(value), data);
  const blocks = options.blocks ?? template.blocks;

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

  for (const block of blocks) {
    // A signature block switched off prints nothing at all, so a document can carry its own signature and print-name lines.
    if (block.kind === "signatures" && block.enabled === false) continue;
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
          color: ink(BRAND.black),
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
        page.drawText(line, { x: MARGIN, y, size: 10, font: regular, color: ink(BRAND.black) });
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
            color: ink(BRAND.black),
            opacity: 0.7,
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
      for (const [index, party] of block.parties.entries()) {
        ensure(44);
        page.drawLine({
          start: { x: MARGIN, y },
          end: { x: MARGIN + contentWidth * 0.55, y },
          thickness: 0.8,
          color: ink(BRAND.black),
        });
        // A signed line carries the typed name over the rule and the day it was given, the way a paper signature sits.
        const line = options.lineSignatures?.[index] ?? null;
        if (line) {
          page.drawText(clean(line.name).slice(0, 60), {
            x: MARGIN + 4,
            y: y + 6,
            size: 13,
            font: signatureFont,
            color: ink(BRAND.black),
          });
          // The Eastern day (founder, 2026-11-17): a signature given in the evening keeps its own date instead of
          // printing UTC's tomorrow.
          page.drawText(easternDay(line.signedAt), {
            x: MARGIN + contentWidth * 0.58,
            y: y - 12,
            size: 8,
            font: regular,
            color: ink(BRAND.black),
          });
        }
        page.drawText(text(party.label), {
          x: MARGIN,
          y: y - 12,
          size: 8.5,
          font: regular,
          color: ink(BRAND.black),
          opacity: 0.7,
        });
        y -= 40;
      }
      y -= 8;
      continue;
    }

    if (block.kind === "section") {
      // Every form starts its own page, so a packet reads as forms rather than one long scroll. The exception is the
      // first section: it belongs under the brand header on the cover, not alone on an otherwise blank page.
      if (y < PAGE.height - 190) newPage();
      page.drawText(text(block.title), {
        x: MARGIN,
        y,
        size: 16,
        font: bold,
        color: ink(BRAND.black),
      });
      y -= 12;
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE.width - MARGIN, y },
        thickness: 2,
        color: ink(BRAND.platinum),
      });
      y -= 14;
      if (block.subtitle) {
        page.drawText(text(block.subtitle).toUpperCase(), {
          x: MARGIN,
          y,
          size: 7,
          font: bold,
          color: ink(BRAND.cobalt),
        });
        y -= 16;
      }
      continue;
    }

    if (block.kind === "fields") {
      ensure(32);
      page.drawText(text(block.heading).toUpperCase(), {
        x: MARGIN,
        y,
        size: 8,
        font: bold,
        color: ink(BRAND.cobalt),
      });
      y -= 16;
      for (const field of block.fields) {
        const lines = field.type === "textarea" ? 2 : 1;
        const label =
          wrapText(`${field.label}${field.required ? " *" : ""}`, bold, 8.5, contentWidth)[0] ?? "";
        const answer = fieldAnswer(field, options.values?.[field.id]);
        ensure(20 + lines * 16);
        page.drawText(label, { x: MARGIN, y, size: 8.5, font: bold, color: ink(BRAND.black) });
        y -= 12;
        for (let i = 0; i < lines; i++) {
          page.drawLine({
            start: { x: MARGIN, y },
            end: { x: PAGE.width - MARGIN, y },
            thickness: 0.5,
            color: ink(BRAND.platinum),
          });
          // The answer sits on the first line, wrapped, so a long answer is never cut off at the margin.
          if (i === 0 && answer) {
            const first = wrapText(answer, regular, 9.5, contentWidth - 8)[0] ?? "";
            page.drawText(first, {
              x: MARGIN + 2,
              y: y + 3,
              size: 9.5,
              font: regular,
              color: ink(BRAND.black),
            });
          }
          if (i === 1 && answer) {
            const rest = wrapText(answer, regular, 9.5, contentWidth - 8)
              .slice(1)
              .join(" ");
            page.drawText(rest.slice(0, 110), {
              x: MARGIN + 2,
              y: y + 3,
              size: 9.5,
              font: regular,
              color: ink(BRAND.black),
            });
          }
          y -= 16;
        }
        y -= 4;
      }
      y -= 6;
      continue;
    }

    if (block.kind === "checkboxes") {
      ensure(24);
      page.drawText(text(block.heading).toUpperCase(), {
        x: MARGIN,
        y,
        size: 8,
        font: bold,
        color: ink(BRAND.cobalt),
      });
      y -= 16;
      const ticked = new Set((options.values?.[block.id] as string[] | undefined) ?? []);
      for (const option of block.options) {
        ensure(18);
        page.drawRectangle({
          x: MARGIN,
          y: y - 2,
          width: 9,
          height: 9,
          borderColor: ink(BRAND.black),
          borderWidth: 0.8,
        });
        if (ticked.has(option.id)) {
          page.drawLine({
            start: { x: MARGIN + 1.5, y: y - 1 },
            end: { x: MARGIN + 7.5, y: y + 6 },
            thickness: 1.2,
            color: ink(BRAND.black),
          });
          page.drawLine({
            start: { x: MARGIN + 7.5, y: y - 1 },
            end: { x: MARGIN + 1.5, y: y + 6 },
            thickness: 1.2,
            color: ink(BRAND.black),
          });
        }
        page.drawText(text(option.label).slice(0, 90), {
          x: MARGIN + 16,
          y,
          size: 9.5,
          font: regular,
          color: ink(BRAND.black),
        });
        y -= 18;
      }
      y -= 8;
      continue;
    }

    if (block.kind === "signature") {
      // A signed packet carries the real signature on the line, drawn or typed, with the day it was given. Its space is
      // reserved before the line is drawn, so the signature sits between the heading and the rule instead of running
      // through the heading when the signer picks a larger size.
      const signed = block.noStamp ? null : (options.signatures?.[block.role] ?? null);
      const scale = signed?.size === "lg" ? 1.4 : signed?.size === "sm" ? 0.8 : 1;
      const sigHeight = 28 * scale;
      ensure(52 + sigHeight);
      page.drawText(text(block.heading).toUpperCase(), {
        x: MARGIN,
        y,
        size: 8,
        font: bold,
        color: ink(BRAND.cobalt),
      });
      y -= 8 + sigHeight;
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: MARGIN + contentWidth * 0.62, y },
        thickness: 0.8,
        color: ink(BRAND.black),
      });
      if (block.showDate) {
        page.drawLine({
          start: { x: MARGIN + contentWidth * 0.66, y },
          end: { x: PAGE.width - MARGIN, y },
          thickness: 0.8,
          color: ink(BRAND.black),
        });
      }
      page.drawText(block.role === "recipient" ? "Recipient signature" : "Company representative", {
        x: MARGIN,
        y: y - 12,
        size: 8,
        font: regular,
        color: ink(BRAND.black),
        opacity: 0.7,
      });
      if (block.showDate) {
        page.drawText("Date", {
          x: MARGIN + contentWidth * 0.66,
          y: y - 12,
          size: 8,
          font: regular,
          color: ink(BRAND.black),
          opacity: 0.7,
        });
      }
      // Drawn and typed signatures are both a PNG now, so the page shows exactly what the signer saw. The width cap
      // keeps a long name on its own line.
      if (signed && signed.data.startsWith("data:image/png")) {
        try {
          const png = await doc.embedPng(signed.data);
          const width = Math.min(contentWidth * 0.62, (png.width / png.height) * sigHeight);
          page.drawImage(png, { x: MARGIN + 4, y: y + 2, width, height: sigHeight });
        } catch {
          page.drawText(clean(signed.name), {
            x: MARGIN + 4,
            y: y + 8,
            size: 14,
            font: signatureFont,
            color: ink(BRAND.black),
          });
        }
      } else if (signed) {
        page.drawText(clean(signed.name), {
          x: MARGIN + 4,
          y: y + 8,
          size: 16,
          font: signatureFont,
          color: ink(BRAND.black),
        });
      }
      if (signed && block.showDate) {
        // The Eastern day (founder, 2026-11-17), so an evening signature on the 16th never prints as the 17th.
        const day = easternDay(signed.signedAt);
        page.drawText(day, {
          x: MARGIN + contentWidth * 0.66 + 2,
          y: y + 8,
          size: 9.5,
          font: regular,
          color: ink(BRAND.black),
        });
      }
      y -= 30;
      continue;
    }

    if (block.kind === "printName") {
      // The name is printed, not signed: a labelled line with the Step 2 answer on it (founder, 2026-11-21). A missing
      // answer leaves the line blank, and the preflight warning is what says it still needs filling.
      ensure(48);
      page.drawText(text(block.label || "Print legal name"), {
        x: MARGIN,
        y,
        size: 9,
        font: bold,
        color: ink(BRAND.black),
      });
      y -= 16;
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE.width - MARGIN, y },
        thickness: 0.8,
        color: ink(BRAND.black),
      });
      const printed = text("{{PRINT_LEGAL_NAME}}");
      if (printed !== "{{PRINT_LEGAL_NAME}}") {
        page.drawText(printed.slice(0, 90), {
          x: MARGIN + 2,
          y: y + 4,
          size: 12,
          font: regular,
          color: ink(BRAND.black),
        });
      }
      y -= 28;
      continue;
    }

    if (block.kind === "date") {
      // The stored day, not the printing day: a copy printed later reads exactly as the signer's did.
      ensure(46);
      if (block.label.trim()) {
        page.drawText(text(block.label).toUpperCase(), {
          x: MARGIN,
          y,
          size: 8,
          font: bold,
          color: ink(BRAND.cobalt),
        });
        y -= 16;
      }
      page.drawText(formatBlockDate(block) || "—", {
        x: MARGIN,
        y,
        size: 15,
        font: bold,
        color: ink(BRAND.black),
      });
      y -= 26;
      continue;
    }

    ensure(110);
    const metal = block.tier === "gold" ? BRAND.gold : BRAND.platinum;
    // A seal can print one of the founder's badge pictures instead of the drawn ring. The picture is fetched from the
    // site itself; if it can't be read the ring is drawn, because a missing picture must never stop a document.
    let stamped = false;
    if (block.art && options.artBase) {
      try {
        const response = await fetch(`${options.artBase}${SEAL_ART[block.art]}`);
        if (response.ok) {
          const picture = await doc.embedPng(new Uint8Array(await response.arrayBuffer()));
          page.drawImage(picture, { x: MARGIN, y: y - 96, width: 96, height: 96 });
          stamped = true;
        }
      } catch {
        stamped = false;
      }
    }
    if (!stamped) {
      page.drawCircle({
        x: MARGIN + 46,
        y: y - 46,
        size: 46,
        borderColor: ink(metal),
        borderWidth: 2,
      });
      // Centred on the ring's own axis: measured width for the word, and its cap height used for the baseline, so a
      // longer label sits level instead of riding high or low inside the circle.
      const label = text(block.label).slice(0, 18);
      let labelSize = 9;
      while (labelSize > 6 && bold.widthOfTextAtSize(label, labelSize) > 62) labelSize -= 0.5;
      page.drawText(label, {
        x: MARGIN + 46 - bold.widthOfTextAtSize(label, labelSize) / 2,
        y: y - 46 - labelSize * 0.36,
        size: labelSize,
        font: bold,
        color: ink(BRAND.black),
      });
    }
    page.drawText(`CTA CERTIFICATION · ${block.tier.toUpperCase()}`, {
      x: MARGIN,
      y: y - 106,
      size: 7,
      font: bold,
      color: ink(BRAND.black),
      opacity: 0.65,
    });
    y -= 126;
  }

  // The execution certificate is the last page of a completed packet: who signed, when, from where, and the hash of
  // exactly what was signed.
  const audit = options.audit;
  if (audit) {
    newPage();
    page.drawText("EXECUTION AUDIT CERTIFICATE", {
      x: MARGIN,
      y,
      size: 8,
      font: bold,
      color: ink(BRAND.cobalt),
    });
    y -= 24;
    page.drawText(template.name.slice(0, 70), {
      x: MARGIN,
      y,
      size: 18,
      font: bold,
      color: ink(BRAND.black),
    });
    y -= 10;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE.width - MARGIN, y },
      thickness: 2,
      color: ink(BRAND.platinum),
    });
    y -= 26;
    const clip = (value?: string) =>
      !value ? "—" : value.length > 52 ? `${value.slice(0, 52)}…` : value;
    // Eastern time, named on the line (founder, 2026-11-17): the certificate said "GMT+0", which moved an evening
    // signature in New York onto the next day.
    const when = (iso?: string) => (iso ? easternMoment(iso) : "—");
    const rows: [string, string][] = [
      [
        "Recipient",
        `${audit.recipientName ?? ""}${audit.recipientEmail ? ` · ${audit.recipientEmail}` : ""}`,
      ],
      ["Recipient signed", when(audit.recipientSignedAt)],
      ["Recipient device", clip(audit.recipientDevice)],
      ["Recipient IP", audit.recipientIp || "—"],
      [
        "Company representative",
        `${audit.adminName ?? ""}${audit.adminName && audit.adminEmail ? " · " : ""}${audit.adminEmail ?? ""}` ||
          "—",
      ],
      ["Company signed", when(audit.adminSignedAt)],
      ["Company device", clip(audit.adminDevice)],
      ["Company IP", audit.adminIp || "—"],
      ["Sent", when(audit.sentAt)],
      ["Document hash (SHA-256)", audit.hash || "—"],
    ];
    for (const [label, value] of rows) {
      page.drawText(label, {
        x: MARGIN,
        y,
        size: 8,
        font: bold,
        color: ink(BRAND.black),
        opacity: 0.65,
      });
      const wrapped = wrapText(value, regular, 9.5, contentWidth - 150);
      for (const line of wrapped.slice(0, 2)) {
        page.drawText(line, {
          x: MARGIN + 150,
          y,
          size: 9.5,
          font: regular,
          color: ink(BRAND.black),
        });
        y -= 12;
      }
      y -= 10;
      page.drawLine({
        start: { x: MARGIN, y: y + 6 },
        end: { x: PAGE.width - MARGIN, y: y + 6 },
        thickness: 0.4,
        color: ink(BRAND.platinum),
      });
    }
    // The verified seal, in the brand's gold, over the platinum ring. Both words are measured and centred on the ring
    // instead of nudged by hand, and their baselines balance around the centre so the seal reads level.
    const sealX = PAGE.width - MARGIN - 52;
    const sealY = Math.max(BOTTOM + 60, y - 40);
    page.drawCircle({
      x: sealX,
      y: sealY,
      size: 44,
      borderColor: ink(BRAND.gold),
      borderWidth: 2.5,
    });
    page.drawCircle({
      x: sealX,
      y: sealY,
      size: 37.5,
      borderColor: ink(BRAND.platinum),
      borderWidth: 0.7,
    });
    const sealTop = "CTA";
    const sealBottom = "VERIFIED";
    const topSize = 10;
    const bottomSize = 7.5;
    page.drawText(sealTop, {
      x: sealX - bold.widthOfTextAtSize(sealTop, topSize) / 2,
      y: sealY + 2,
      size: topSize,
      font: bold,
      color: ink(BRAND.black),
    });
    page.drawText(sealBottom, {
      x: sealX - bold.widthOfTextAtSize(sealBottom, bottomSize) / 2,
      y: sealY - 9,
      size: bottomSize,
      font: bold,
      color: ink(BRAND.black),
    });
    page.drawText(
      "This certificate is part of the document. The hash covers the packet and both signatures.",
      {
        x: MARGIN,
        y: BOTTOM + 12,
        size: 7,
        font: regular,
        color: ink(BRAND.black),
        opacity: 0.65,
      },
    );
  }

  // The footer belongs on every page, not only the one a block happened to end on.
  for (const sheet of doc.getPages()) {
    sheet.drawLine({
      start: { x: MARGIN, y: BOTTOM - 18 },
      end: { x: PAGE.width - MARGIN, y: BOTTOM - 18 },
      thickness: 0.5,
      color: ink(BRAND.platinum),
    });
    sheet.drawText(`CAME THROUGH AUDIO · ${TAGLINE}`, {
      x: MARGIN,
      y: BOTTOM - 30,
      size: 6.5,
      font: regular,
      color: ink(BRAND.black),
      opacity: 0.65,
    });
  }

  return doc.save();
}
