import { PDFDocument } from "pdf-lib";
import { buildPdf, signedFileName, toBase64 } from "./pdf-tools";

async function formPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const form = doc.getForm();
  form.createTextField("name").addToPage(page, { x: 50, y: 700, width: 200, height: 20 });
  const kept = form.createTextField("kept");
  kept.setText("Already here");
  kept.addToPage(page, { x: 50, y: 650, width: 200, height: 20 });
  form.createCheckBox("agree").addToPage(page, { x: 50, y: 600, width: 12, height: 12 });
  return doc.save();
}

// A 1×1 transparent PNG.
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="), (c) => c.charCodeAt(0));

describe("buildPdf", () => {
  it("returns the uploaded file untouched when nothing was added", async () => {
    const original = await formPdf();
    expect(await buildPdf(original, {}, [])).toBe(original);
  });

  it("fills only the boxes that were changed and keeps the form fillable", async () => {
    const out = await PDFDocument.load(await buildPdf(await formPdf(), { name: "Jordan Lee", agree: true }, []));
    const form = out.getForm();
    expect(form.getTextField("name").getText()).toBe("Jordan Lee");
    expect(form.getCheckBox("agree").isChecked()).toBe(true);
    expect(form.getTextField("kept").getText()).toBe("Already here");
    expect(form.getFields()).toHaveLength(3);
  });

  it("adds placed text and signatures without dropping pages", async () => {
    const bytes = await buildPdf(await formPdf(), {}, [
      { kind: "text", page: 0, x: 100, y: 100, size: 11, text: "10/27/2026 ✓" },
      { kind: "image", page: 0, x: 100, y: 150, width: 120, height: 40, png: PNG },
      { kind: "text", page: 5, x: 0, y: 0, size: 11, text: "no such page" },
    ]);
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(1);
    expect(out.getForm().getFields()).toHaveLength(3);
  });
});

describe("signedFileName", () => {
  it("marks the copy as signed", () => {
    expect(signedFileName("Lease.PDF")).toBe("Lease (signed).pdf");
    expect(signedFileName(".pdf")).toBe("Document (signed).pdf");
  });
});

describe("toBase64", () => {
  it("matches the browser's encoding", () => {
    const bytes = Uint8Array.from({ length: 70000 }, (_, i) => i % 256);
    expect(atob(toBase64(bytes)).length).toBe(70000);
    expect(toBase64(new Uint8Array([72, 105]))).toBe("SGk=");
  });
});
