import { describe, expect, it } from "vitest";
import {
  BRAND,
  canSaveTemplate,
  contrastRatio,
  fillTokens,
  formatBlockDate,
  headerInk,
  newId,
  preflight,
  starterPresets,
  templateToHtml,
  tokensIn,
  unknownTokens,
  type PdfTemplate,
} from "./pdf-templates";

describe("date block", () => {
  it("prints the day stored on the block, not the day it is read", () => {
    expect(formatBlockDate({ value: "2026-11-16", format: "long" })).toBe("16 November 2026");
    expect(formatBlockDate({ value: "2026-11-16", format: "short" })).toBe("16 Nov 2026");
  });

  it("prints nothing rather than inventing a date", () => {
    expect(formatBlockDate({ value: "", format: "long" })).toBe("");
    expect(formatBlockDate({ value: "16/11/2026", format: "long" })).toBe("");
  });

  it("fails the block check while the date is blank, and passes once it is set", () => {
    const template = (value: string): PdfTemplate => ({
      name: "Dated",
      tier: "standard",
      blocks: [
        { id: newId(), kind: "header", background: "light", showTagline: true },
        { id: newId(), kind: "date", label: "Effective date", value, format: "long" },
      ],
    });
    expect(preflight(template("")).find((c) => c.id === "blocks")?.ok).toBe(false);
    expect(preflight(template("2026-11-16")).find((c) => c.id === "blocks")?.ok).toBe(true);
    expect(templateToHtml(template("2026-11-16"))).toContain("Effective date");
  });
});

describe("tokens", () => {
  it("fills known tokens with sample release data", () => {
    expect(fillTokens("{{TRACK_TITLE}} by {{ARTIST_NAME}}")).toBe("Roll Out by Karma Came");
  });

  it("leaves a token it has no value for visible, so a gap is never silent", () => {
    expect(fillTokens("{{ARTIST_NAME}} · {{NOT_A_TOKEN}}")).toBe("Karma Came · {{NOT_A_TOKEN}}");
  });

  it("reads the tokens a block names", () => {
    expect(tokensIn("{{ISRC_CODE}} and {{UPC_CODE}}")).toEqual(["ISRC_CODE", "UPC_CODE"]);
  });

  it("reports a token the studio doesn't know", () => {
    const template: PdfTemplate = {
      name: "Test",
      tier: "standard",
      blocks: [
        {
          id: newId(),
          kind: "clause",
          heading: "Term",
          body: "Signed by {{MYSTERY_TOKEN}}",
          help: "",
        },
      ],
    };
    expect(unknownTokens(template)).toEqual(["MYSTERY_TOKEN"]);
  });
});

describe("brand contrast", () => {
  it("uses the real AA formula", () => {
    // The brand black is #0b0b0b, not #000000, so the ratio is just under pure black's 21:1.
    expect(contrastRatio(BRAND.black, BRAND.white)).toBeGreaterThan(19);
  });

  it("keeps both wordmark colours readable on their surface", () => {
    for (const background of ["light", "dark"] as const) {
      const ink = headerInk(background);
      expect(contrastRatio(ink.name, ink.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(ink.audio, ink.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("follows the logo rule: cobalt on light, electric on dark", () => {
    expect(headerInk("light")).toMatchObject({
      name: BRAND.black,
      audio: BRAND.cobalt,
      surface: BRAND.white,
    });
    expect(headerInk("dark")).toMatchObject({
      name: BRAND.white,
      audio: BRAND.electric,
      surface: BRAND.black,
    });
  });
});

describe("starter presets", () => {
  const presets = starterPresets();

  it("gives one clean, one executive and one certificate template", () => {
    expect(presets.map((p) => p.tier)).toEqual(["standard", "platinum", "gold"]);
  });

  it("starts every preset with the brand header", () => {
    for (const preset of presets) expect(preset.blocks[0]?.kind).toBe("header");
  });

  it("only names tokens the studio can fill", () => {
    for (const preset of presets) expect(unknownTokens(preset)).toEqual([]);
  });

  it("passes every preflight check as it ships", () => {
    for (const preset of presets) {
      const failed = preflight(preset).filter((check) => !check.ok);
      expect(failed, `${preset.name}: ${failed.map((c) => c.label).join(", ")}`).toEqual([]);
      expect(canSaveTemplate(preset)).toBe(true);
    }
  });
});

describe("preflight", () => {
  it("refuses a template with no name or no header", () => {
    const bare: PdfTemplate = { name: "  ", tier: "standard", blocks: [] };
    expect(canSaveTemplate(bare)).toBe(false);
    expect(preflight(bare).find((c) => c.id === "name")?.ok).toBe(false);
    expect(preflight(bare).find((c) => c.id === "header")?.ok).toBe(false);
  });

  it("warns about an unmapped variable instead of hiding it", () => {
    const template: PdfTemplate = {
      name: "Draft",
      tier: "gold",
      blocks: [
        { id: newId(), kind: "header", background: "dark", showTagline: true },
        { id: newId(), kind: "clause", heading: "Term", body: "{{WHOOPS}}", help: "" },
      ],
    };
    const tokens = preflight(template).find((c) => c.id === "tokens");
    expect(tokens?.ok).toBe(false);
    expect(tokens?.detail).toContain("{{WHOOPS}}");
    expect(canSaveTemplate(template)).toBe(false);
  });
});

describe("HTML export", () => {
  it("carries the brand colours, the tagline and the filled sample", () => {
    const html = templateToHtml(starterPresets()[0]!);
    expect(html).toContain(BRAND.cobalt);
    expect(html).toContain("YOUR FIRST STOP BEFORE DISTRIBUTION");
    expect(html).toContain("Karma Came");
    expect(html).not.toContain("{{ARTIST_NAME}}");
  });

  it("uses only the six approved hex codes, never a stray grey", () => {
    const approved = new Set(Object.values(BRAND).map((c) => c.toUpperCase()));
    const used = new Set(
      (templateToHtml(starterPresets()[0]!).match(/#[0-9a-f]{3,6}/gi) ?? []).map((c) =>
        c.toUpperCase(),
      ),
    );
    expect([...used].filter((c) => !approved.has(c))).toEqual([]);
    expect(used.size).toBeGreaterThan(2);
  });
});
