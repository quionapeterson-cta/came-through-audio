import { describe, expect, it } from "vitest";
import { PDFCheckBox, PDFDocument } from "pdf-lib";
import { buildGuidePdfBytes, tickBox } from "@/lib/guide-pdf";
import { BLUEPRINT_GUIDES } from "@/lib/guides";

describe("blueprint PDF", () => {
  it("puts a box where jsPDF drew it", () => {
    // Letter is 279.4 mm tall. A box 20 mm from the top is 255.4 mm up from the bottom in points.
    const box = tickBox(279.4, { left: 20, top: 20 });
    expect(box.x).toBeCloseTo(56.69, 1);
    expect(box.y).toBeCloseTo(723.97, 1);
    expect(box.width).toBeCloseTo(11.34, 1);
  });

  it("hands back a PDF with one tickable box per checklist item", async () => {
    const guide = BLUEPRINT_GUIDES.find((g) => g.id === "royalty-registration")!;
    const doc = await PDFDocument.load(await buildGuidePdfBytes(guide));
    expect(doc.getForm().getFields().filter((f) => f instanceof PDFCheckBox)).toHaveLength(guide.checklist!.length);
  });
});
