import { describe, expect, it, vi } from "vitest";

import * as brandPdf from "@/lib/brand-pdf";
import { downloadContractPdf } from "@/lib/contract-pdf";

/**
 * The PDF as latin-1 text. `save` is where a download leaves the app, so it is replaced for the length of one build:
 * jsPDF writes its text operands uncompressed, so the words on the page are readable straight out of the bytes.
 */
async function printed(run: () => Promise<void>): Promise<string> {
  const build = brandPdf.newBrandedPdf;
  let bytes = new Uint8Array();
  const spy = vi.spyOn(brandPdf, "newBrandedPdf").mockImplementation(async (brand) => {
    const pdf = await build(brand);
    return new Proxy(pdf, {
      get(target, key) {
        if (key === "save") {
          return () => {
            bytes = new Uint8Array(target.output("arraybuffer") as ArrayBuffer);
          };
        }
        const value = Reflect.get(target, key, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  });
  try {
    await run();
  } finally {
    spy.mockRestore();
  }
  // A capture that never filled would make every "does not contain" assertion below pass for the wrong reason, so an
  // empty one fails here instead: nothing was checked is not the same as nothing was found.
  if (!bytes.length) throw new Error("the PDF never reached save, so there was nothing to read");
  return new TextDecoder("latin1").decode(bytes);
}

const contract = (status: string) => () =>
  downloadContractPdf({
    title: "Producer Agreement",
    body: "PRODUCER AGREEMENT\n\n1. THE WORK\n\nThis agreement covers the recordings listed in Schedule A.",
    parties: [
      { name: "Jordan Lee", role: "Producer", signedAt: null },
      { name: "Came Through Audio, LLC", role: "Company", signedAt: null },
    ],
    status,
  });

describe("a contract PDF", () => {
  it("carries no status line while it is out for signature", async () => {
    const text = await printed(contract("sent"));
    expect(text.startsWith("%PDF")).toBe(true);
    expect(text).not.toContain("Out for signature");
    expect(text).toContain("Producer Agreement");
  });

  it("carries no status line as a draft", async () => {
    const text = await printed(contract("draft"));
    expect(text).not.toContain("Draft");
  });

  it("states nothing about signing in words, only in the signature block", async () => {
    const text = await printed(() =>
      downloadContractPdf({
        title: "Producer Agreement",
        body: "PRODUCER AGREEMENT",
        parties: [
          {
            name: "Jordan Lee",
            role: "Producer",
            signedAt: "2026-11-17T10:00:00Z",
            signatureName: "Jordan Lee",
          },
        ],
        status: "signed",
      }),
    );
    // The signature block is what says a contract is signed: the name, and the status words are still absent.
    expect(text).toContain("Jordan Lee");
    expect(text).not.toContain("Fully signed");
  });
});
