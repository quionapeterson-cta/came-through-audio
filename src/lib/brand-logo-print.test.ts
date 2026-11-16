import type { jsPDF } from "jspdf";
import { describe, expect, it } from "vitest";
import { logoFor, LOGO_PRINT_PX } from "./brand-logo-print";
import { emptyKit, type PdfBrand } from "./brand-kit";

const brand = (dataUrl: string): PdfBrand => ({ ...emptyKit("Kismet"), logo: { dataUrl } });

describe("the print-sized logo", () => {
  it("is a print size, not the upload", () => {
    // A logo is drawn at most 80 mm wide on a cover, so 600px is still roughly 190 dpi there.
    expect(LOGO_PRINT_PX).toBe(600);
  });

  it("falls back to the uploaded file when no small copy was made", () => {
    // No DOM, an unreadable picture or an already-small file all end here, so a document never loses its logo.
    const pdf = {} as jsPDF;
    expect(logoFor(pdf, brand("data:image/png;base64,AAAA"))).toBe("data:image/png;base64,AAAA");
  });

  it("has nothing to draw without a logo", () => {
    const pdf = {} as jsPDF;
    expect(logoFor(pdf, { ...emptyKit("Kismet"), logo: null })).toBe("");
  });
});
