import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { starterPresets } from "./pdf-templates";
import { templateToPdfBytes, wrapText } from "./pdf-template-pdf";

describe("templateToPdfBytes", () => {
  it("renders every preset as a real PDF", async () => {
    for (const preset of starterPresets()) {
      const bytes = await templateToPdfBytes(preset);
      expect(bytes.byteLength).toBeGreaterThan(1000);
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
      const reopened = await PDFDocument.load(bytes);
      expect(reopened.getPageCount()).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps a long document on one page or more without throwing", async () => {
    const preset = starterPresets()[0]!;
    const long = { ...preset, blocks: [...preset.blocks, ...preset.blocks, ...preset.blocks] };
    const bytes = await templateToPdfBytes(long);
    const reopened = await PDFDocument.load(bytes);
    expect(reopened.getPageCount()).toBeGreaterThan(1);
  });
});

describe("wrapText", () => {
  it("keeps words whole inside the width", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = wrapText(
      "Came Through Audio registers a song before it is released",
      font,
      10,
      120,
    );
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(font.widthOfTextAtSize(line, 10)).toBeLessThanOrEqual(120);
  });

  it("keeps an explicit line break", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    expect(wrapText("one\ntwo", font, 10, 300)).toEqual(["one", "two"]);
  });
});
