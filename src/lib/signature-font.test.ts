import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SIGNATURE_CSS, SIGNATURE_FILE, SIGNATURE_FONT } from "./signature-font";

/**
 * Every signature is one cursive (founder, 2026-11-16). These checks keep it that way: the family is named in the
 * constant, and a surface that prints a signature takes it from there instead of typing a family of its own.
 */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

// Tests may name the family to assert it; a surface that prints a signature may not.
const files = sources("src").filter((file) => !/\.test\.(ts|tsx)$/.test(file));
const named = files.filter((file) => readFileSync(file, "utf8").includes(SIGNATURE_FONT));

describe("the signature font", () => {
  it("is the approved legible cursive, and every name for it agrees", () => {
    expect(SIGNATURE_FONT).toBe("Dancing Script");
    expect(SIGNATURE_CSS).toContain(SIGNATURE_FONT);
    expect(SIGNATURE_FILE).toBe(`${SIGNATURE_FONT.replace(/ /g, "")}-Bold.ttf`);
  });

  it("is named in one constant, so a signature cannot arrive in a second hand", () => {
    // The constant itself, plus the font catalog where it is one of many brand fonts to pick from.
    expect(named.map((file) => file.replace(/\\/g, "/")).sort()).toEqual([
      "src/lib/brand-fonts.ts",
      "src/lib/signature-font.ts",
    ]);
  });

  it("is what the signing surfaces set", () => {
    const surfaces = [
      "src/components/Contracts.tsx",
      "src/components/SplitSheets.tsx",
      "src/components/PdfTools.tsx",
      "src/components/PdfSignaturePad.tsx",
      "src/lib/contract-pdf.ts",
      "src/lib/pdf-template-pdf.ts",
    ];
    for (const file of surfaces) {
      const text = readFileSync(file, "utf8");
      expect(text, `${file} sets a signature font`).toMatch(/SIGNATURE_(FONT|CSS|FILE)/);
    }
  });
});
