import { describe, expect, it } from "vitest";
import {
  BRAND,
  blocksToText,
  canSaveTemplate,
  contrastRatio,
  fillTokens,
  formatBlockDate,
  headerInk,
  insertTokenAt,
  missingTokens,
  newId,
  preflight,
  sameTemplateBlocks,
  starterPresets,
  templateToHtml,
  templateTokens,
  tokenLabel,
  tokensIn,
  unknownTokens,
  withoutRepeatedLeadingTitle,
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

describe("comparing a saved template with a built one", () => {
  it("ignores the ids each build makes fresh", () => {
    const saved = [
      { id: "aaaa1111", kind: "clause", heading: "Term", body: "One year.", help: "" },
    ];
    const built = [
      { id: "zzzz9999", kind: "clause", heading: "Term", body: "One year.", help: "" },
    ];
    expect(sameTemplateBlocks(saved, built)).toBe(true);
  });

  it("ignores the key order jsonb hands back", () => {
    expect(
      sameTemplateBlocks(
        [{ kind: "clause", heading: "Term", body: "One year.", help: "" }],
        [{ body: "One year.", help: "", heading: "Term", kind: "clause" }],
      ),
    ).toBe(true);
  });

  it("still sees changed wording", () => {
    expect(
      sameTemplateBlocks(
        [{ id: "a", kind: "clause", heading: "Term", body: "One year.", help: "" }],
        [{ id: "b", kind: "clause", heading: "Term", body: "Two years.", help: "" }],
      ),
    ).toBe(false);
  });
});

describe("blocks as text", () => {
  it("reads in page order, keeps the stored date, and leaves decoration out", () => {
    const text = blocksToText(
      [
        { id: newId(), kind: "header", background: "light", showTagline: true },
        { id: newId(), kind: "date", label: "Effective date", value: "2026-11-16", format: "long" },
        { id: newId(), kind: "clause", heading: "Term", body: "One year, renewing.", help: "" },
        { id: newId(), kind: "seal", tier: "gold", label: "CTA" },
        {
          id: newId(),
          kind: "signatures",
          heading: "Signed by",
          parties: [{ id: newId(), label: "Company" }],
        },
      ],
      "Services Agreement",
    );
    expect(text).toBe(
      [
        "SERVICES AGREEMENT",
        "Effective date: 16 November 2026",
        "",
        "Term",
        "One year, renewing.",
        "",
        "Signed by",
        "____________________  Company",
      ].join("\n"),
    );
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

describe("print legal name block", () => {
  const template = (): PdfTemplate => ({
    name: "Participant Release",
    tier: "standard",
    blocks: [
      { id: newId(), kind: "header", background: "light", showTagline: true },
      { id: newId(), kind: "printName", label: "Participant Print Legal Name" },
      { id: newId(), kind: "signature", heading: "Signature", role: "recipient", showDate: true },
    ],
  });

  it("asks for PRINT_LEGAL_NAME without spelling the token in the label", () => {
    expect(templateTokens(template())).toEqual(["PRINT_LEGAL_NAME"]);
    expect(preflight(template()).find((c) => c.id === "tokens")?.ok).toBe(true);
  });

  it("prints the editable label and the Step 2 name on the line", () => {
    const html = templateToHtml(template(), { PRINT_LEGAL_NAME: "Ada Lovelace" });
    expect(html).toContain("Participant Print Legal Name");
    expect(html).toContain("Ada Lovelace");
    expect(html).not.toContain("{{PRINT_LEGAL_NAME}}");
  });

  it("keeps a blank line, never the raw token, when no name has been typed", () => {
    const html = templateToHtml(template(), {});
    expect(html).not.toContain("{{PRINT_LEGAL_NAME}}");
    expect(html).toContain("Participant Print Legal Name");
  });

  it("is reported as missing until the name is filled", () => {
    expect(missingTokens(template(), {})).toEqual(["PRINT_LEGAL_NAME"]);
    expect(missingTokens(template(), { PRINT_LEGAL_NAME: "Ada Lovelace" })).toEqual([]);
    expect(missingTokens(template(), { PRINT_LEGAL_NAME: "   " })).toEqual(["PRINT_LEGAL_NAME"]);
  });

  it("appears in the plain text and passes the block check", () => {
    expect(
      blocksToText([{ id: newId(), kind: "printName", label: "Parent/Guardian Print Legal Name" }]),
    ).toContain("Parent/Guardian Print Legal Name: ____________________");
    expect(preflight(template()).find((c) => c.id === "blocks")?.ok).toBe(true);
  });
});

describe("HTML preview values", () => {
  it("fills every token-bearing block from the contract's own values, not the sample release", () => {
    const template: PdfTemplate = {
      name: "Values",
      tier: "standard",
      blocks: [
        {
          id: newId(),
          kind: "meta",
          heading: "{{ARTIST_NAME}} details",
          rows: [{ id: newId(), label: "Name", value: "{{LEGAL_NAME}}" }],
        },
        {
          id: newId(),
          kind: "clause",
          heading: "{{ARTIST_NAME}} term",
          body: "{{ARTIST_NAME}} signs as {{PRINT_LEGAL_NAME}}.",
          help: "{{DATE}}",
        },
        {
          id: newId(),
          kind: "signatures",
          heading: "{{ARTIST_NAME}} signatures",
          parties: [{ id: newId(), label: "{{LEGAL_NAME}} · artist" }],
        },
        { id: newId(), kind: "section", title: "{{ARTIST_NAME}} section", subtitle: "{{DATE}}" },
        {
          id: newId(),
          kind: "fields",
          heading: "{{ARTIST_NAME}} fields",
          role: "recipient",
          fields: [{ id: newId(), label: "{{DATE}}", type: "text", role: "recipient" }],
        },
        {
          id: newId(),
          kind: "checkboxes",
          heading: "{{ARTIST_NAME}} options",
          role: "recipient",
          mode: "single",
          options: [{ id: newId(), label: "{{DATE}}" }],
        },
        { id: newId(), kind: "date", label: "{{DATE}}", value: "2026-11-21", format: "long" },
        { id: newId(), kind: "seal", tier: "gold", label: "{{CERTIFICATION_TIER}}" },
        {
          id: newId(),
          kind: "signature",
          heading: "{{ARTIST_NAME}} signature",
          role: "recipient",
          showDate: true,
        },
        { id: newId(), kind: "printName", label: "{{ARTIST_NAME}} printed name" },
      ],
    };
    const html = templateToHtml(template, {
      ARTIST_NAME: "Ada Lovelace",
      LEGAL_NAME: "Ada Byron",
      PRINT_LEGAL_NAME: "Ada Lovelace",
      DATE: "21 November 2026",
      CERTIFICATION_TIER: "Diamond",
    });
    expect(html).not.toContain("Karma Came");
    for (const value of [
      "Ada Lovelace details",
      "Ada Byron",
      "Ada Lovelace signs",
      "Ada Lovelace signatures",
      "21 November 2026",
      "Ada Lovelace section",
      "Ada Lovelace fields",
      "Ada Lovelace options",
      "Diamond",
      "Ada Lovelace signature",
      "Ada Lovelace printed name",
    ]) {
      expect(html).toContain(value);
    }
  });
});

describe("universal token scanner", () => {
  it("finds standalone and inline tokens once, in reading order", () => {
    const template: PdfTemplate = {
      name: "Services",
      tier: "standard",
      blocks: [
        { id: newId(), kind: "header", background: "light", showTagline: true },
        {
          id: newId(),
          kind: "clause",
          heading: "Scope",
          body: "{{SELECTED_SERVICE}} for {{PRINT_LEGAL_NAME}}",
          help: "",
        },
        { id: newId(), kind: "printName", label: "Print Legal Name" },
        { id: newId(), kind: "clause", heading: "Repeat", body: "{{SELECTED_SERVICE}}", help: "" },
      ],
    };
    expect(templateTokens(template)).toEqual(["SELECTED_SERVICE", "PRINT_LEGAL_NAME"]);
  });

  it("makes a readable form label from any token", () => {
    expect(tokenLabel("SELECTED_SERVICE")).toBe("Selected Service");
    expect(tokenLabel("PRINT_LEGAL_NAME")).toBe("Print Legal Name");
    expect(tokenLabel("PARENT_GUARDIAN_NAME")).toBe("Parent Guardian Name");
  });

  it("clears the missing list only when every token has a value", () => {
    const template: PdfTemplate = {
      name: "Services",
      tier: "standard",
      blocks: [
        {
          id: newId(),
          kind: "clause",
          heading: "Scope",
          body: "{{A_ONE}} and {{B_TWO}}",
          help: "",
        },
      ],
    };
    expect(missingTokens(template, { A_ONE: "one" })).toEqual(["B_TWO"]);
    expect(missingTokens(template, { A_ONE: "one", B_TWO: "two" })).toEqual([]);
  });
});

describe("inserting a token", () => {
  it("lands at the caret and spaces only where needed", () => {
    expect(insertTokenAt("Signed by .", "PRINT_LEGAL_NAME", 10, 10)).toEqual({
      text: "Signed by {{PRINT_LEGAL_NAME}} .",
      caret: 30,
    });
    expect(insertTokenAt("Signed by ", "PRINT_LEGAL_NAME", 10, 10).text).toBe(
      "Signed by {{PRINT_LEGAL_NAME}}",
    );
  });

  it("replaces the selected words instead of appending after them", () => {
    expect(insertTokenAt("Signed by NAME here", "PRINT_LEGAL_NAME", 10, 14).text).toBe(
      "Signed by {{PRINT_LEGAL_NAME}} here",
    );
  });
});

describe("contract title in the preview", () => {
  const blocks = (heading: string) => [
    { id: newId(), kind: "header" as const, background: "light" as const, showTagline: true },
    { id: newId(), kind: "clause" as const, heading, body: "Terms.", help: "" },
  ];

  it("blanks a leading heading that repeats the title the preview already prints", () => {
    const shown = withoutRepeatedLeadingTitle(
      blocks("Master Services Agreement"),
      "Master Services Agreement",
    );
    expect(shown[1]).toMatchObject({ heading: "" });
    expect(shown[1]).toMatchObject({ body: "Terms." });
  });

  it("leaves a different first heading alone", () => {
    const shown = withoutRepeatedLeadingTitle(blocks("Scope of work"), "Master Services Agreement");
    expect(shown[1]).toMatchObject({ heading: "Scope of work" });
  });
});

describe("default signature block", () => {
  const template = (enabled: boolean): PdfTemplate => ({
    name: "Own signatures",
    tier: "standard",
    blocks: [
      { id: newId(), kind: "header", background: "light", showTagline: true },
      {
        id: newId(),
        kind: "signatures",
        heading: "SIGNATURES",
        parties: [{ id: newId(), label: "{{ARTIST_NAME}} · artist" }],
        enabled,
      },
      { id: newId(), kind: "signature", heading: "Signature", role: "recipient", showDate: true },
    ],
  });

  it("prints when left on", () => {
    expect(templateToHtml(template(true))).toContain("SIGNATURES");
    expect(blocksToText(template(true).blocks)).toContain("SIGNATURES");
  });

  it("prints nothing, and asks for no token, when switched off", () => {
    expect(templateToHtml(template(false))).not.toContain("SIGNATURES");
    expect(blocksToText(template(false).blocks)).not.toContain("SIGNATURES");
    expect(templateTokens(template(false))).toEqual([]);
    expect(preflight(template(false)).find((c) => c.id === "blocks")?.ok).toBe(true);
    // The standalone Signature block beside it still counts as a signature line for preflight.
    expect(preflight(template(false)).find((c) => c.id === "signature")?.ok).toBe(true);
  });
});

describe("block order", () => {
  it("renders in the exact array order the studio saved", () => {
    const blocks = [
      { id: newId(), kind: "header" as const, background: "light" as const, showTagline: true },
      { id: newId(), kind: "clause" as const, heading: "First", body: "One.", help: "" },
      { id: newId(), kind: "printName" as const, label: "Print Legal Name" },
      { id: newId(), kind: "clause" as const, heading: "Last", body: "Two.", help: "" },
    ];
    const html = templateToHtml(
      { name: "Ordered", tier: "standard", blocks },
      { PRINT_LEGAL_NAME: "Ada" },
    );
    expect(html.indexOf("First")).toBeLessThan(html.indexOf("Print Legal Name"));
    expect(html.indexOf("Print Legal Name")).toBeLessThan(html.indexOf("Last"));
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
