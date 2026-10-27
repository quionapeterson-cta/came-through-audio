import { PDFCheckBox, PDFDocument, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField, StandardFonts, rgb } from "pdf-lib";

/** Company mailboxes staff can send a PDF from (founder, 2026-10-27: pick one each time, admin@ by default). Replies come back to the same box. */
export const PDF_MAILBOXES = ["admin", "legal", "registrations", "partnerships", "support", "billing", "collaborate"] as const;
export type PdfMailbox = (typeof PDF_MAILBOXES)[number];

/** Resend allows 40 MB per email; base64 adds a third, so the PDF itself stays under 10 MB. */
export const PDF_EMAIL_MAX_BYTES = 10 * 1024 * 1024;

/** Something placed on a page, in PDF points from the page's bottom-left corner. */
export type PdfMark =
  | { kind: "text"; page: number; x: number; y: number; size: number; text: string }
  | { kind: "image"; page: number; x: number; y: number; width: number; height: number; png: Uint8Array };

/** Fill-in box values by full field name: text for text boxes and dropdowns, the chosen option for radio buttons, true/false for checkboxes. */
export type PdfFieldValues = Record<string, string | boolean>;

/** "Lease.pdf" → "Lease (signed).pdf". */
export function signedFileName(name: string) {
  const base = name.replace(/\.pdf$/i, "").trim() || "Document";
  return `${base} (signed).pdf`;
}

/**
 * Writes the boxes the person filled in and the text/signatures they placed into a copy of the PDF and returns its bytes.
 * The uploaded document is kept as is (founder, 2026-10-27): `values` holds only the boxes they changed, nothing is
 * flattened or removed, and with no changes at all the original bytes come back untouched.
 */
export async function buildPdf(original: Uint8Array, values: PdfFieldValues, marks: PdfMark[]): Promise<Uint8Array> {
  if (!Object.keys(values).length && !marks.length) return original;
  const doc = await PDFDocument.load(original, { ignoreEncryption: true });
  const form = doc.getForm();
  for (const field of form.getFields()) {
    const value = values[field.getName()];
    if (value === undefined) continue;
    // One odd field shouldn't stop the rest of the form from saving.
    try {
      if (field instanceof PDFTextField) field.setText(String(value));
      else if (field instanceof PDFCheckBox) value ? field.check() : field.uncheck();
      else if (field instanceof PDFRadioGroup && typeof value === "string" && value) field.select(value);
      else if ((field instanceof PDFDropdown || field instanceof PDFOptionList) && typeof value === "string" && value) field.select(value);
    } catch (e) {
      console.warn(`Couldn't fill "${field.getName()}":`, e);
    }
  }
  // Forms like the IRS W-9 carry a second, older copy of their boxes (XFA) that Adobe Reader shows instead of the
  // filled-in ones, so it goes only when boxes were actually filled.
  if (Object.keys(values).length) form.deleteXFA();

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  for (const mark of marks) {
    const page = pages[mark.page];
    if (!page) continue;
    if (mark.kind === "text") {
      // Helvetica only covers basic Latin characters; anything else would stop the save.
      const text = mark.text.replace(/[^\x20-\x7E -ÿ]/g, "");
      if (text.trim()) page.drawText(text, { x: mark.x, y: mark.y, size: mark.size, font, color: rgb(0.043, 0.043, 0.043) });
    } else {
      const image = await doc.embedPng(mark.png);
      page.drawImage(image, { x: mark.x, y: mark.y, width: mark.width, height: mark.height });
    }
  }
  return doc.save();
}

/** Base64 for email attachments, in chunks so large PDFs don't overflow the call stack. */
export function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
